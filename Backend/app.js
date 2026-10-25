// =============================================================
// app.js - Express Uygulamasi
// =============================================================
// Uygulama burada KURULUR ama baslatilmaz (listen yok).
// Neden ayri? Testler (supertest) uygulamayi port acmadan
// dogrudan kullanabilsin diye. Baslatma isi server.js'te.
//
// Bir istegin gectigi yol:
//   cors -> json parse -> route (+ middleware'ler) -> servis -> db
//   hata olursa -> errorHandler
// =============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const db = require('./db');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// CORS: frontend baska bir adreste (Netlify) calistiginda tarayicinin
// backend'e istek atmasina izin verir.
app.use(cors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Render gibi bir proxy arkasinda gercek istemci IP'sini almak icin
// (hiz sinirlamasi IP'ye gore calisir)
app.set('trust proxy', 1);

// Lokal gelistirmede frontend'i de bu sunucu sunar:
// http://localhost:3000 -> Frontend/public/index.html
app.use(express.static(path.join(__dirname, '..', 'Frontend', 'public')));

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
