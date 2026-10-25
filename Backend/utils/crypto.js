// =============================================================
// utils/crypto.js - Kriptografik Yardimci Fonksiyonlar
// =============================================================
// Bu dosyadaki fonksiyonlar "saf" (pure) fonksiyonlardir:
// veritabanina dokunmaz, ayni girdiye her zaman ayni ciktiyi verir.
// Bu sayede birim testleri cok kolay yazilir (bkz. tests/unit).
// =============================================================

const crypto = require('crypto');
const config = require('../config');

// ---------- sha256 ----------
// Herhangi bir metni 64 karakterlik parmak izine cevirir.
// Tek yonludur: hash'ten orijinal metne geri donulemez.
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

// ---------- hmacSha256 ----------
// HMAC = gizli anahtarli hash. Neden duz SHA-256 degil?
// Ogrenci numarasi 9 haneli -> sadece 1 milyar ihtimal var.
// Duz SHA-256 ile bir saldirgan hepsini dakikalar icinde deneyip
// hash'ten numarayi bulabilir. HMAC'te sunucudaki gizli anahtar
// bilinmeden bu deneme yapilamaz.
function hmacSha256(input) {
    return crypto.createHmac('sha256', config.voterSecret).update(String(input)).digest('hex');
}

// Secmen kimligini gizler: blokta ogrenci numarasi yerine bu deger durur.
function voterHash(studentNumber) {
    return hmacSha256('voter:' + studentNumber);
}

// Oy kodunu saklamak icin hash (kodun kendisi veritabaninda tutulmaz).
function voterCodeHash(code) {
    return hmacSha256('code:' + normalizeVoterCode(code));
}

// ---------- canonicalStringify ----------
// JSON'u deterministik stringe cevirir (anahtarlar alfabetik sirali).
// {a:1,b:2} ile {b:2,a:1} ayni stringi -> ayni hash'i uretir.
function canonicalStringify(value) {
    if (value === null || value === undefined) return 'null';

    const t = typeof value;
    if (t === 'number' || t === 'boolean') return String(value);
    if (t === 'string') return JSON.stringify(value);

    if (Array.isArray(value)) {
        return '[' + value.map(canonicalStringify).join(',') + ']';
    }

    const keys = Object.keys(value).sort();
    const props = keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
    return '{' + props.join(',') + '}';
}

// ---------- calculateBlockHash ----------
// Blok hash'i = SHA-256( index | timestamp | data | previousHash )
// previousHash hash'e dahil oldugu icin her blok bir oncekine kilitlenir.
function calculateBlockHash(block) {
    const payload =
        String(block.block_index) + '|' +
        block.timestamp + '|' +
        canonicalStringify(block.data) + '|' +
        block.previous_hash;

    return sha256(payload);
}

// ---------- generateTxId ----------
// Her oy icin benzersiz islem numarasi (secmenin makbuzu).
function generateTxId(timestamp, voterHashVal, candidateId, prevHash) {
    return sha256('TX|' + timestamp + '|' + voterHashVal + '|' + candidateId + '|' + prevHash);
}

// ---------- Oy kodu ----------
// Karistirilabilen karakterler (0/O, 1/I/L) cikarildi.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Kriptografik olarak guvenli rastgele 8 karakterlik kod: "K7M4-P9QX"
function generateVoterCode() {
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    return code.slice(0, 4) + '-' + code.slice(4);
}

// Kullanici "k7m4 p9qx" yazsa bile "K7M4P9QX" olarak karsilastirilir.
function normalizeVoterCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

module.exports = {
    sha256,
    hmacSha256,
    voterHash,
    voterCodeHash,
    canonicalStringify,
    calculateBlockHash,
    generateTxId,
    generateVoterCode,
    normalizeVoterCode
};
