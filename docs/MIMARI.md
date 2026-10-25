# Mimari ve Tasarım Desenleri

Bu doküman projedeki her dosyanın **tek görevini** ve kullanılan **tasarım desenlerini** gösterir.

---

## 1. Klasör Haritası (her dosya = tek sorumluluk)

```
Backend/
├── server.js                 Giriş noktası: veritabanını hazırla, sunucuyu başlat
├── app.js                    Express uygulamasını kur (middleware + route'lar)
├── config.js                 Ortam değişkenlerini oku ve kontrol et
│
├── routes/                   ── 1. KATMAN: HTTP ──
│   ├── public.js             Oy, sonuçlar, zincir, doğrulama, makbuz
│   ├── auth.js               Admin girişi (JWT üretir)
│   └── admin.js              Seçmen listesi, istatistik, sıfırlama
│
├── services/                 ── 2. KATMAN: İŞ MANTIĞI ──
│   ├── voteService.js        Oy verme kuralları
│   ├── chainService.js       Blok ekleme, zincir doğrulama, makbuz
│   ├── voterService.js       Seçmen listesi ve oy kodları
│   └── resultService.js      Sonuç ve istatistik hesapları
│
├── db/                       ── 3. KATMAN: VERİ ──
│   ├── index.js              Bağlantı havuzu + transaction yardımcısı
│   └── init.js               Tablolar ve başlangıç verileri
│
├── middleware/               İstek route'a ulaşmadan önceki kontrol noktaları
│   ├── auth.js               JWT doğrulama + rol kontrolü
│   ├── rateLimit.js          Hız sınırlama
│   └── errorHandler.js       Merkezi hata yakalayıcı
│
├── utils/
│   ├── crypto.js             SHA-256, HMAC, blok hash'i, oy kodu (saf fonksiyonlar)
│   └── errors.js             AppError sınıfı + asyncHandler
│
└── tests/                    unit/ (veritabanısız) + integration/ (gerçek API)

Frontend/public/
├── index.html                Ana sayfa (sadece HTML iskeleti)
├── admin.html                Admin paneli (sadece HTML iskeleti)
├── css/style.css             Özel stiller
└── js/
    ├── config.js             Backend adresi
    ├── i18n.js               Dil desteği (Türkçe / İngilizce sözlük)
    ├── api.js                Backend ile konuşan TEK dosya
    ├── app.js                Ana sayfa mantığı
    ├── admin.js              Admin paneli mantığı
    └── turkey-map.js         Türkiye haritası
```

---

## 2. Katmanlı Mimari (Layered Architecture)

```
İstek ──► routes/  ──►  services/  ──►  db/  ──► PostgreSQL
          (HTTP)       (kurallar)      (SQL)
```

**Kural:** Her katman sadece bir altındakini çağırır.
- `routes` → `req`/`res` bilir, iş kuralı bilmez.
- `services` → iş kuralı bilir, HTTP bilmez (içinde `req`/`res` yok).
- `db` → sadece veritabanı bağlantısı.

**Neden?** Bir katmanı değiştirmek diğerlerini bozmaz. Örneğin oy kuralları değişirse sadece `voteService.js` değişir.

---

## 3. Kullanılan Tasarım Desenleri

| Desen | Nerede | Ne işe yarıyor |
|---|---|---|
| **Middleware zinciri** (Chain of Responsibility) | `app.js`, `routes/admin.js` → `router.use(authenticateToken, requireRole('admin'))` | İstek sırayla kontrol noktalarından geçer; biri reddederse zincir durur |
| **Fabrika** (Factory) | `requireRole('admin')`, `createLimiter(...)` | Parametreye göre yeni bir middleware üretir |
| **Singleton** | `db/index.js` (havuz), `config.js` | Node.js `require` önbelleği sayesinde tüm uygulama tek bir bağlantı havuzunu ve tek bir ayar nesnesini paylaşır |
| **Facade** (Cephe) | `Frontend/js/api.js`, `db.withTransaction()` | Karmaşık işi tek basit arayüzün arkasına saklar (fetch detayları / BEGIN-COMMIT-ROLLBACK) |
| **Unit of Work** (Transaction) | `db.withTransaction()` | Birden çok sorgu ya hep birlikte kalıcı olur ya hiç olmaz |
| **Strategy / Callback** | `chainService.appendBlock(client, buildData)` | Zincir mantığı ortak; blok verisini üretme işi dışarıdan verilen fonksiyona bırakılır |
| **Observer** (Gözlemci) | `js/i18n.js` → `I18n.onChange(fn)` | Dil değişince abone olan modüller (sonuçlar, harita, admin) haberdar edilir ve metinlerini yeniden çizer |
| **Module Pattern** (IIFE) | `js/app.js`, `js/admin.js`, `js/turkey-map.js`, `js/i18n.js` | Değişkenler dışarı sızmaz; sadece gereken nesne (`App`, `AdminApp`, `TurkeyMap`) dışarı açılır |
| **Merkezi Hata Yönetimi** | `utils/errors.js` + `middleware/errorHandler.js` | Tüm hatalar tek yerde ele alınır; beklenen hata kullanıcıya, iç detay sadece loga |
| **Saf Fonksiyon** (Pure Function) | `utils/crypto.js`, `chainService.validateChain()` | Veritabanına dokunmaz, aynı girdi → aynı çıktı; bu yüzden kolay test edilir |
| **Fail Fast** | `config.js`, `server.js` | Gizli anahtar eksikse ya da veritabanı hazırlanamazsa sunucu hiç açılmaz |

---

## 4. SOLID ve Temiz Kod İlkeleri

- **Tek Sorumluluk (S):** Her dosyanın tek bir işi var (yukarıdaki harita).
- **DRY (Kendini Tekrarlama):** Genesis blok tek yerde üretilir (`buildGenesisBlock`), backend istekleri tek dosyada (`api.js`).
- **Bağımlılık yönü:** Üst katman alt katmana bağlıdır, tersi asla.
- **Test edilebilirlik:** `app.js` ile `server.js` ayrı olduğu için testler port açmadan uygulamayı kullanır.

---

## 5. Bir Oyun Yolculuğu (uçtan uca)

```
[Tarayıcı] app.js: App.submitVote()
    │  api.js: API.vote(no, kod, aday)  ── POST /api/vote ──►
[Backend]
    │  rateLimit.js: voteLimiter            (çok deneme mi?)
    │  routes/public.js                     (body'den veriyi al)
    │  voteService.castVote()               (format kontrolleri)
    │  db.withTransaction ┐
    │     ├─ seçmeni bul + kilitle (FOR UPDATE)
    │     ├─ oy kodu doğru mu? (HMAC karşılaştırma)
    │     ├─ daha önce oy vermiş mi? (has_voted)
    │     ├─ chainService.appendBlock()   (zincir kilidi → son blok → hash → ekle)
    │     └─ has_voted = TRUE
    │  COMMIT ┘
    ◄── 201 { txId, blockIndex, blockHash }
[Tarayıcı] makbuz (txId) ekranda gösterilir
```
