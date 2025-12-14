const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// YENİLİK: Növbə Sistemi (Array)
let waitingQueue = [];

io.on('connection', (socket) => {
    // Online sayını göndər
    io.emit('users_count', io.engine.clientsCount);

    socket.on('find_partner', () => {
        // Əgər istifadəçi artıq növbədədirsə, onu çıxar (təkrar düşməsin)
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);

        if (waitingQueue.length > 0) {
            // Növbədən ilk adamı götür (FIFO)
            const partner = waitingQueue.shift();

            // Əgər partnyor hələ də bağlıdırsa, birləşdir
            if (partner && partner.connected) {
                socket.emit('partner_found', { role: 'offerer' });
                partner.emit('partner_found', { role: 'answerer' });

                socket.partner = partner;
                partner.partner = socket;
            } else {
                // Partnyor düşübsə, yenidən axtarışa ver (rekursiya)
                socket.emit('find_partner');
            }
        } else {
            // Heç kim yoxdur, növbəyə əlavə et
            waitingQueue.push(socket);
        }
    });

    socket.on('stop_search', () => {
        // Növbədən çıxar
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
    });

    // WebRTC Signalling
    socket.on('offer', (data) => { if (socket.partner) socket.partner.emit('offer', data); });
    socket.on('answer', (data) => { if (socket.partner) socket.partner.emit('answer', data); });
    socket.on('candidate', (data) => { if (socket.partner) socket.partner.emit('candidate', data); });

    socket.on('disconnect', () => {
        io.emit('users_count', io.engine.clientsCount);

        // Çıxan adamı növbədən sil
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
        
        // Əgər danışırdısa, partnyora xəbər ver
        if (socket.partner) {
            socket.partner.emit('partner_disconnected');
            socket.partner.partner = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
