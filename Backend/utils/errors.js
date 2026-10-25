// =============================================================
// utils/errors.js - Hata Yonetimi Yardimcilari
// =============================================================

// Beklenen (kullaniciya gosterilebilir) hatalar icin.
// Ornek: throw new AppError(409, 'Bu secmen zaten oy kullanmis')
// Merkezi hata yakalayici (middleware/errorHandler.js) bunu uygun
// HTTP koduyla cevaba cevirir.
class AppError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Express 4, async route'lardaki hatalari kendisi yakalamaz.
// Bu sarmalayici hatayi next()'e ileterek merkezi yakalayiciya gonderir.
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, asyncHandler };
