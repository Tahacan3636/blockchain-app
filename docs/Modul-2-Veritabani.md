# Modül 2: Veritabanı (PostgreSQL)

**Ders:** Yazılım Mühendisliği
**Proje:** Blockchain Tabanlı Oylama Sistemi
**Tarih:** 23 Şubat 2026
**Hazırlayan:** Taha Can

---

## 1. Bu Modülde Ne Yaptık?

- PostgreSQL veritabanını kurduk ve yapılandırdık
- 3 tablo tasarladık (candidates, voters, blocks)
- Node.js'ten veritabanına bağlantı kurduk (pg kütüphanesi)
- Otomatik tablo oluşturma scripti yazdık
- Health check endpoint'ine veritabanı kontrolü ekledik

---

## 2. Temel Kavramlar

### 2.1 Veritabanı Nedir?

Veritabanı, verileri **düzenli ve kalıcı** olarak saklayan bir sistemdir. Excel'e benzer ama çok daha güçlüdür:

```
Excel                          Veritabanı (PostgreSQL)
────────────────               ────────────────────────
Dosya                          Database (veritabanı)
Sayfa (sheet)                  Table (tablo)
Satır                          Row (kayıt)
Sütun                          Column (alan)
Dosyayı aç → veri gör         SQL sorgusu yaz → veri gör
```

### 2.2 PostgreSQL Nedir?

PostgreSQL, en popüler **açık kaynak ilişkisel veritabanı** yönetim sistemidir (RDBMS).

**Neden "ilişkisel"?** Tablolar birbirleriyle **ilişki** kurabilir. Örneğin: bir oy (votes tablosu) bir adaya (candidates tablosu) bağlıdır.

**Nerede kullanılır?**
- Instagram, Spotify, Netflix, Uber → hepsi PostgreSQL kullanır
- Startup'lar, şirketler, devlet projeleri
- Gerçek dünyada en çok tercih edilen veritabanlarından biri

### 2.3 SQL Nedir?

SQL (Structured Query Language) = Veritabanıyla konuşmak için kullanılan dil.

```sql
-- Tablo oluştur
CREATE TABLE candidates (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    party VARCHAR(100) NOT NULL
);

-- Veri ekle
INSERT INTO candidates (name, party) VALUES ('John Doe', 'Yenilikçiler');

-- Veri sorgula
SELECT * FROM candidates;              -- Tüm adayları getir
SELECT name FROM candidates WHERE id = 1;  -- Sadece 1 nolu adayın adını getir

-- Veri güncelle
UPDATE candidates SET name = 'Jane Doe' WHERE id = 1;

-- Veri sil
DELETE FROM candidates WHERE id = 1;
```

**Temel SQL komutları:**

| Komut | Ne Yapar | Örnek |
|-------|---------|-------|
| `CREATE TABLE` | Yeni tablo oluşturur | `CREATE TABLE users (...)` |
| `INSERT INTO` | Yeni kayıt ekler | `INSERT INTO users VALUES (...)` |
| `SELECT` | Veri sorgular/getirir | `SELECT * FROM users` |
| `UPDATE` | Mevcut veriyi günceller | `UPDATE users SET name='...'` |
| `DELETE` | Veri siler | `DELETE FROM users WHERE id=1` |
| `DROP TABLE` | Tabloyu tamamen siler | `DROP TABLE users` |

---

## 3. Veri Tipleri

PostgreSQL'de her sütunun bir **tipi** vardır:

| Tip | Açıklama | Örnek |
|-----|---------|-------|
| `SERIAL` | Otomatik artan tam sayı (1, 2, 3...) | ID'ler için |
| `INTEGER` | Tam sayı | Blok indexi |
| `VARCHAR(n)` | Maksimum n karakter uzunluğunda metin | İsim, parti adı |
| `TEXT` | Sınırsız uzunlukta metin | Açıklama, notlar |
| `TIMESTAMP` | Tarih + saat | 2026-02-23 14:30:00 |
| `BOOLEAN` | true / false | Aktif mi? |
| `JSONB` | JSON verisi (esnek yapı) | Blok data'sı |

### JSONB Nedir?

PostgreSQL'in süper gücü! Bir sütuna JSON formatında veri saklayabilirsin:

```sql
-- JSONB sütununa veri ekleme
INSERT INTO blocks (data) VALUES ('{"voterHash": "abc123", "candidateId": "left"}');

-- JSONB içinden veri sorgulama
SELECT data->>'candidateId' FROM blocks;  -- "left" döner
```

Normal sütunlarda her alan önceden tanımlanmalıdır. JSONB ile esnek yapıda veri saklayabilirsin.

---

## 4. Kısıtlamalar (Constraints)

Veritabanının "kuralları" — veri bütünlüğünü korur:

| Kısıtlama | Ne Yapar | Neden Önemli |
|-----------|---------|-------------|
| `PRIMARY KEY` | Her satırı benzersiz tanımlar | İki aynı ID olamaz |
| `UNIQUE` | Aynı değer iki kez eklenemez | Aynı kişi iki kez oy veremez |
| `NOT NULL` | Bu alan boş bırakılamaz | Adaysız oy olamaz |
| `DEFAULT` | Değer verilmezse otomatik atar | `DEFAULT NOW()` → anlık zaman |

**Gerçek örnek — voters tablosunda:**

```sql
voter_hash VARCHAR(64) UNIQUE NOT NULL
```

Bu satır şunu diyor:
- `VARCHAR(64)` → Maksimum 64 karakter (SHA-256 hash = tam 64 karakter)
- `UNIQUE` → Aynı hash iki kez eklenemez (çift oy engeli!)
- `NOT NULL` → Boş bırakılamaz (kimliksiz oy yok!)

---

## 5. Tablo Tasarımımız

### candidates (Adaylar)

```
┌────┬───────────────────┬──────────────┬───────┐
│ id │ name              │ party        │ color │
├────┼───────────────────┼──────────────┼───────┤
│ 1  │ Arif Furkan MENDİ │ Yenilikçiler │ blue  │
│ 2  │ Satoshi NAKAMOTO  │ Gelenekçiler │ red   │
└────┴───────────────────┴──────────────┴───────┘
```

### voters (Seçmenler)

```
┌────┬──────────────────────────────────────┬─────────────────────┐
│ id │ voter_hash                           │ voted_at            │
├────┼──────────────────────────────────────┼─────────────────────┤
│ 1  │ a3f2b8c1d4e5f6...  (SHA-256 hash)   │ 2026-02-23 14:30:00 │
│ 2  │ b7d1e9f3a2c4b8...  (SHA-256 hash)   │ 2026-02-23 14:31:00 │
└────┴──────────────────────────────────────┴─────────────────────┘
```

**Neden gerçek kimlik değil de hash saklıyoruz?** Gizlilik! Veritabanı sızsa bile kimsenin kimliği ortaya çıkmaz. Hash'ten geriye dönerek kimliği bulmak matematiksel olarak imkansızdır.

### blocks (Blockchain Blokları)

```
┌────┬─────────────┬─────────────────────┬─────────────────────┬──────────────┬───────────────┬───────────┐
│ id │ block_index │ timestamp           │ data (JSONB)        │ hash         │ previous_hash │ next_hash │
├────┼─────────────┼─────────────────────┼─────────────────────┼──────────────┼───────────────┼───────────┤
│ 1  │ 0           │ 2026-02-23 14:00:00 │ {"message":"Genesis"}│ 9f2a...      │ 0             │ b3c1...   │
│ 2  │ 1           │ 2026-02-23 14:30:00 │ {"voterHash":"a3f2..│ b3c1...      │ 9f2a...       │ NULL      │
└────┴─────────────┴─────────────────────┴─────────────────────┴──────────────┴───────────────┴───────────┘
```

---

## 6. Connection Pool (Bağlantı Havuzu)

### Nedir?

Veritabanına her sorgu için yeni bağlantı açıp kapatmak yavaştır. Pool, birkaç bağlantıyı **hazır tutar** ve ihtiyaç oldukça paylaştırır.

```
POOL OLMADAN (yavaş):
  Sorgu 1 → Bağlantı aç → Sorgu çalıştır → Bağlantı kapat
  Sorgu 2 → Bağlantı aç → Sorgu çalıştır → Bağlantı kapat
  Sorgu 3 → Bağlantı aç → Sorgu çalıştır → Bağlantı kapat

POOL İLE (hızlı):
  ┌──────────────────────┐
  │   Connection Pool    │
  │  ┌────┐ ┌────┐ ┌────┐│     Sorgu 1 → Bağlantı A'yı al → çalıştır → geri ver
  │  │ A  │ │ B  │ │ C  ││     Sorgu 2 → Bağlantı B'yi al → çalıştır → geri ver
  │  └────┘ └────┘ └────┘│     Sorgu 3 → Bağlantı A'yı al → çalıştır → geri ver
  └──────────────────────┘
```

### Kodda nasıl kullanılıyor?

```javascript
// db/index.js - Havuzu oluştur
const { Pool } = require('pg');
const pool = new Pool({
    user: 'tahacan',
    password: 'taha123',
    host: 'localhost',
    port: 5432,
    database: 'blockchain_voting'
});

// Dışarıya query fonksiyonu aç
module.exports = {
    query: (text, params) => pool.query(text, params)
};
```

```javascript
// Başka bir dosyadan kullanım
const db = require('./db');

// SQL sorgusu çalıştır
const result = await db.query('SELECT * FROM candidates');
console.log(result.rows);  // [{ id: 1, name: 'Arif...', ... }, ...]
```

---

## 7. db/init.js — Tablo Oluşturma Scripti

Bu script `npm run db:init` ile çalıştırılır ve şunları yapar:

```
1. candidates tablosunu oluştur (IF NOT EXISTS)
2. voters tablosunu oluştur (IF NOT EXISTS)
3. blocks tablosunu oluştur (IF NOT EXISTS)
4. Başlangıç adaylarını ekle (zaten yoksa)
5. Mevcut tabloları listele (doğrulama)
6. Bağlantıyı kapat
```

**`IF NOT EXISTS` neden önemli?** Scripti birden fazla kez çalıştırsan bile hata vermez. Tablo zaten varsa atlar. Bu, **idempotent** (tekrarlanabilir) tasarım denir — profesyonel yazılımda önemli bir prensiptir.

---

## 8. server.js'e Eklenen Veritabanı Kontrolü

```javascript
app.get('/api/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({
            status: 'ok',
            database: 'connected',      // Veritabanı bağlı
            dbTime: result.rows[0].now   // Veritabanı saati
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',    // Veritabanı bağlı değil
            error: err.message
        });
    }
});
```

**`async/await` nedir?** Veritabanı sorguları zaman alır (ağ üzerinden gider-gelir). `await` demek: "Bu işlem bitene kadar bekle, sonra devam et." `async` ise fonksiyonun içinde `await` kullanabileceğini belirtir.

**`try/catch` nedir?** Hata yönetimi. `try` bloğundaki kod çalışırken hata olursa, program çökmez — `catch` bloğu devreye girer.

---

## 9. Proje Yapısı (Güncel)

```
seng_project_v2/
│
├── server.js              → Sunucu + API (artık veritabanına bağlı)
├── package.json           → Proje bilgileri (express + pg bağımlılıkları)
├── .gitignore             → Git'e yüklenmeyecekler
│
├── db/                    → Veritabanı katmanı
│   ├── index.js           → Bağlantı havuzu (Connection Pool)
│   └── init.js            → Tablo oluşturma scripti
│
├── public/                → Frontend dosyaları
│   ├── index.html
│   ├── js/blockchain.js
│   └── images/
│
└── docs/                  → Dökümanlar
```

---

## 10. Önemli Komutlar

```bash
# PostgreSQL
sudo service postgresql start       # PostgreSQL servisini başlat
sudo service postgresql stop        # Durdur
sudo service postgresql status      # Durum kontrolü
psql -d blockchain_voting            # Veritabanına bağlan
\q                                   # psql'den çık
\dt                                  # Tabloları listele
\d candidates                        # Tablo yapısını göster

# Proje
npm run db:init                      # Tabloları oluştur
npm start                            # Sunucuyu başlat
```

---

## 11. Kontrol Listesi

- [x] PostgreSQL'in ne olduğunu ve neden kullanıldığını açıklayabilmek
- [x] Temel SQL komutlarını bilmek (CREATE, INSERT, SELECT)
- [x] Veri tiplerini tanımak (SERIAL, VARCHAR, TIMESTAMP, JSONB)
- [x] PRIMARY KEY, UNIQUE, NOT NULL kısıtlamalarını anlamak
- [x] Connection Pool kavramını açıklayabilmek
- [x] db.query() ile veritabanına sorgu atabilmek
- [x] async/await ve try/catch kullanımını anlamak
