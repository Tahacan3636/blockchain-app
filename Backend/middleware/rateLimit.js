// =============================================================
// middleware/rateLimit.js - Hiz Sinirlama
// =============================================================
// Deneme-yanilma (brute force) saldirilarina karsi: ayni IP adresi
// kisa surede cok fazla oy/giris denemesi yaparsa 429 doner.
// =============================================================

const rateLimit = require('express-rate-limit');
const config = require('../config');

function createLimiter(limit, windowMinutes, message) {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: message },
        skip: () => config.isTest
    });
}

// Oy: 15 dakikada IP basina 20 deneme
const voteLimiter = createLimiter(20, 15, 'Cok fazla oy denemesi. Lutfen daha sonra tekrar deneyin.');

// Admin girisi: 15 dakikada IP basina 10 deneme
const loginLimiter = createLimiter(10, 15, 'Cok fazla giris denemesi. Lutfen daha sonra tekrar deneyin.');

module.exports = { voteLimiter, loginLimiter };
