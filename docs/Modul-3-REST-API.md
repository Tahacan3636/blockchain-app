# Modul 3: REST API Katmani

## Bu Modulde Ne Yaptik?

Frontend ile backend arasindaki kopruyu kurduk: **API endpoint'leri**.
Artik tarayicidan sunucuya istek atabilir, oy verebilir, sonuclari gorebilir
ve blockchain'i sorgulayabiliriz.

## Olusturulan Dosyalar

| Dosya | Aciklama |
|-------|----------|
| `utils/blockchain.js` | Sunucu tarafinda hash hesaplama fonksiyonlari |
| `routes/api.js` | 4 API endpoint (vote, results, chain, verify) |
| `server.js` (guncellendi) | Route'lari dahil etti |
| `db/init.js` (guncellendi) | Genesis block otomatik olusturma |

## Proje Yapisi (Modul 3 Sonrasi)

```
seng_project_v2/
  server.js              <- Route'lari dahil ediyor
  routes/
    api.js               <- Tum API endpoint'leri
  utils/
    blockchain.js        <- Hash hesaplama (sha256, voterHash, vb.)
  db/
    index.js             <- Connection pool
    init.js              <- Tablolar + genesis block
  public/
    index.html
    js/blockchain.js     <- Client-side (ileride sunucuya baglanacak)
  docs/
    Modul-1-...md
    Modul-2-...md
    Modul-3-REST-API.md  <- Bu dosya
```

## Kavramlar

### REST API Nedir?
- **REST** = Representational State Transfer
- HTTP metodlari ile veri alip gonderme standardi
- **GET**: Veri oku (sonuclari getir, zinciri getir)
- **POST**: Yeni veri olustur (oy ver)
- Veri formati: **JSON**

### Express Router
```js
const router = express.Router();
router.get('/results', async (req, res) => { ... });
module.exports = router;

// server.js'de:
app.use('/api', router);  // '/results' -> '/api/results' olur
```

Router, endpoint'leri ayri dosyalarda tutmamizi saglar. Boylece server.js sismez.

### Transaction (Veritabani Islemi)
```js
await db.query('BEGIN');
try {
    await db.query('INSERT INTO blocks ...');
    await db.query('INSERT INTO voters ...');
    await db.query('COMMIT');    // Her sey basarili -> kaydet
} catch (err) {
    await db.query('ROLLBACK');  // Hata -> herseyi geri al
}
```

Transaction ile birden fazla islem ya **hepsi basarili** olur ya da **hicbiri** olmaz.
Ornegin: blocks'a yazildi ama voters'a yazilamadi -> tutarsiz veri olusmaz.

### Hash Hesaplamanin Sunucu Tarafina Tasinmasi
- Frontend'te: `crypto.subtle.digest()` (tarayici API'si, async)
- Backend'te: `crypto.createHash('sha256')` (Node.js, sync)
- **Ayni format**: `index|timestamp|canonicalStringify(data)|previousHash`
- **Neden sunucu tarafinda?** Client-side hash manipule edilebilir

### canonicalStringify
JSON'u deterministik hale getirir:
```js
JSON.stringify({b:2, a:1})  // '{"b":2,"a":1}'
JSON.stringify({a:1, b:2})  // '{"a":1,"b":2}'  <- FARKLI!

canonicalStringify({b:2, a:1})  // '{"a":1,"b":2}'  <- her zaman ayni
canonicalStringify({a:1, b:2})  // '{"a":1,"b":2}'  <- her zaman ayni
```

Hash icin ayni input -> ayni output sart. canonicalStringify bunu garanti eder.

## API Endpoint'leri

### POST /api/vote - Oy Verme
```bash
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d '{"voterId": "12345", "candidateId": 1}'
```

Adimlar:
1. voterId + candidateId kontrolu
2. candidateId veritabaninda var mi?
3. voterId -> sha256 hash (gizlilik)
4. Daha once oy verilmis mi? (voters tablosu)
5. Son blogu al (previousHash icin)
6. Yeni blok olustur + hash hesapla
7. Transaction ile blocks + voters'a kaydet
8. txId + blockHash don

HTTP Durum Kodlari:
- `201` Created: Oy basariyla kaydedildi
- `400` Bad Request: Eksik/gecersiz veri
- `409` Conflict: Zaten oy kullanmis
- `500` Server Error: Sunucu hatasi

### GET /api/results - Secim Sonuclari
```bash
curl http://localhost:3000/api/results
```

SQL sorgusu:
```sql
SELECT data->>'candidateId' AS candidate_id, COUNT(*) AS votes
FROM blocks WHERE block_index > 0
GROUP BY data->>'candidateId'
```

`data->>'candidateId'`: JSONB icinden string olarak degeri al.

### GET /api/chain - Blockchain Verisi
```bash
curl http://localhost:3000/api/chain
```

Tum bloklari sirali doner. Frontend bunu gorsellestirebilir.

### GET /api/chain/verify - Zincir Dogrulama
```bash
curl http://localhost:3000/api/chain/verify
```

Kontroller:
1. Genesis blok gecerli mi? (index=0, previousHash="0")
2. Her blogun hash'i icerikten yeniden hesaplandginda ayni mi?
3. Her blogun previousHash'i onceki blogun hash'ine esit mi?

## Test Adimlari

```bash
# 1. Veritabanini hazirla (genesis block dahil)
npm run db:init

# 2. Sunucuyu baslat
npm start

# 3. Health check
curl http://localhost:3000/api/health

# 4. Oy ver
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d '{"voterId": "11111", "candidateId": 1}'

# 5. Ikinci oy
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d '{"voterId": "22222", "candidateId": 2}'

# 6. Cift oy denemesi (hata vermeli)
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d '{"voterId": "11111", "candidateId": 2}'

# 7. Sonuclari gor
curl http://localhost:3000/api/results

# 8. Blockchain'i gor
curl http://localhost:3000/api/chain

# 9. Zinciri dogrula
curl http://localhost:3000/api/chain/verify

# 10. Veritabanini kontrol et
psql -U tahacan -d blockchain_voting -c "SELECT * FROM blocks;"
psql -U tahacan -d blockchain_voting -c "SELECT * FROM voters;"
```

## Onemli Noktalar

- **Hash tutarliligi**: Frontend ve backend'teki canonicalStringify AYNI olmali
- **Genesis block**: Ilk blok olmazsa oy verilemez (previousHash referansi yok)
- **Transaction**: Birden fazla DB islemi atomik olmali (BEGIN/COMMIT/ROLLBACK)
- **HTTP durum kodlari**: 201=olusturuldu, 400=hatali istek, 409=cakisma, 500=sunucu hatasi
- **Gizlilik**: Gercek voterId saklanmaz, sadece hash'i tutulur
