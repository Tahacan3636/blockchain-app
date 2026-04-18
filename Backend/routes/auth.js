// =============================================================
// routes/auth.js - Kimlik Dogrulama Endpoint'leri
// =============================================================
// Bu dosya kullanici kayit (register) ve giris (login) islemlerini icerir.
//
// Endpoint'ler:
// POST /api/auth/register  -> Yeni kullanici olustur
// POST /api/auth/login     -> Giris yap, JWT token al
//
// Guvenlik:
// - Sifreler bcrypt ile hashlenir (plaintext ASLA saklanmaz)
// - Giris basariliysa JWT token doner
// - Token, korunmus endpoint'lerde (ornegin /api/vote) kimlik dogrulama icin kullanilir
//
// bcrypt vs SHA-256:
// SHA-256 hizli bir hash fonksiyonudur (blockchain icin ideal).
// Ama sifre icin HIZLI olmak KOTU'dur cunku brute-force kolaylasir.
// bcrypt kasitli olarak yavas calismak icin tasarlanmistir (salt rounds).
// salt rounds = 10 -> yaklasik 100ms (brute-force'u pratik olarak imkansiz kilar)
// =============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');

// =============================================================
// POST /api/auth/register - Kullanici Kayit
// =============================================================
// Input:  { "username": "taha", "password": "sifre123" }
// Output: { "success": true, "message": "Kayit basarili" }
//
// Adimlar:
// 1. username ve password validasyonu
// 2. Username benzersizlik kontrolu (UNIQUE constraint)
// 3. Sifreyi bcrypt ile hashle
// 4. users tablosuna INSERT
// =============================================================
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // --- 1) Input Validasyonu ---
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username ve password zorunludur'
            });
        }

        // Username en az 3 karakter
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Username en az 3 karakter olmalidir'
            });
        }

        // Password en az 4 karakter
        if (password.length < 4) {
            return res.status(400).json({
                success: false,
                error: 'Password en az 4 karakter olmalidir'
            });
        }

        // --- 2) Username benzersizlik kontrolu ---
        // UNIQUE constraint zaten var ama onceden kontrol etmek
        // daha anlasilir hata mesaji verir.
        const existingUser = await db.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Bu username zaten kullaniliyor'
            });
        }

        // --- 3) Sifreyi hashle ---
        // bcrypt.hash(password, saltRounds)
        // saltRounds = 10: Her hash icin rastgele bir "salt" uretir ve
        // 2^10 = 1024 iterasyon yapar. Bu, brute-force saldirilarini yavaslatir.
        // Sonuc: "$2a$10$..." formatinda 60 karakterlik bir hash string
        const passwordHash = await bcrypt.hash(password, 10);

        // --- 4) Veritabanina kaydet ---
        await db.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
            [username, passwordHash]
        );

        res.status(201).json({
            success: true,
            message: 'Kayit basarili'
        });

    } catch (err) {
        console.error('Register hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

// =============================================================
// POST /api/auth/login - Kullanici Giris
// =============================================================
// Input:  { "username": "taha", "password": "sifre123" }
// Output: { "success": true, "token": "eyJ...", "user": { id, username, role } }
//
// Adimlar:
// 1. username ve password validasyonu
// 2. Kullaniciyi veritabaninda bul
// 3. bcrypt.compare() ile sifre kontrolu
// 4. jwt.sign() ile token olustur
// 5. Token ve kullanici bilgisini don
// =============================================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // --- 1) Input Validasyonu ---
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username ve password zorunludur'
            });
        }

        // --- 2) Kullaniciyi bul ---
        const result = await db.query(
            'SELECT id, username, password_hash, role FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            // Guvenlik: "Kullanici bulunamadi" yerine genel mesaj
            // Boylece saldirgana username'in var olup olmadigini soylememis oluruz.
            return res.status(401).json({
                success: false,
                error: 'Username veya password hatali'
            });
        }

        const user = result.rows[0];

        // --- 3) Sifre kontrolu ---
        // bcrypt.compare(plainPassword, hash):
        // Girilen sifreyi hashleyip, veritabanindaki hash ile karsilastirir.
        // true: Sifre dogru, false: Sifre yanlis
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Username veya password hatali'
            });
        }

        // --- 4) JWT Token olustur ---
        // jwt.sign(payload, secret, options)
        // payload: Token icine gomulecek veri (id, username, role)
        //   DİKKAT: Hassas veri (sifre, TC no) payload'a KONULMAZ!
        //   Cunku JWT decode edilebilir (Base64). Sadece imza gizlidir.
        // secret: Token'i imzalamak icin kullanilan gizli anahtar
        // expiresIn: Token'in gecerlilik suresi
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // --- 5) Basarili yanit ---
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Login hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

module.exports = router;
