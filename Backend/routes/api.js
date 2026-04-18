// =============================================================
// routes/api.js - REST API Endpoint'leri
// =============================================================
// Bu dosya blockchain oylama sisteminin tum API endpoint'lerini icerir.
//
// REST API Nedir?
// - REST = Representational State Transfer
// - HTTP metodlari (GET, POST, PUT, DELETE) ile veri alisveri yapilir
// - Her endpoint bir URL + HTTP metodu ciftidir
// - Veri genellikle JSON formatinda gider/gelir
//
// Bu dosyadaki endpoint'ler:
// POST /vote          -> Oy verme
// GET  /results       -> Secim sonuclari
// GET  /chain         -> Blockchain verisi
// GET  /chain/verify  -> Zincir dogrulama
//
// Not: server.js'de app.use('/api', apiRoutes) ile baglanacagi icin
// burada '/vote' yazmak aslinda '/api/vote' anlamina gelir.
// =============================================================

const express = require('express');
const router = express.Router();  // Router = mini app, route'lari gruplar

const db = require('../db');
const { voterHash, calculateBlockHash, generateTxId } = require('../utils/blockchain');


// =============================================================
// POST /api/vote - Oy Verme
// =============================================================
// Secmen oy verir. Sunucu:
// 1. Gelen veriyi kontrol eder (voterId, candidateId var mi?)
// 2. voterId'yi hashler (gizlilik)
// 3. Daha once oy verilmis mi kontrol eder
// 4. Yeni blok olusturur ve blockchain'e ekler
// 5. Transaction ID (txId) doner
//
// Request Body: { "candidateId": 1, "voterId": "123456789" }
// Response:     { "success": true, "txId": "abc...", "blockIndex": 1 }
//
// voterId: Secmenin Ogrenci Numarasi (9 haneli) degeri.
// JWT auth kaldirildi, kimlik dogrulama voterId uzerinden yapilir.
// =============================================================
router.post('/vote', async (req, res) => {
    try {
        const { candidateId, voterId } = req.body;

        // --- 0) voterId kontrolu ---
        if (!voterId) {
            return res.status(400).json({
                success: false,
                error: 'voterId (Ogrenci Numarasi) zorunludur'
            });
        }

        // --- 1) Secmen Listesi Kontrolu ---
        // allowed_voters tablosu bos ise oy kullanilamaz (once Excel import edilmeli).
        // Tablo doluysa sadece listedeki ogrenci numaralari oy verebilir.
        let provinceCode = null;
        const allowedCount = await db.query('SELECT COUNT(*) FROM allowed_voters');
        if (parseInt(allowedCount.rows[0].count) === 0) {
            return res.status(403).json({
                success: false,
                error: 'Secmen listesi henuz yuklenmedi. Oy kullanabilmek icin once admin panelden secmen listesi import edilmelidir.'
            });
        }
        const isAllowed = await db.query(
            'SELECT id, province_code FROM allowed_voters WHERE citizenship_number = $1',
            [voterId]
        );
        if (isAllowed.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Bu Ogrenci Numarasi secmen listesinde bulunamadi'
            });
        }
        provinceCode = isAllowed.rows[0].province_code;

        // --- 2) Input Validasyonu ---
        if (!candidateId) {
            return res.status(400).json({
                success: false,
                error: 'candidateId zorunludur'
            });
        }

        // --- 3) Aday kontrolu ---
        // candidateId veritabaninda var mi? Gecersiz aday ID'si engellenir.
        const candidateCheck = await db.query(
            'SELECT id, name FROM candidates WHERE id = $1',
            [candidateId]
        );
        if (candidateCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Gecersiz candidateId. Boyle bir aday bulunamadi.'
            });
        }

        // --- 4) Secmen kimligini hashle ---
        // Gercek kimlik (TC no, ogrenci no vb.) veritabaninda SAKLANMAZ.
        // Sadece hash'i tutulur -> gizlilik korunur.
        const hashedVoter = voterHash(voterId);

        // --- 5) Cift oy kontrolu ---
        // Ayni secmen daha once oy vermis mi?
        // voters tablosundaki voter_hash UNIQUE oldugu icin
        // INSERT hata verir ama onceden kontrol etmek daha temiz bir yaklasim.
        const duplicateCheck = await db.query(
            'SELECT id FROM voters WHERE voter_hash = $1',
            [hashedVoter]
        );
        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Bu secmen zaten oy kullanmis'
            });
            // 409 = Conflict: "Bu islem daha once yapilmis"
        }

        // --- 6) Son blogu al (previousHash icin) ---
        // Yeni blok, kendinden onceki blogun hash'ine bagli olmali.
        // Bu blockchain'in temel prensibi: her blok oncekine referans verir.
        const lastBlockResult = await db.query(
            'SELECT * FROM blocks ORDER BY block_index DESC LIMIT 1'
        );

        // Genesis blok olmadan oy verilemez
        if (lastBlockResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain henuz baslatilmamis (genesis blok yok)'
            });
        }

        const lastBlock = lastBlockResult.rows[0];

        // --- 7) Yeni blok olustur ---
        const timestamp = new Date().toISOString();
        const newIndex = lastBlock.block_index + 1;

        // Transaction ID: Bu oy isleminin benzersiz kimligi
        const txId = generateTxId(timestamp, hashedVoter, candidateId, lastBlock.hash);

        // Blok verisi (JSONB olarak saklanacak)
        // provinceCode: Secmenin il plaka kodu (allowed_voters tablosundan)
        const blockData = {
            voterHash: hashedVoter,
            candidateId: candidateId,
            txId: txId,
            provinceCode: provinceCode
        };

        // Blogun hash'ini hesapla
        const newBlockForHash = {
            block_index: newIndex,
            timestamp: timestamp,
            data: blockData,
            previous_hash: lastBlock.hash
        };
        const blockHash = calculateBlockHash(newBlockForHash);

        // --- 8) Veritabanina kaydet ---
        // Transaction kullaniyoruz: ya hepsi basarili olur, ya hicbiri.
        // Boylece voters'a yazildi ama blocks'a yazilamadi gibi tutarsiz durumlar engellenir.
        //
        // BEGIN: Transaction baslar
        // COMMIT: Her sey basarili -> kalici yaz
        // ROLLBACK: Hata olursa -> herseyi geri al
        await db.query('BEGIN');

        try {
            // Yeni blogu blocks tablosuna ekle
            await db.query(
                `INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash)
                 VALUES ($1, $2, $3, $4, $5)`,
                [newIndex, timestamp, JSON.stringify(blockData), blockHash, lastBlock.hash]
            );

            // Onceki blogun next_hash'ini guncelle (cift yonlu baglanti)
            await db.query(
                'UPDATE blocks SET next_hash = $1 WHERE block_index = $2',
                [blockHash, lastBlock.block_index]
            );

            // Secmeni voters tablosuna kaydet (cift oy engeli icin)
            await db.query(
                'INSERT INTO voters (voter_hash) VALUES ($1)',
                [hashedVoter]
            );

            await db.query('COMMIT');
        } catch (txError) {
            // Hata olursa herseyi geri al
            await db.query('ROLLBACK');
            throw txError;
        }

        // --- 9) Basarili yanit don ---
        // 201 = Created: "Yeni kaynak olusturuldu"
        res.status(201).json({
            success: true,
            message: 'Oy basariyla kaydedildi',
            txId: txId,
            blockIndex: newIndex,
            blockHash: blockHash
        });

    } catch (err) {
        console.error('Oy verme hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

// =============================================================
// GET /api/results - Secim Sonuclari
// =============================================================
// Aday bazli oy sayimini doner.
// blocks tablosundaki data->candidateId alanini sayar,
// candidates tablosuyla birlestirip isim/parti bilgisini ekler.
//
// Response ornegi:
// {
//   totalVotes: 5,
//   results: [
//     { candidateId: 1, name: "...", party: "...", votes: 3, percentage: 60 },
//     { candidateId: 2, name: "...", party: "...", votes: 2, percentage: 40 }
//   ]
// }
// =============================================================
router.get('/results', async (req, res) => {
    try {
        // Tum adaylari getir
        const candidatesResult = await db.query(
            'SELECT id, name, party, color FROM candidates ORDER BY id'
        );

        // Blok bazli oy sayimi
        // data->>'candidateId': JSONB icindeki candidateId alanini metin olarak al
        // block_index > 0: Genesis blogu haric (cunku genesis'te oy verisi yok)
        // GROUP BY: Her candidateId icin ayri sayim
        const votesResult = await db.query(`
            SELECT data->>'candidateId' AS candidate_id, COUNT(*) AS votes
            FROM blocks
            WHERE block_index > 0
            GROUP BY data->>'candidateId'
        `);

        // Oy sayilarini bir map'e cevir: { "1": 3, "2": 2 }
        const voteMap = {};
        votesResult.rows.forEach(row => {
            voteMap[row.candidate_id] = parseInt(row.votes);
        });

        // Toplam oy sayisi
        const totalVotes = Object.values(voteMap).reduce((sum, v) => sum + v, 0);

        // Kayitli secmen sayisi (katilim orani hesabi icin)
        const allowedResult = await db.query('SELECT COUNT(*) FROM allowed_voters');
        const allowedVoters = parseInt(allowedResult.rows[0].count);

        // Sonuclari birlestir: aday bilgisi + oy sayisi + yuzde
        const results = candidatesResult.rows.map(candidate => {
            const votes = voteMap[String(candidate.id)] || 0;
            return {
                candidateId: candidate.id,
                name: candidate.name,
                party: candidate.party,
                color: candidate.color,
                votes: votes,
                percentage: totalVotes > 0
                    ? Math.round((votes / totalVotes) * 10000) / 100  // 2 ondalik basamak
                    : 0
            };
        });

        res.json({
            success: true,
            totalVotes: totalVotes,
            allowedVoters: allowedVoters,
            results: results
        });

    } catch (err) {
        console.error('Sonuc sorgulama hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

// =============================================================
// GET /api/chain - Blockchain Verisini Getir
// =============================================================
// Tum bloklari sirali olarak doner.
// Frontend bu veriyle blockchain'i gorsellestirebilir.
//
// Response: { blocks: [ {block_index: 0, ...}, {block_index: 1, ...} ] }
// =============================================================
router.get('/chain', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM blocks ORDER BY block_index ASC'
        );

        res.json({
            success: true,
            length: result.rows.length,
            blocks: result.rows
        });

    } catch (err) {
        console.error('Chain sorgulama hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

// =============================================================
// GET /api/chain/verify - Zincir Dogrulama
// =============================================================
// Blockchain'in butunlugunu kontrol eder:
// 1. Genesis blok gecerli mi?
// 2. Her blogun hash'i dogru mu? (icerikten yeniden hesapla)
// 3. Her blok onceki blogun hash'ine dogru referans veriyor mu?
//
// Bu, blockchain'in temel guvenlik ozelligi:
// Bir blok degistirilirse hash degisir -> sonraki bloklarin
// previousHash'i uyusmaz -> manipulasyon tespit edilir.
//
// Response: { valid: true } veya { valid: false, reason: "..." }
// =============================================================
router.get('/chain/verify', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM blocks ORDER BY block_index ASC'
        );

        const blocks = result.rows;

        // Bos zincir kontrolu
        if (blocks.length === 0) {
            return res.json({
                success: true,
                valid: false,
                reason: 'Blockchain bos - hic blok yok'
            });
        }

        // --- Genesis blok kontrolu ---
        const genesis = blocks[0];
        if (genesis.block_index !== 0 || genesis.previous_hash !== '0') {
            return res.json({
                success: true,
                valid: false,
                reason: 'Genesis blok gecersiz'
            });
        }

        // Genesis hash kontrolu
        const genesisCalcHash = calculateBlockHash(genesis);
        if (genesis.hash !== genesisCalcHash) {
            return res.json({
                success: true,
                valid: false,
                reason: 'Genesis blok hash uyumsuzlugu'
            });
        }

        // --- Zincir kontrolu ---
        for (let i = 1; i < blocks.length; i++) {
            const prevBlock = blocks[i - 1];
            const currentBlock = blocks[i];

            // Index sirasi dogru mu?
            if (currentBlock.block_index !== i) {
                return res.json({
                    success: true,
                    valid: false,
                    reason: `Blok ${i}: index hatasi (beklenen: ${i}, bulunan: ${currentBlock.block_index})`
                });
            }

            // previousHash baglantisi dogru mu?
            // Bu kontrol: "Bu blok gercekten onceki blogun devami mi?"
            if (currentBlock.previous_hash !== prevBlock.hash) {
                return res.json({
                    success: true,
                    valid: false,
                    reason: `Blok ${i}: previousHash uyumsuzlugu`
                });
            }

            // Hash yeniden hesaplandiginda ayni mi?
            // Bu kontrol: "Blogun icerigi degistirilmis mi?"
            const calcHash = calculateBlockHash(currentBlock);
            if (currentBlock.hash !== calcHash) {
                return res.json({
                    success: true,
                    valid: false,
                    reason: `Blok ${i}: hash uyumsuzlugu (icerik degistirilmis olabilir)`
                });
            }

            // nextHash pointer kontrolu (onceki blogun next_hash'i bu blogun hash'ine esit mi?)
            if (prevBlock.next_hash !== null && prevBlock.next_hash !== currentBlock.hash) {
                return res.json({
                    success: true,
                    valid: false,
                    reason: `Blok ${i - 1}: nextHash pointer uyumsuzlugu`
                });
            }
        }

        // Tum kontroller gecti!
        res.json({
            success: true,
            valid: true,
            blockCount: blocks.length,
            message: 'Blockchain butunlugu dogrulandi'
        });

    } catch (err) {
        console.error('Zincir dogrulama hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

// =============================================================
// GET /api/results/map - Il Bazli Harita Sonuclari
// =============================================================
// Harita icin il bazli oy dagilimini doner.
// blocks tablosundaki provinceCode ve candidateId alanlarina gore
// GROUP BY yaparak her il icin aday bazli oy sayisi hesaplar.
//
// Response ornegi:
// {
//   "success": true,
//   "provinces": {
//     "6":  { "1": 120, "2": 85 },
//     "34": { "1": 500, "2": 430 }
//   }
// }
// =============================================================
router.get('/results/map', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT data->>'provinceCode' AS province_code,
                   data->>'candidateId'  AS candidate_id,
                   COUNT(*)              AS votes
            FROM blocks
            WHERE block_index > 0
              AND data->>'provinceCode' IS NOT NULL
            GROUP BY data->>'provinceCode', data->>'candidateId'
        `);

        // Sonuclari { provinceCode: { candidateId: votes } } formatina cevir
        const provinces = {};
        result.rows.forEach(row => {
            const pc = row.province_code;
            const cid = row.candidate_id;
            if (!provinces[pc]) provinces[pc] = {};
            provinces[pc][cid] = parseInt(row.votes);
        });

        res.json({
            success: true,
            provinces: provinces
        });
    } catch (err) {
        console.error('Harita sonuclari hatasi:', err.message);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatasi: ' + err.message
        });
    }
});

module.exports = router;
