// =============================================================
// middleware/errorHandler.js - Merkezi Hata Yakalayici
// =============================================================
// Tum route'lardaki hatalar buraya duser.
// - AppError (beklenen hata): kendi mesaji ve HTTP koduyla doner.
// - Diger hatalar (beklenmeyen): detay SADECE sunucu loguna yazilir,
//   kullaniciya genel bir mesaj doner. Boylece veritabani yapisi
//   gibi ic bilgiler disari sizmaz.
// =============================================================

const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({ success: false, error: err.message });
    }

    // express.json() bozuk JSON'da bu hatayi firlatir
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: 'Gecersiz JSON' });
    }

    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ success: false, error: 'Sunucu hatasi' });
}

function notFound(req, res) {
    res.status(404).json({ success: false, error: 'Endpoint bulunamadi' });
}

module.exports = { errorHandler, notFound };
