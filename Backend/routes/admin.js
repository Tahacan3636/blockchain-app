// =============================================================
// routes/admin.js - Admin Panel API Endpoint'leri
// =============================================================
// Bu dosya admin kullanicilarina ozel API endpoint'lerini icerir.
// Tum endpoint'ler authenticateToken + requireRole('admin') ile korunur.
//
// Yetkilendirme Zinciri (Middleware Chain):
//   Istek -> [authenticateToken] -> [requireRole('admin')] -> [Handler]
//   1. Token gecerli mi? (401 degilse)
//   2. Kullanicinin rolu 'admin' mi? (403 degilse)
//   3. Her sey tamam, istegi isle
//
// Endpoint'ler:
// GET    /api/admin/users           -> Tum kullanicilari listele
// PATCH  /api/admin/users/:id/role  -> Kullanici rolunu degistir
// DELETE /api/admin/users/:id       -> Kullanici sil
// GET    /api/admin/stats           -> Secim istatistikleri
// POST   /api/admin/voters/import   -> Secmen listesi import (Excel'den)
// GET    /api/admin/voters          -> Secmen listesini getir
// DELETE /api/admin/voters          -> Secmen listesini temizle
// POST   /api/admin/election/reset  -> Secimi sifirla (TEHLIKELI)
// =============================================================

const express = require('express');
const router = express.Router();

const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateBlockHash } = require('../utils/blockchain');

// ─── Tum admin route'larina middleware uygula ───
// router.use() = "bu router'daki TUM isteklere bu middleware'leri uygula"
// Bu sayede her endpoint'e tek tek [authenticateToken, requireRole('admin')]
// yazmamiza gerek kalmaz. DRY prensibi (Don't Repeat Yourself).
router.use(authenticateToken, requireRole('admin'));


// =============================================================
// GET /api/admin/users - Tum Kullanicilari Listele
// =============================================================
// Admin tum kayitli kullanicilari gorebilir.
// ONEMLI: password_hash ASLA dondurulmez! (guvenlik)
//
// SQL'de SELECT ile belirli sutunlari secmek:
//   SELECT id, username, role, created_at FROM users
//   Bu, "SELECT * FROM users" yerine tercih edilir cunku:
//   1. Hassas veri (password_hash) disariya sizamaz
//   2. Gereksiz veri transfer edilmez (performans)
//
// Response: { success: true, users: [...], total: 5 }
// =============================================================
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
        );

        res.json({
            success: true,
            users: result.rows,
            total: result.rows.length
        });
    } catch (err) {
        console.error('Admin users listesi hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// PATCH /api/admin/users/:id/role - Kullanici Rolunu Degistir
// =============================================================
// HTTP PATCH Nedir?
// PUT = Kaynagi tamamen degistir (tum alanlari gonder)
// PATCH = Kaynagi kismen guncelle (sadece degisen alanlari gonder)
// Burada sadece "role" alanini guncelledigimiz icin PATCH kullaniyoruz.
//
// URL Parametreleri (Route Parameters):
// :id -> req.params.id olarak erisilebilir
// Ornek: PATCH /api/admin/users/3/role -> req.params.id = "3"
//
// Guvenlik Kontrolleri:
// 1. Gecerli rol mu? (sadece 'voter' veya 'admin')
// 2. Admin kendini degistiremez (kilitlenme riski)
//
// Request Body: { "role": "admin" } veya { "role": "voter" }
// Response: { success: true, user: { id, username, role } }
// =============================================================
router.patch('/users/:id/role', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;

        // 1. Gecerli rol kontrolu (whitelist yaklasimi)
        // Whitelist: Sadece izin verilen degerleri kabul et.
        // Blacklist'in tersi - daha guvenli cunku bilinmeyen degerler otomatik reddedilir.
        const validRoles = ['voter', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `Gecersiz rol. Gecerli roller: ${validRoles.join(', ')}`
            });
        }

        // 2. Admin kendini degistiremez
        // Neden? Eger tek admin kendini voter yaparsa,
        // sistemde hic admin kalmaz ve admin paneline kimse erisemez.
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Kendi rolunuzu degistiremezsiniz (kilitlenme riski)'
            });
        }

        // 3. Kullaniciyi guncelle
        // RETURNING: UPDATE sonucunda guncellenen satiri geri dondurur.
        // Boylece ayrica SELECT yapmaya gerek kalmaz.
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
            [role, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Kullanici bulunamadi'
            });
        }

        res.json({
            success: true,
            message: `Kullanici rolu '${role}' olarak guncellendi`,
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Rol degistirme hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// DELETE /api/admin/users/:id - Kullanici Sil
// =============================================================
// HTTP DELETE: Kaynak silme istegi.
//
// Guvenlik:
// 1. Admin kendini silemez
// 2. Silinen kullanicinin oylari blockchain'de kalir
//    (cunku oy veritabaninda voter_hash olarak tutulur, user tablosuyla iliskili degil)
//
// RETURNING: Silinen satiri geri dondurur (silme islemini dogrulama icin).
// Response: { success: true, message: "..." }
// =============================================================
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Admin kendini silemez
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Kendi hesabinizi silemezsiniz'
            });
        }

        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, username',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Kullanici bulunamadi'
            });
        }

        res.json({
            success: true,
            message: `'${result.rows[0].username}' kullanicisi silindi`,
            deletedUser: result.rows[0]
        });
    } catch (err) {
        console.error('Kullanici silme hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// GET /api/admin/stats - Secim Istatistikleri
// =============================================================
// Admin icin detayli istatistik paneli.
//
// SQL Aggregate Fonksiyonlari:
// COUNT(*) = satirlarin toplam sayisi
// Bu fonksiyonlar GROUP BY ile birlikte kullanilabilir.
//
// Promise.all Nedir?
// Birden fazla async islemi PARALEL calistirmak icin kullanilir.
// 4 sorguyu sirayla yapmak yerine hepsini ayni anda baslatiyoruz.
// Sirayla: ~100ms + ~100ms + ~100ms + ~100ms = ~400ms
// Paralel:  ~100ms (en yavas sorgunun suresi)
//
// Destructuring Assignment:
// const [a, b, c, d] = await Promise.all([...])
// Her sonuc sirasiyla ilgili degiskene atanir.
//
// Response: { stats: { totalVotes, totalUsers, totalBlocks, votesPerCandidate } }
// =============================================================
router.get('/stats', async (req, res) => {
    try {
        // Paralel sorgular (Promise.all = hepsini ayni anda baslat)
        const [votesResult, usersResult, blocksResult, candidateVotesResult, allowedVotersResult] = await Promise.all([
            // Toplam oy sayisi (genesis block haric, block_index > 0)
            db.query('SELECT COUNT(*) FROM blocks WHERE block_index > 0'),
            // Toplam kullanici sayisi
            db.query('SELECT COUNT(*) FROM users'),
            // Toplam blok sayisi (genesis dahil)
            db.query('SELECT COUNT(*) FROM blocks'),
            // Aday bazli oy sayimi
            // LEFT JOIN: Aday hic oy almamis olsa bile listede gorunur (0 oy ile)
            // INNER JOIN olsaydi 0 oylu adaylar gozukmezdi.
            db.query(`
                SELECT c.id, c.name, c.party, COUNT(b.id) as votes
                FROM candidates c
                LEFT JOIN blocks b ON (b.data->>'candidateId')::text = c.id::text
                    AND b.block_index > 0
                GROUP BY c.id, c.name, c.party
                ORDER BY c.id
            `),
            // Kayitli secmen sayisi (allowed_voters tablosu)
            db.query('SELECT COUNT(*) FROM allowed_voters')
        ]);

        res.json({
            success: true,
            stats: {
                totalVotes: parseInt(votesResult.rows[0].count),
                totalUsers: parseInt(usersResult.rows[0].count),
                totalBlocks: parseInt(blocksResult.rows[0].count),
                allowedVoters: parseInt(allowedVotersResult.rows[0].count),
                votesPerCandidate: candidateVotesResult.rows.map(r => ({
                    candidateId: r.id,
                    name: r.name,
                    party: r.party,
                    votes: parseInt(r.votes)
                }))
            }
        });
    } catch (err) {
        console.error('Istatistik hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// POST /api/admin/voters/import - Secmen Listesi Import
// =============================================================
// Admin, Excel'den okunan ogrenci numaralarini ve il kodlarini sisteme yukler.
// Mevcut liste TRUNCATE edilip yenisi yazilir (her import tam liste).
//
// TRUNCATE: Eski listeyi tamamen siler (hizli, log tutmaz).
// ON CONFLICT DO NOTHING: Tekrar eden numara varsa hata vermez, atlar.
//
// Request Body: { "voters": [{ "tc": "123456789", "provinceCode": 6 }, ...] }
// Response: { success: true, count: 150 }
// =============================================================
router.post('/voters/import', async (req, res) => {
    try {
        const { voters } = req.body;

        // Validasyon: voters bir array olmali
        if (!Array.isArray(voters)) {
            return res.status(400).json({
                success: false,
                error: 'voters alani bir array olmalidir'
            });
        }

        // Bos array kontrolu
        if (voters.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Secmen listesi bos olamaz'
            });
        }

        // Her eleman icin validasyon: tc (9 hane) ve provinceCode (1-81 arasi)
        for (let i = 0; i < voters.length; i++) {
            const v = voters[i];
            if (!v || typeof v !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: `Satir ${i + 1}: Her eleman { tc, provinceCode } formatinda olmali`
                });
            }
            if (!/^\d{9}$/.test(String(v.tc))) {
                return res.status(400).json({
                    success: false,
                    error: `Satir ${i + 1}: Gecersiz ogrenci numarasi formati (9 haneli olmali). Deger: ${v.tc}`
                });
            }
            const pc = parseInt(v.provinceCode);
            if (isNaN(pc) || pc < 1 || pc > 81) {
                return res.status(400).json({
                    success: false,
                    error: `Satir ${i + 1}: Gecersiz il kodu (1-81 arasi olmali). Deger: ${v.provinceCode}`
                });
            }
        }

        // Transaction ile eski listeyi sil, yenisini yaz
        await db.query('BEGIN');

        try {
            // Eski listeyi temizle
            await db.query('TRUNCATE allowed_voters RESTART IDENTITY');

            // Yeni listeyi satirlari tek tek ekle
            for (const v of voters) {
                await db.query(
                    `INSERT INTO allowed_voters (citizenship_number, province_code)
                     VALUES ($1, $2)
                     ON CONFLICT (citizenship_number) DO NOTHING`,
                    [String(v.tc), parseInt(v.provinceCode)]
                );
            }

            await db.query('COMMIT');

            // Eklenen kayit sayisini al
            const countResult = await db.query('SELECT COUNT(*) FROM allowed_voters');
            const count = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                message: `${count} secmen basariyla yuklendi`,
                count: count
            });
        } catch (txError) {
            await db.query('ROLLBACK');
            throw txError;
        }
    } catch (err) {
        console.error('Secmen import hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// GET /api/admin/voters - Secmen Listesini Getir
// =============================================================
// Mevcut allowed_voters tablosundaki tum secmenleri doner.
// Response: { success: true, voters: [...], total: 150 }
// =============================================================
router.get('/voters', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, citizenship_number, province_code, imported_at FROM allowed_voters ORDER BY id ASC'
        );

        res.json({
            success: true,
            voters: result.rows,
            total: result.rows.length
        });
    } catch (err) {
        console.error('Secmen listesi hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// DELETE /api/admin/voters - Secmen Listesini Temizle + Oyları Sıfırla
// =============================================================
// Secmen listesini, tum oylari ve blockchain verilerini siler.
// Yeni genesis blok olusturulur. Harita ve sonuclar sifirlanir.
//
// Neden oylar da siliniyor?
// Secmen listesi degistiginde eski oylar gecersiz kalir cunku
// o oylar eski listedeki secmenlere aittir. Tutarsizlik onlenir.
//
// Transaction ile atomik islem: ya hepsi basarili olur, ya hicbiri.
// Response: { success: true, message: "..." }
// =============================================================
router.delete('/voters', async (req, res) => {
    try {
        await db.query('BEGIN');

        try {
            // 1. Secmen listesini temizle
            await db.query('TRUNCATE allowed_voters RESTART IDENTITY');

            // 2. Oy gecmisini temizle
            await db.query('TRUNCATE voters RESTART IDENTITY');

            // 3. Blockchain'i temizle
            await db.query('TRUNCATE blocks RESTART IDENTITY');

            // 4. Genesis blogu yeniden olustur
            const timestamp = new Date().toISOString();
            const genesisData = { message: 'Genesis Block' };
            const genesisBlock = {
                block_index: 0,
                timestamp: timestamp,
                data: genesisData,
                previous_hash: '0'
            };
            const genesisHash = calculateBlockHash(genesisBlock);

            await db.query(
                `INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash)
                 VALUES ($1, $2, $3, $4, $5)`,
                [0, timestamp, JSON.stringify(genesisData), genesisHash, '0']
            );

            await db.query('COMMIT');

            res.json({
                success: true,
                message: 'Secmen listesi, tum oylar ve blockchain verileri temizlendi. Genesis blok yeniden olusturuldu.'
            });
        } catch (txError) {
            await db.query('ROLLBACK');
            throw txError;
        }
    } catch (err) {
        console.error('Secmen listesi temizleme hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});


// =============================================================
// POST /api/admin/election/reset - Secimi Sifirla
// =============================================================
// !!! TEHLIKELI ISLEM - GERI ALINAMAZ !!!
// Tum oylari ve bloklari siler, genesis blogu yeniden olusturur.
//
// Guvenlik Katmanlari (Defense in Depth):
// 1. authenticateToken - Kimlik dogrulama
// 2. requireRole('admin') - Yetki kontrolu
// 3. { confirm: true } - Ekstra onay (yanlislikla cagirilmasini engeller)
//
// TRUNCATE vs DELETE:
// DELETE FROM blocks; -> Satirlari tek tek siler (yavas, log tutar)
// TRUNCATE blocks;    -> Tabloyu tamamen bosaltir (hizli, log tutmaz)
// RESTART IDENTITY: SERIAL (auto-increment) sayaclari sifirlar
//   Yani silinen tabloya yeniden INSERT yapildiginda id 1'den baslar.
//
// Transaction (BEGIN/COMMIT/ROLLBACK):
// Ya hepsi basarili olur, ya hicbiri. ACID prensiplerinden "Atomicity".
// Ornek: voters silinir ama blocks silinirken hata olursa,
// ROLLBACK sayesinde voters da geri gelir. Tutarsizlik onlenir.
// =============================================================
router.post('/election/reset', async (req, res) => {
    try {
        // Ekstra onay kontrolu
        if (req.body.confirm !== true) {
            return res.status(400).json({
                success: false,
                error: 'Bu islem icin { "confirm": true } gondermelisiniz'
            });
        }

        // Transaction baslat
        await db.query('BEGIN');

        try {
            // Tum oylari ve bloklari sil
            await db.query('TRUNCATE voters RESTART IDENTITY');
            await db.query('TRUNCATE blocks RESTART IDENTITY');

            // Genesis blogu yeniden olustur
            const timestamp = new Date().toISOString();
            const genesisData = { message: 'Genesis Block' };
            const genesisBlock = {
                block_index: 0,
                timestamp: timestamp,
                data: genesisData,
                previous_hash: '0'
            };
            const genesisHash = calculateBlockHash(genesisBlock);

            await db.query(
                `INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash)
                 VALUES ($1, $2, $3, $4, $5)`,
                [0, timestamp, JSON.stringify(genesisData), genesisHash, '0']
            );

            // Her sey basarili, kaydet
            await db.query('COMMIT');

            res.json({
                success: true,
                message: 'Secim sifirlandi. Tum oylar silindi, genesis blok yeniden olusturuldu.'
            });
        } catch (txError) {
            // Hata olursa tum islemleri geri al
            await db.query('ROLLBACK');
            throw txError;
        }
    } catch (err) {
        console.error('Secim sifirlama hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

module.exports = router;
