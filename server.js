const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let waitingUser = null;

io.on('connection', (socket) => {
    // 1. REAL ONLINE SAYINI GÖNDƏR
    io.emit('users_count', io.engine.clientsCount);

    socket.on('find_partner', () => {
        if (waitingUser && waitingUser !== socket) {
            const partner = waitingUser;
            waitingUser = null;

            socket.emit('partner_found', { role: 'offerer' });
            partner.emit('partner_found', { role: 'answerer' });

            socket.partner = partner;
            partner.partner = socket;
        } else {
            waitingUser = socket;
        }
    });

    socket.on('offer', (data) => { if (socket.partner) socket.partner.emit('offer', data); });
    socket.on('answer', (data) => { if (socket.partner) socket.partner.emit('answer', data); });
    socket.on('candidate', (data) => { if (socket.partner) socket.partner.emit('candidate', data); });

    socket.on('disconnect', () => {
        // 2. KİMSƏ ÇIXANDA SAYI YENİLƏ
        io.emit('users_count', io.engine.clientsCount);

        if (socket === waitingUser) waitingUser = null;
        if (socket.partner) {
            socket.partner.emit('partner_disconnected');
            socket.partner.partner = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server ${PORT}-da işləyir`);
});
