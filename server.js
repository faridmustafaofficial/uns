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

// Növbədə gözləyən istifadəçi
let waitingUser = null;

io.on('connection', (socket) => {
    // Online sayını göndər
    io.emit('users_count', io.engine.clientsCount);

    socket.on('find_partner', () => {
        // Əgər istifadəçi artıq növbədədirsə, heç nə etmə (təkrar basılma qarşısını al)
        if (waitingUser === socket) return;

        if (waitingUser) {
            // Növbədə kimsə var, onları birləşdir
            const partner = waitingUser;
            waitingUser = null; // Növbəni boşalt

            // Hər iki tərəfə partnyor tapıldığını de
            socket.emit('partner_found', { role: 'offerer' });
            partner.emit('partner_found', { role: 'answerer' });

            // Bir-birlərini yadda saxla
            socket.partner = partner;
            partner.partner = socket;
        } else {
            // Heç kim yoxdur, sən növbəyə keç
            waitingUser = socket;
        }
    });

    // --- YENİ HİSSƏ: Axtarışı dayandır ---
    socket.on('stop_search', () => {
        // Əgər növbədəki adam bu istifadəçidirsə, növbəni boşalt
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });

    // WebRTC Signalling
    socket.on('offer', (data) => { if (socket.partner) socket.partner.emit('offer', data); });
    socket.on('answer', (data) => { if (socket.partner) socket.partner.emit('answer', data); });
    socket.on('candidate', (data) => { if (socket.partner) socket.partner.emit('candidate', data); });

    socket.on('disconnect', () => {
        io.emit('users_count', io.engine.clientsCount); // Sayı yenilə

        // Çıxan adam növbədə idisə, növbəni sil
        if (socket === waitingUser) {
            waitingUser = null;
        }
        
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
