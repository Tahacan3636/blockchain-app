# Modül 5: Kimlik Doğrulama (Authentication)

## Bu Modülde Ne Öğrendik?

Bu modülde JWT tabanlı kimlik doğrulama sistemi ekledik.
Artık kullanıcılar kayıt olup, giriş yapıp, token ile oy verebiliyor.
Citizenship Number alanı kaldırıldı - kimlik artık token'dan geliyor.

---

## 1. JWT (JSON Web Token) Nedir?

JWT, iki taraf arasında güvenli bilgi aktarımı için kullanılan bir standarttır.

### JWT'nin 3 Parçası

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ0YWhhIn0.abc123signature
|_______ HEADER _______||__________ PAYLOAD ______________||____ SIGNATURE ____|
```

**Header (Başlık):**
```json
{ "alg": "HS256", "typ": "JWT" }
```
Hangi algoritma ile imzalandığını söyler.

**Payload (Yük):**
```json
{ "id": 1, "username": "taha", "role": "voter", "iat": 1708000000, "exp": 1708086400 }
```
Token içine gömülen veri. **DİKKAT:** Base64 ile decode edilebilir, şifre gibi hassas veri konulmaz!

**Signature (İmza):**
```
HMACSHA256(base64(header) + "." + base64(payload), SECRET_KEY)
```
Token'ın değiştirilip değiştirilmediğini doğrular. SECRET_KEY olmadan üretilemez.

### JWT Akışı
```
1. Kullanıcı login olur (username + password)
2. Sunucu şifreyi doğrular
3. Sunucu JWT oluşturur (jwt.sign)
4. Token istemciye döner (frontend localStorage'a kaydeder)
5. Her korunan istekte Authorization: Bearer <token> gönderilir
6. Sunucu token'ı doğrular (jwt.verify)
7. Geçerliyse istek devam eder, değilse 401/403 döner
```

### JWT Stateless'tır
Sunucu token'ı saklamaz! Her istekte token doğrulanır.
Bu sayede sunucu session state tutmak zorunda kalmaz (ölçeklenebilirlik).

---

## 2. bcrypt vs SHA-256

### SHA-256 (Blockchain'de kullanıyoruz)
- **Hızlı**: Saniyede milyonlarca hash hesaplayabilir
- Blockchain'de bu hız avantajdır (blok hash hesaplama)
- Ama şifre için **hız kötüdür** - brute-force saldırısı kolaylaşır

### bcrypt (Şifre için kullanıyoruz)
- **Kasıtlı olarak yavaş**: salt rounds ile kontrol edilir
- `bcrypt.hash(password, 10)`: 2^10 = 1024 iterasyon
- Salt: Her hash'e rastgele eklenen değer (aynı şifre → farklı hash)
- Brute-force'u pratik olarak imkansız kılar

```javascript
// SHA-256: Aynı input → her zaman aynı output
SHA256("sifre123") → "a1b2c3..." (her seferinde aynı)

// bcrypt: Aynı input → her seferinde farklı output (salt sayesinde)
bcrypt.hash("sifre123", 10) → "$2a$10$xyz..." (her seferinde farklı)
bcrypt.hash("sifre123", 10) → "$2a$10$abc..." (farklı salt)

// Ama karşılaştırma çalışır:
bcrypt.compare("sifre123", "$2a$10$xyz...") → true
```

---

## 3. Middleware Pattern

Middleware, Express'te request → response arasında çalışan fonksiyonlardır.
Bir "güvenlik kontrol noktası" gibi düşünülebilir.

```
İstek → [express.json()] → [authenticateToken] → [Route Handler] → Yanıt
         middleware #1        middleware #2         hedef fonksiyon
```

### authenticateToken Middleware'imiz
```javascript
function authenticateToken(req, res, next) {
    // 1. Authorization header'ından token'ı al
    const token = req.headers['authorization']?.split(' ')[1];

    // 2. Token yoksa → 401
    if (!token) return res.status(401).json({ error: 'Token bulunamadı' });

    // 3. Token'ı doğrula
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Geçersiz token' });

        // 4. Geçerliyse → req.user'a yaz, devam et
        req.user = decoded;
        next();  // <-- Bir sonraki middleware/handler'a geç
    });
}
```

### Kullanım
```javascript
// Korunan endpoint:
router.post('/vote', authenticateToken, async (req, res) => {
    // req.user = { id: 1, username: "taha", role: "voter" }
    const voterId = String(req.user.id);  // JWT'den geliyor, güvenli!
});

// Public endpoint (middleware yok):
router.get('/results', async (req, res) => { ... });
```

---

## 4. HTTP Status Kodları: 401 vs 403

| Kod | İsim | Anlam | Örnek |
|-----|------|-------|-------|
| 401 | Unauthorized | "Kim olduğunuzu bilmiyorum" | Token gönderilmemiş |
| 403 | Forbidden | "Kim olduğunuzu biliyorum ama yetkiniz yok" | Token süresi dolmuş, geçersiz |

Pratikte:
- Token yok → 401 (login olman gerekiyor)
- Token var ama geçersiz → 403 (token'ın bozuk veya süresi dolmuş)

---

## 5. Token Storage: localStorage vs HttpOnly Cookie

| Özellik | localStorage | HttpOnly Cookie |
|---------|-------------|-----------------|
| Erişim | JavaScript ile okunabilir | JavaScript ile okunamaz |
| XSS Riski | Yüksek (script token'ı çalabilir) | Düşük (tarayıcı otomatik gönderir) |
| CSRF Riski | Düşük (otomatik gönderilmez) | Yüksek (her istekte otomatik gider) |
| Uygulama | Basit | Daha karmaşık (cookie ayarları) |

Biz localStorage kullanıyoruz çünkü:
- Eğitim projesi (basitlik öncelikli)
- fetch ile Authorization header'ına manuel ekliyoruz
- Gerçek uygulamada HttpOnly cookie + CSRF token daha güvenli

---

## 6. Değişen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `middleware/auth.js` | **YENİ** - JWT middleware + sabitler |
| `routes/auth.js` | **YENİ** - Register + Login endpoint'leri |
| `db/init.js` | users tablosu eklendi |
| `server.js` | Auth route'ları bağlandı |
| `routes/api.js` | POST /vote artık authenticateToken ile korunuyor |
| `public/js/api.js` | Token yönetimi, auth fonksiyonları, vote() güncellendi |
| `public/index.html` | Login/Register UI, Citizenship Number kaldırıldı |

---

## 7. Auth Sonrası Oy Verme Akışı

```
Kullanıcı → Register (username + password)
         → Login → JWT token alır (localStorage'a kaydedilir)
         → VOTE paneli → Aday seç → VOTE
         → Frontend: API.vote(candidateId) + Authorization: Bearer <token>
         → Middleware: jwt.verify() → req.user = { id, username, role }
         → Vote handler: voterId = String(req.user.id) → voterHash()
         → Veritabanı: blok + voter kaydı
```

---

## 8. Önemli Kavramlar

- **Authentication (Kimlik Doğrulama)**: "Sen kimsin?" → Login
- **Authorization (Yetkilendirme)**: "Bunu yapabilir misin?" → Role kontrolü
- **Stateless**: Sunucu oturum bilgisi tutmaz, her istek kendi kendine yeterli
- **Salt**: Hash'e eklenen rastgele değer (rainbow table saldırılarını engeller)
- **Salt Rounds**: bcrypt'in yavaşlık seviyesi (10 = 2^10 iterasyon)
