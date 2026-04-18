# Modül 6: Admin Paneli (Authorization & RBAC)

## Bu Modülde Ne Öğrendik?

Bu modülde admin paneli ekleyerek **yetkilendirme (authorization)** katmanını oluşturduk.
Modül 5'te "sen kimsin?" sorusunu çözmüştük (authentication).
Şimdi "bunu yapabilir misin?" sorusunu çözüyoruz (authorization).

Admin kullanıcılar artık: kullanıcıları yönetebilir, istatistikleri görebilir ve seçimi sıfırlayabilir.

---

## 1. Authentication vs Authorization

Bu iki kavram sıkça karıştırılır ama tamamen farklı şeylerdir:

```
Authentication (Kimlik Doğrulama) = "Sen kimsin?"
   → Modül 5'te yaptık (JWT token ile login)
   → authenticateToken middleware

Authorization (Yetkilendirme) = "Bunu yapabilir misin?"
   → Bu modülde yaptık (role kontrolü)
   → requireRole middleware
```

### Gerçek Hayat Benzetmesi
```
Bir şirket binasına giriyorsun:
1. Resepsiyon sana kimlik kartını sorar → Authentication
   "Sen Taha mısın?" → Evet, token'ım var

2. Asansörde bazı katlar kilitli → Authorization
   "3. kata çıkabilir misin?" → Rolüne bağlı
   voter → sadece oy kullanma (1. kat)
   admin  → her yere erişim (tüm katlar)
```

### Middleware Zinciri
```
İstek geliyor
   │
   ▼
[authenticateToken]  →  Token geçerli mi?
   │                     Hayır → 401 "Kim olduğunu bilmiyorum"
   ▼                     Evet → req.user = { id, username, role }
[requireRole('admin')]  →  Role 'admin' mi?
   │                        Hayır → 403 "Yetkin yok"
   ▼                        Evet → devam et
[Route Handler]  →  İşlemi gerçekleştir
```

---

## 2. Higher-Order Functions (Middleware Factory)

### Higher-Order Function Nedir?
Bir **fonksiyon dönen fonksiyon**. JavaScript'te fonksiyonlar birinci sınıf vatandaştır,
yani başka fonksiyonlara parametre olarak verilebilir veya fonksiyondan döndürülebilir.

### requireRole() Fonksiyonumuz

```javascript
// Bu bir Higher-Order Function:
// Çağrıldığında bir middleware FONKSİYONU döndürür.
function requireRole(role) {
    // Dönen fonksiyon bir Express middleware'i
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Token bulunamadı' });
        }

        if (req.user.role !== role) {
            return res.status(403).json({
                error: `Bu işlem için '${role}' yetkisi gerekiyor`
            });
        }

        next(); // Yetki uygun, devam et
    };
}
```

### Neden Higher-Order Function?
Çünkü farklı roller için **aynı fonksiyonu yeniden kullanabiliyoruz**:

```javascript
requireRole('admin')   →  Sadece admin erişebilir
requireRole('voter')   →  Sadece voter erişebilir
requireRole('editor')  →  İleride yeni rol eklersen hazır
```

Her seferinde yeni bir middleware yazmak yerine, tek bir fonksiyonla sonsuz varyasyon üretebilirsin.
Bu pattern **"Middleware Factory"** olarak bilinir.

### Alternatif: Factory Olmasaydı
```javascript
// KÖTÜ: Her rol için ayrı middleware yazmak zorunda kalırdık
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({...});
    next();
}

function requireVoter(req, res, next) {
    if (req.user.role !== 'voter') return res.status(403).json({...});
    next();
}

// İYİ: Tek factory fonksiyon, sonsuz varyasyon
const requireAdmin = requireRole('admin');
const requireVoter = requireRole('voter');
```

---

## 3. RBAC (Role-Based Access Control)

### RBAC Nedir?
Kullanıcıların sisteme erişimini **rollere** göre yöneten bir güvenlik modeli.
Her kullanıcının bir rolü vardır, her rolün belirli izinleri vardır.

### Bizim Sistemimizde RBAC

```
┌─────────────────────────────────────────────────┐
│                    ROLLER                        │
├──────────────┬──────────────────────────────────┤
│    voter     │           admin                   │
├──────────────┼──────────────────────────────────┤
│ ✅ Oy ver    │ ✅ Oy ver                         │
│ ✅ Sonuç gör │ ✅ Sonuç gör                      │
│ ✅ Chain gör │ ✅ Chain gör                       │
│ ❌ Users     │ ✅ Kullanıcı listele               │
│ ❌ Rol değiş │ ✅ Rol değiştir                    │
│ ❌ User sil  │ ✅ Kullanıcı sil                   │
│ ❌ Stats     │ ✅ İstatistik gör                  │
│ ❌ Reset     │ ✅ Seçim sıfırla                   │
└──────────────┴──────────────────────────────────┘
```

### Role Veritabanında Nasıl Saklanıyor?
```sql
-- users tablosu (Modül 5'te oluşturuldu)
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    role          VARCHAR(20) DEFAULT 'voter',  -- ← Varsayılan: voter
    created_at    TIMESTAMP DEFAULT NOW()
);
```

### Role JWT'de Nasıl Taşınıyor?
```javascript
// Login sırasında JWT oluşturulurken role payload'a eklenir:
const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },  // ← role burada
    JWT_SECRET,
    { expiresIn: '24h' }
);

// Token doğrulandığında:
req.user = { id: 5, username: "admin", role: "admin" }
//                                       ↑ role buradan okunur
```

### ÖNEMLİ: JWT'deki Role Eski Kalabilir!
```
1. Admin, Taha'nın rolünü 'voter' yapar (veritabanı güncellenir)
2. Ama Taha'nın JWT'si hâlâ role: 'admin' diyor (24 saat geçerli)
3. Taha token süresi dolana kadar admin yetkisini kullanabilir!

Çözümler (ileri seviye):
- Token blacklist (Redis ile)
- Kısa token süresi (1 saat)
- Her istekte veritabanından role kontrolü (yavaş ama güvenli)

Biz eğitim projesinde bu riski kabul ediyoruz.
```

---

## 4. router.use() ile Toplu Middleware

### Tekrarlı Yaklaşım (KÖTÜ - DRY İhlali)
```javascript
// Her endpoint'e ayrı ayrı middleware eklemek:
router.get('/users', authenticateToken, requireRole('admin'), handler1);
router.patch('/users/:id', authenticateToken, requireRole('admin'), handler2);
router.delete('/users/:id', authenticateToken, requireRole('admin'), handler3);
router.get('/stats', authenticateToken, requireRole('admin'), handler4);
router.post('/reset', authenticateToken, requireRole('admin'), handler5);
// 5 kez aynı şeyi yazdık! DRY prensibi ihlali.
```

### Temiz Yaklaşım (İYİ - DRY)
```javascript
// router.use() = "Bu router'daki TÜM isteklere bu middleware'leri uygula"
router.use(authenticateToken, requireRole('admin'));

// Artık her endpoint otomatik korunuyor:
router.get('/users', handler1);     // ← middleware otomatik çalışır
router.patch('/users/:id', handler2);
router.delete('/users/:id', handler3);
router.get('/stats', handler4);
router.post('/reset', handler5);
```

**DRY = Don't Repeat Yourself** (Kendini Tekrarlama)
Aynı kodu birden fazla yere yazmak yerine, tek bir yerde tanımla ve paylaş.

---

## 5. HTTP Metotları: PATCH vs PUT vs DELETE

### Bu Modülde Kullandığımız Metotlar

| Metot | Anlam | Örnek | Ne Zaman? |
|-------|-------|-------|-----------|
| GET | Veri oku | `GET /api/admin/users` | Listeleme, görüntüleme |
| POST | Yeni kayıt oluştur / işlem yap | `POST /api/admin/election/reset` | Oluşturma, tehlikeli işlem |
| PATCH | Kaynağı **kısmen** güncelle | `PATCH /api/admin/users/3/role` | Tek alan güncelleme |
| PUT | Kaynağı **tamamen** değiştir | `PUT /api/admin/users/3` | Tüm alanları güncelleme |
| DELETE | Kaynağı sil | `DELETE /api/admin/users/3` | Silme |

### PATCH vs PUT Farkı
```javascript
// PUT: Tüm kaynağı gönderirsin (eksik alan null olur)
PUT /users/3
{ "username": "taha", "role": "admin", "email": "taha@test.com" }

// PATCH: Sadece değişen alanı gönderirsin
PATCH /users/3/role
{ "role": "admin" }
// username, email vs. olduğu gibi kalır
```

Biz sadece `role` alanını güncellediğimiz için **PATCH** kullandık.

### URL Parametreleri (Route Parameters)
```javascript
// :id bir "route parameter" - URL'den değer yakalar
router.patch('/users/:id/role', async (req, res) => {
    const userId = req.params.id;  // URL'den gelen değer
    // PATCH /api/admin/users/3/role → req.params.id = "3"
    // PATCH /api/admin/users/7/role → req.params.id = "7"
});
```

---

## 6. SQL: RETURNING Clause

### UPDATE/DELETE Sonucunu Geri Almak
Normalde UPDATE veya DELETE yaptığında "kaç satır etkilendi" bilgisi döner.
Ama **hangi satırların** etkilendiğini görmek istersen `RETURNING` kullanırsın.

```sql
-- RETURNING olmadan:
UPDATE users SET role = 'admin' WHERE id = 3;
-- Sonuç: "1 row affected" (ama hangi satır? bilmiyorsun)

-- RETURNING ile:
UPDATE users SET role = 'admin' WHERE id = 3 RETURNING id, username, role;
-- Sonuç: { id: 3, username: "taha", role: "admin" }
-- Hem güncelleme yapıldı hem de güncel veriyi geri aldık!
```

### Neden Kullanışlı?
RETURNING olmadan güncellenen veriyi görmek için **2 sorgu** yazardık:
```javascript
// KÖTÜ: 2 sorgu
await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
const result = await db.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);

// İYİ: 1 sorgu (RETURNING ile)
const result = await db.query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
    [role, userId]
);
```

DELETE'te de aynı mantık:
```javascript
const result = await db.query(
    'DELETE FROM users WHERE id = $1 RETURNING id, username',
    [userId]
);
// Silinen kullanıcının bilgisi result.rows[0]'da
```

---

## 7. SQL: TRUNCATE vs DELETE

### Seçim Sıfırlamada TRUNCATE Kullandık

```sql
-- DELETE: Satırları tek tek siler
DELETE FROM blocks;
-- Yavaş, transaction log tutar, SERIAL sıfırlanmaz (id kaldığı yerden devam eder)

-- TRUNCATE: Tabloyu tamamen boşaltır
TRUNCATE blocks RESTART IDENTITY;
-- Hızlı, log tutmaz, RESTART IDENTITY ile id sıfırlanır (1'den başlar)
```

### Farklar Tablosu

| Özellik | DELETE | TRUNCATE |
|---------|--------|----------|
| Hız | Yavaş (satır satır) | Çok hızlı (tablo düzeyinde) |
| Log | Transaction log tutar | Log tutmaz |
| WHERE | `DELETE FROM t WHERE ...` ✅ | Koşul desteklemez ❌ |
| SERIAL | Sıfırlanmaz | `RESTART IDENTITY` ile sıfırlanır |
| Geri alma | ROLLBACK ile geri alınabilir | ROLLBACK ile geri alınabilir (transaction içinde) |
| Kullanım | Belirli satırları sil | Tüm tabloyu boşalt |

### Neden TRUNCATE Seçtik?
Seçim sıfırlamada **tüm** oyları siliyoruz, tek tek seçmemize gerek yok.
TRUNCATE hem daha hızlı hem de SERIAL sayacını sıfırlıyor (id 1'den başlar).

---

## 8. Promise.all ile Paralel Sorgular

### Stats Endpoint'inde Kullandık

Admin istatistik sayfasında 4 farklı bilgi gerekiyor:
1. Toplam oy sayısı
2. Toplam kullanıcı sayısı
3. Toplam blok sayısı
4. Aday bazlı oy dağılımı

### Sıralı Yaklaşım (YAVAŞ)
```javascript
// Her sorgu bir öncekinin bitmesini bekler:
const votes = await db.query('SELECT COUNT(*) FROM blocks WHERE block_index > 0');  // ~50ms
const users = await db.query('SELECT COUNT(*) FROM users');                          // ~50ms
const blocks = await db.query('SELECT COUNT(*) FROM blocks');                        // ~50ms
const candidates = await db.query('SELECT ... LEFT JOIN ...');                       // ~50ms
// Toplam: ~200ms (sıralı bekleme)
```

### Paralel Yaklaşım (HIZLI - Promise.all)
```javascript
// Tüm sorguları aynı anda başlat:
const [votes, users, blocks, candidates] = await Promise.all([
    db.query('SELECT COUNT(*) FROM blocks WHERE block_index > 0'),  // ┐
    db.query('SELECT COUNT(*) FROM users'),                          // ├─ Hepsi aynı anda!
    db.query('SELECT COUNT(*) FROM blocks'),                         // │
    db.query('SELECT ... LEFT JOIN ...')                              // ┘
]);
// Toplam: ~50ms (en yavaş sorgunun süresi kadar)
```

### Promise.all Nasıl Çalışır?
```
Promise.all([p1, p2, p3, p4])

        p1 ──────→ sonuç1
        p2 ────→ sonuç2        ← hepsi paralel çalışır
        p3 ──────────→ sonuç3
        p4 ───→ sonuç4

        Hepsi bittiğinde → [sonuç1, sonuç2, sonuç3, sonuç4]
```

### Destructuring Assignment
```javascript
// Promise.all'ın döndürdüğü dizi, sırasıyla değişkenlere atanır:
const [a, b, c, d] = await Promise.all([...]);
// a = ilk sorgunun sonucu
// b = ikinci sorgunun sonucu
// c = üçüncü sorgunun sonucu
// d = dördüncü sorgunun sonucu
```

---

## 9. LEFT JOIN vs INNER JOIN

### Aday Bazlı Oy Sayımında Kullandık

```sql
SELECT c.id, c.name, c.party, COUNT(b.id) as votes
FROM candidates c
LEFT JOIN blocks b ON (b.data->>'candidateId')::text = c.id::text
    AND b.block_index > 0
GROUP BY c.id, c.name, c.party
ORDER BY c.id
```

### LEFT JOIN vs INNER JOIN Farkı
```
candidates tablosu:          blocks tablosu:
┌────┬────────────────┐     ┌────┬──────────────┐
│ id │ name           │     │ id │ candidateId  │
├────┼────────────────┤     ├────┼──────────────┤
│ 1  │ Arif Furkan    │     │ 1  │ 1            │
│ 2  │ Satoshi        │     │ 2  │ 1            │
│ 3  │ Yeni Aday      │     │ 3  │ 2            │
└────┴────────────────┘     └────┴──────────────┘

INNER JOIN sonucu (eşleşmeyen satırlar kaybolur):
┌────┬────────────────┬───────┐
│ id │ name           │ votes │
├────┼────────────────┼───────┤
│ 1  │ Arif Furkan    │ 2     │
│ 2  │ Satoshi        │ 1     │
└────┴────────────────┴───────┘
❌ Yeni Aday görünmüyor! (hiç oy almamış)

LEFT JOIN sonucu (sol tablo her zaman görünür):
┌────┬────────────────┬───────┐
│ id │ name           │ votes │
├────┼────────────────┼───────┤
│ 1  │ Arif Furkan    │ 2     │
│ 2  │ Satoshi        │ 1     │
│ 3  │ Yeni Aday      │ 0     │ ← 0 oy ile de görünüyor!
└────┴────────────────┴───────┘
✅ Tüm adaylar listede
```

LEFT JOIN kullandık çünkü hiç oy almamış adaylar da istatistikte görünmeli.

---

## 10. Transaction (BEGIN / COMMIT / ROLLBACK)

### Seçim Sıfırlamada Kullandık

Seçim sıfırlama 3 işlemden oluşuyor:
1. `TRUNCATE voters` - Seçmen kayıtlarını sil
2. `TRUNCATE blocks` - Blokları sil
3. `INSERT genesis` - Yeni genesis bloğu oluştur

**Problem:** 2. adımda hata olursa ne olur?
- voters silinmiş ama blocks silinmemiş → **tutarsız veri!**

**Çözüm:** Transaction kullan (ya hepsi ya hiçbiri)

```javascript
// Transaction başlat
await db.query('BEGIN');

try {
    await db.query('TRUNCATE voters RESTART IDENTITY');
    await db.query('TRUNCATE blocks RESTART IDENTITY');
    await db.query('INSERT INTO blocks ...'); // genesis

    // Her şey başarılı → kaydet
    await db.query('COMMIT');
} catch (error) {
    // Herhangi bir hata → hepsini geri al
    await db.query('ROLLBACK');
    throw error;
}
```

### ACID Prensipleri
Transaction'lar ACID prensiplerini garanti eder:

| Prensip | Açıklama | Bizim Örneğimiz |
|---------|----------|-----------------|
| **A**tomicity | Ya hepsi ya hiçbiri | 3 işlemin hepsi başarılı veya hepsi geri alınır |
| **C**onsistency | Veri tutarlı kalır | voters silinir ama blocks kalmaz gibi durumlar olmaz |
| **I**solation | İşlemler birbirini etkilemez | Sıfırlama sırasında oy atılırsa çakışma olmaz |
| **D**urability | Kayıt kalıcıdır | COMMIT sonrası elektrik gitse bile veri korunur |

---

## 11. Defense in Depth (Derinlemesine Savunma)

### Seçim Sıfırlama Güvenlik Katmanları

Tehlikeli bir işlem olduğu için **3 katmanlı güvenlik** uyguladık:

```
Katman 1: authenticateToken
   → Login olmuş mu? (JWT kontrolü)
   → Hayır → 401 hatası

Katman 2: requireRole('admin')
   → Admin mi? (role kontrolü)
   → Hayır → 403 hatası

Katman 3: { confirm: true }
   → Onay göndermiş mi? (request body kontrolü)
   → Hayır → 400 hatası

Katman 4: Frontend Modal
   → Kullanıcı onay penceresinde "Confirm" tıkladı mı?
   → Hayır → istek gönderilmez
```

**Neden bu kadar katman?**
- Katman 1: Anonim kullanıcılar engellenir
- Katman 2: Normal voter'lar engellenir
- Katman 3: Yanlışlıkla API çağrısı engellenir (Postman'den test ederken bile)
- Katman 4: Admin'in "emin misin?" sorusuyla dikkat çekilir

Bu yaklaşıma **Defense in Depth** denir: tek bir güvenlik katmanı kırılsa bile diğerleri korur.

---

## 12. Open/Closed Principle

### Admin Frontend'de Kullandık

**Open/Closed Principle:** Kod **değişikliğe kapalı**, **genişlemeye açık** olmalı.
SOLID prensiplerinin "O" harfi.

```javascript
// api.js'deki mevcut API nesnesi - DOKUNMADIK (closed for modification)
const API = {
    getToken() { ... },
    login() { ... },
    vote() { ... },
    // ... mevcut fonksiyonlar aynen duruyor
};

// admin.html'de yeni AdminAPI nesnesi - YENİ EKLEDİK (open for extension)
const AdminAPI = {
    _authHeaders() {
        return { Authorization: `Bearer ${API.getToken()}` };  // API'yi kullanıyor!
    },
    getUsers() { ... },
    changeRole() { ... },
    deleteUser() { ... },
    getStats() { ... },
    resetElection() { ... }
};
```

**Ne kazandık?**
- `api.js` dosyasına hiç dokunmadık → mevcut voter akışı bozulma riski yok
- `AdminAPI` ayrı bir nesne olarak eklendi → sadece admin sayfasında yükleniyor
- Normal kullanıcılar `admin.html`'i hiç indirmiyor → gereksiz kod yüklenmez

---

## 13. Whitelist vs Blacklist Yaklaşımı

### Rol Değiştirmede Kullandık

```javascript
// WHİTELIST: Sadece izin verilen değerleri kabul et
const validRoles = ['voter', 'admin'];
if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
}
```

| Yaklaşım | Mantık | Güvenlik |
|-----------|--------|----------|
| **Whitelist** | "Sadece bunlara izin ver" | ✅ Güvenli (bilinmeyen değerler reddedilir) |
| **Blacklist** | "Sadece bunları engelle" | ❌ Riskli (yeni bir saldırı vektörü eklenirse?) |

**Whitelist her zaman tercih edilmelidir.**
Yeni bir rol eklendiğinde (`editor`, `moderator`) array'e eklememiz yeterli.

---

## 14. Güvenlik Kontrolleri: Kendini Düzenleme Engeli

### Admin Kendini Değiştiremez

```javascript
// Rol değiştirme
if (userId === req.user.id) {
    return res.status(400).json({
        error: 'Kendi rolunuzu değiştiremezsiniz (kilitlenme riski)'
    });
}

// Hesap silme
if (userId === req.user.id) {
    return res.status(400).json({
        error: 'Kendi hesabınızı silemezsiniz'
    });
}
```

**Neden?**
- Admin kendini voter yaparsa → sistemde admin kalmaz → admin paneline kimse erişemez
- Admin kendini silerse → aynı sorun
- Bu duruma **"kilitlenme" (lockout)** denir

---

## 15. Admin Panel Mimarisi

### Neden Ayrı Sayfa? (admin.html)

```
index.html (1217+ satır) - Voter sayfası
   ├── Dashboard (sonuçlar)
   ├── Voting Panel (oy verme)
   └── Blockchain Modal

admin.html (ayrı dosya) - Admin sayfası
   ├── İstatistikler
   ├── Kullanıcı Yönetimi
   └── Seçim Kontrolleri
```

**Avantajlar:**
1. `index.html` zaten 1217 satır - daha fazla kod eklemek yönetilemez hale getirirdi
2. Normal kullanıcılar admin kodunu hiç indirmiyor (güvenlik + performans)
3. Ayrı sayfa = ayrı sorumluluk (Separation of Concerns)

### Client-Side vs Server-Side Koruma

```javascript
// Client-side (admin.html'de): UX amaçlı
const user = API.getUser();
if (!user || user.role !== 'admin') {
    window.location.href = '/';  // Ana sayfaya yönlendir
    return;
}
// ⚠️ Bu güvenlik DEĞİL, sadece kullanıcı deneyimi!
// Biri DevTools'tan bu kontrolü atlayabilir.

// Server-side (routes/admin.js'de): GERÇEK güvenlik
router.use(authenticateToken, requireRole('admin'));
// ✅ Bu atlanamaz! API çağrıları kesinlikle 403 döner.
```

**Kural:** Client-side kontroller UX içindir, güvenlik her zaman server-side'da olmalı.

---

## 16. Admin Login Akışı (Uçtan Uca)

```
1. Kullanıcı → http://localhost:3000 → VOTE → Login formu
2. admin / admin123 girer → "Login" tıklar
3. Frontend → POST /api/auth/login { username, password }
4. Sunucu → bcrypt.compare() → Şifre doğru
5. Sunucu → jwt.sign({ id:5, username:"admin", role:"admin" }) → token
6. Frontend → API.setToken(token), API.setUser(user)
7. Frontend → user.role === 'admin' kontrol → EVET
8. Frontend → window.location.href = '/admin.html' (otomatik yönlendirme)
9. admin.html yüklenir → AdminApp.init()
10. init() → API.isLoggedIn()? → EVET
11. init() → API.getUser().role === 'admin'? → EVET
12. AdminAPI.getStats() → GET /api/admin/stats + Bearer token
13. Sunucu → [authenticateToken] → [requireRole('admin')] → handler
14. Stats verisi döner → Dashboard güncellenir
```

---

## 17. Değişen / Eklenen Dosyalar

| Dosya | Değişiklik | Açıklama |
|-------|-----------|----------|
| `middleware/auth.js` | **GÜNCELLENDİ** | `requireRole()` higher-order function eklendi |
| `routes/admin.js` | **YENİ** | 5 admin API endpoint'i |
| `server.js` | **GÜNCELLENDİ** | Admin route bağlandı, console.log güncellendi |
| `db/init.js` | **GÜNCELLENDİ** | Default admin kullanıcı seed'i eklendi |
| `public/admin.html` | **YENİ** | Admin panel frontend (stats, users, controls) |
| `public/index.html` | **GÜNCELLENDİ** | Admin link, login yönlendirme, logout düzeltmesi |
| `public/clear.html` | **YENİ** | localStorage temizleme yardımcı sayfası |

---

## 18. API Endpoint Özeti (Tüm Sistem)

### Public (Herkese Açık)
| Endpoint | Metot | Açıklama |
|----------|-------|----------|
| `/api/health` | GET | Sunucu durumu |
| `/api/results` | GET | Seçim sonuçları |
| `/api/chain` | GET | Blockchain blokları |
| `/api/chain/verify` | GET | Zincir doğrulama |
| `/api/auth/register` | POST | Kullanıcı kaydı |
| `/api/auth/login` | POST | Giriş + token al |

### Korunan (Token Gerekli)
| Endpoint | Metot | Açıklama |
|----------|-------|----------|
| `/api/vote` | POST | Oy ver (voter veya admin) |

### Admin (Token + Admin Rolü Gerekli)
| Endpoint | Metot | Açıklama |
|----------|-------|----------|
| `/api/admin/users` | GET | Kullanıcı listesi |
| `/api/admin/users/:id/role` | PATCH | Rol değiştir |
| `/api/admin/users/:id` | DELETE | Kullanıcı sil |
| `/api/admin/stats` | GET | İstatistikler |
| `/api/admin/election/reset` | POST | Seçim sıfırla |

---

## 19. Önemli Kavramlar Özet

- **Authentication**: "Sen kimsin?" → JWT token ile login
- **Authorization**: "Bunu yapabilir misin?" → Role kontrolü
- **RBAC**: Role-Based Access Control - roller ile erişim yönetimi
- **Higher-Order Function**: Fonksiyon dönen fonksiyon (`requireRole`)
- **Middleware Factory**: Farklı parametrelerle middleware üreten pattern
- **DRY**: Don't Repeat Yourself - `router.use()` ile tekrar engelleme
- **RETURNING**: SQL'de UPDATE/DELETE sonucunu geri alma
- **TRUNCATE**: Tabloyu hızlıca boşaltma (DELETE'ten farklı)
- **Promise.all**: Paralel async işlemler (performans)
- **LEFT JOIN**: Sol tablodaki tüm satırları koruyarak birleştirme
- **ACID**: Transaction'ların güvenilirlik prensipleri
- **Defense in Depth**: Çok katmanlı güvenlik
- **Open/Closed Principle**: Kodu değiştirmeden genişletme (SOLID'in O'su)
- **Whitelist**: Sadece izin verilenleri kabul et (güvenli)
- **Lockout Prevention**: Admin'in kendini kilitlemesini engelleme
