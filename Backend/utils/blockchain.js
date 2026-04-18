// =============================================================
// utils/blockchain.js - Sunucu Tarafinda Blockchain Yardimci Fonksiyonlari
// =============================================================
// Frontend'teki (public/js/blockchain.js) hash hesaplama mantigini
// Node.js tarafina tasiyoruz. Boylece hash islemleri guvenli tarafta yapilir.
//
// Neden sunucu tarafinda?
// - Client-side hash manipule edilebilir (tarayici konsolundan degistirilebilir)
// - Sunucu tarafinda yapilan hash hesaplamalari guvenilirdir
// - Node.js'in dahili "crypto" modulu hizli ve guvenlidir
// =============================================================

const crypto = require('crypto');

// ---------- canonicalStringify ----------
// JSON objesini deterministik (her seferinde ayni) bir string'e cevirir.
// Neden gerekli? JSON.stringify({ a:1, b:2 }) ve JSON.stringify({ b:2, a:1 })
// farkli string uretir ama mantiken ayni veridir.
// canonicalStringify ise key'leri siralar, boylece ayni veri -> ayni string -> ayni hash.
//
// ONEMLI: Bu fonksiyon frontend'teki ile BIREBIR AYNI olmali!
// Aksi halde ayni blok icin farkli hash uretilir ve zincir bozulur.
function canonicalStringify(value) {
    if (value === null || value === undefined) return 'null';

    const t = typeof value;
    if (t === 'number' || t === 'boolean') return String(value);
    if (t === 'string') return JSON.stringify(value);

    if (Array.isArray(value)) {
        return '[' + value.map(canonicalStringify).join(',') + ']';
    }

    // object: key'leri alfabetik sirala
    const keys = Object.keys(value).sort();
    const props = keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
    return '{' + props.join(',') + '}';
}

// ---------- sha256 ----------
// Verilen string'in SHA-256 hash'ini hesaplar.
// Cikti: 64 karakterlik hexadecimal string (ornek: "a1b2c3d4...")
//
// Frontend'te: crypto.subtle.digest("SHA-256", data) kullaniliyordu (async)
// Backend'te:  crypto.createHash('sha256') kulllaniyoruz (sync - daha basit)
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

// ---------- voterHash ----------
// Secmen kimligini (TC no, ogrenci no vb.) hashleyerek gizler.
// Veritabaninda gercek kimlik SAKLANMAZ, sadece hash'i tutulur.
// Bu sayede kim oy verdi bilinir (cift oy engeli) ama kimligi gizli kalir.
//
// Frontend'teki voterCommitment() fonksiyonunun karsitigi.
function voterHash(voterId) {
    return sha256(String(voterId));
}

// ---------- calculateBlockHash ----------
// Bir blogun hash'ini hesaplar.
// Hash hesabina dahil olan alanlar: index, timestamp, data, previousHash
// nextHash dahil DEGILDIR (cunku sonradan eklenir)
//
// Format: "index|timestamp|canonicalStringify(data)|previousHash"
// Bu format frontend'teki Block.calculateHash() ile AYNIDIR.
function calculateBlockHash(block) {
    const payload =
        String(block.block_index) + '|' +
        block.timestamp + '|' +
        canonicalStringify(block.data) + '|' +
        block.previous_hash;

    return sha256(payload);
}

// ---------- generateTxId ----------
// Her oy islemi icin benzersiz bir Transaction ID olusturur.
// TxId sayesinde secmen oyunun kaydedildigini dogrulayabilir.
//
// Format: sha256("TX|timestamp|voterHash|candidateId|prevHash")
// Frontend'teki txId hesabinin AYNISI.
function generateTxId(timestamp, voterHashVal, candidateId, prevHash) {
    const input = 'TX|' + timestamp + '|' + voterHashVal + '|' + candidateId + '|' + prevHash;
    return sha256(input);
}

// Fonksiyonlari disari ac
module.exports = {
    sha256,
    voterHash,
    calculateBlockHash,
    generateTxId,
    canonicalStringify
};
