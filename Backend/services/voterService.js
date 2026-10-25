// =============================================================
// services/voterService.js - Secmen Listesi Yonetimi
// =============================================================
// Admin Excel'den secmen listesini yukler. Her ogrenciye tek
// kullanimlik bir OY KODU uretilir. Kodun kendisi veritabaninda
// SAKLANMAZ, sadece HMAC hash'i saklanir. Duz kodlar sadece bir
// kez, yukleme cevabinda admin'e doner (dagitim listesi icin).
// =============================================================

const db = require('../db');
const chainService = require('./chainService');
const { generateVoterCode, voterCodeHash } = require('../utils/crypto');
const { AppError } = require('../utils/errors');

function validateVoterList(voters) {
    if (!Array.isArray(voters) || voters.length === 0) {
        throw new AppError(400, 'Secmen listesi bos olamaz');
    }

    const unique = new Map();
    voters.forEach((v, i) => {
        const studentNumber = String((v && v.studentNumber) || '').trim();
        const provinceCode = parseInt(v && v.provinceCode, 10);

        if (!/^\d{9}$/.test(studentNumber)) {
            throw new AppError(400, `Satir ${i + 1}: Gecersiz ogrenci numarasi (9 haneli olmali)`);
        }
        if (isNaN(provinceCode) || provinceCode < 1 || provinceCode > 81) {
            throw new AppError(400, `Satir ${i + 1}: Gecersiz il kodu (1-81 arasi olmali)`);
        }
        unique.set(studentNumber, provinceCode); // tekrar eden numaralar tek kayit olur
    });

    return [...unique].map(([studentNumber, provinceCode]) => ({ studentNumber, provinceCode }));
}

// Yeni liste = yeni secim: eski liste ve zincir sifirlanir.
async function importVoters(rawVoters) {
    const voters = validateVoterList(rawVoters).map(v => ({ ...v, code: generateVoterCode() }));

    await db.withTransaction(async (client) => {
        await client.query('TRUNCATE allowed_voters RESTART IDENTITY');
        // unnest: binlerce satiri tek sorguda ekler
        await client.query(
            `INSERT INTO allowed_voters (student_number, province_code, code_hash)
             SELECT * FROM unnest($1::text[], $2::int[], $3::text[])`,
            [
                voters.map(v => v.studentNumber),
                voters.map(v => v.provinceCode),
                voters.map(v => voterCodeHash(v.code))
            ]
        );
        await chainService.resetChain(client);
    });

    return voters;
}

async function listVoters() {
    const result = await db.query(
        `SELECT id, student_number, province_code, has_voted, imported_at
         FROM allowed_voters ORDER BY id ASC`
    );
    return result.rows;
}

async function clearVoters() {
    await db.withTransaction(async (client) => {
        await client.query('TRUNCATE allowed_voters RESTART IDENTITY');
        await chainService.resetChain(client);
    });
}

// Liste korunur, oylar silinir, herkes tekrar oy kullanabilir.
async function resetElection() {
    await db.withTransaction(async (client) => {
        await client.query('UPDATE allowed_voters SET has_voted = FALSE');
        await chainService.resetChain(client);
    });
}

module.exports = { validateVoterList, importVoters, listVoters, clearVoters, resetElection };
