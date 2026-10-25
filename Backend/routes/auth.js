// =============================================================
// routes/auth.js - Admin Girisi
// =============================================================
// POST /api/auth/login -> { username, password } -> JWT token
//
// Sifreler veritabaninda bcrypt hash'i olarak durur.
// bcrypt kasitli olarak YAVAS bir hash'tir: sifre tahmin etmeye
// calisan saldirgan saniyede cok az deneme yapabilir.
// =============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const db = require('../db');
const { signToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const { AppError, asyncHandler } = require('../utils/errors');

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        throw new AppError(400, 'Kullanici adi ve sifre zorunludur');
    }

    const result = await db.query(
        'SELECT id, username, password_hash, role FROM users WHERE username = $1',
        [username]
    );
    const user = result.rows[0];

    // Kullanici yok ya da sifre yanlis: ayni mesaj (hangisi oldugu sizdirilmaz)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        throw new AppError(401, 'Kullanici adi veya sifre hatali');
    }

    res.json({
        success: true,
        token: signToken(user),
        user: { id: user.id, username: user.username, role: user.role }
    });
}));

module.exports = router;
