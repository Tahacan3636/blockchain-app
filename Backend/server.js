// =============================================================
// server.js - Blockchain Voting System Backend
// =============================================================
// Bu dosya uygulamanin giris noktasi (entry point).
// Express framework'u ile bir web sunucusu olusturuyoruz.
// =============================================================

// 0) ORTAM DEGISKENLERINI YUKLE
// .env dosyasindaki degerleri process.env'e yukler.
// Bu sayede DB sifreleri, JWT secret gibi hassas bilgiler kod icinde gozukmez.
require('dotenv').config();

// 1) MODULLERI YUKLE
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const initDatabase = require('./db/init');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// 2) EXPRESS UYGULAMASINI OLUSTUR
const app = express();

// 3) PORT TANIMLA
const PORT = process.env.PORT || 3000;

// 4) CORS AYARI
// Frontend baska bir domain'de calistiginda (Netlify vs Render)
// tarayici guvenlik nedeniyle istekleri engeller.
// CORS bu engeli kaldirir.
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// 5) MIDDLEWARE: JSON PARSE
app.use(express.json());

// 6) STATIK DOSYA SUNMA (opsiyonel - local gelistirme icin)
app.use(express.static(path.join(__dirname, 'public')));

// 7) API ROUTE'LARINI BAGLA
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 8) Health Check
app.get('/api/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({
            status: 'ok',
            message: 'Blockchain Voting System backend is running',
            database: 'connected',
            dbTime: result.rows[0].now,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Server is running but database connection failed',
            database: 'disconnected',
            error: err.message
        });
    }
});

// 9) VERITABANINI HAZIRLA VE SUNUCUYU BASLAT
// Sunucu baslamadan once tablolari olustur (IF NOT EXISTS ile guvenli).
// Boylece her deploy'da tablolar otomatik kontrol edilir.
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('===========================================');
        console.log(' Blockchain Voting System');
        console.log(`   Server: http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
        console.log('===========================================');
    });
}).catch(err => {
    console.error('Veritabani baslatilamadi:', err.message);
    process.exit(1);
});
