// =============================================================
// server.js - Giris Noktasi
// =============================================================
// 1. Ayarlari yukle (config.js; eksik gizli anahtar varsa durur)
// 2. Veritabanini hazirla (tablolar, genesis blok, admin)
// 3. Sunucuyu baslat
// Veritabani hazirlanamazsa sunucu ACILMAZ (yarim calisan sistem yerine).
// =============================================================

const config = require('./config');
const app = require('./app');
const initDatabase = require('./db/init');

initDatabase()
    .then(() => {
        app.listen(config.port, () => {
            console.log(`Blockchain Voting System -> http://localhost:${config.port}`);
        });
    })
    .catch(err => {
        console.error('Veritabani baslatilamadi:', err.message);
        process.exit(1);
    });
