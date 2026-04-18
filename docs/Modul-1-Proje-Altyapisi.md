# Modül 1: Proje Altyapısını Kurma

**Ders:** Yazılım Mühendisliği
**Proje:** Blockchain Tabanlı Oylama Sistemi
**Tarih:** 23 Şubat 2026
**Hazırlayan:** Taha Can

---

## 1. Bu Modülde Ne Yaptık?

Elimizde sadece frontend'ten (HTML + JavaScript) oluşan bir seçim uygulaması vardı. Amacımız bu projeye backend eklemek. Bunun için ilk adım olarak:

- Proje klasör yapısını düzenledik
- Node.js proje dosyasını (package.json) oluşturduk
- Express web framework'ünü kurduk
- İlk sunucumuzu (server.js) yazdık
- İlk API endpoint'imizi tanımladık

---

## 2. Temel Kavramlar

### 2.1 Frontend vs Backend Nedir?

```
┌─────────────────────────────────────────────────────┐
│                    KULLANICI                         │
│                  (Tarayıcı)                          │
└─────────────────┬───────────────────────────────────┘
                  │ HTTP İstekleri
                  ▼
┌─────────────────────────────────────────────────────┐
│              FRONTEND (İstemci Tarafı)               │
│                                                      │
│  - HTML  → Sayfanın yapısı (iskelet)                │
│  - CSS   → Sayfanın görünümü (stil)                 │
│  - JS    → Sayfanın davranışı (etkileşim)           │
│                                                      │
│  Tarayıcıda çalışır. Kullanıcı bunu görür.          │
└─────────────────┬───────────────────────────────────┘
                  │ API İstekleri (fetch, axios)
                  ▼
┌─────────────────────────────────────────────────────┐
│              BACKEND (Sunucu Tarafı)                 │
│                                                      │
│  - server.js  → İstekleri karşılar                  │
│  - Veritabanı → Verileri kalıcı saklar              │
│  - API        → Frontend ile iletişim noktası       │
│                                                      │
│  Sunucuda çalışır. Kullanıcı bunu görmez.           │
└─────────────────────────────────────────────────────┘
```

**Önceki durumumuz:** Sadece frontend vardı. HTML dosyasını çift tıklayıp açıyorduk (`file:///C:/...`). Veriler localStorage'da tutuluyordu (tarayıcı temizlenince kayboluyordu).

**Şimdiki durumumuz:** Bir Express sunucusu var. Frontend dosyalarını sunuyor ve API endpoint'leri sağlıyor. İleride veritabanı ve kimlik doğrulama eklenecek.

### 2.2 Node.js Nedir?

JavaScript normalde sadece tarayıcıda çalışır. Node.js, JavaScript'i tarayıcı dışında (bilgisayarında, sunucuda) çalıştırmayı sağlayan bir platformdur.

```
JavaScript + Tarayıcı  = Frontend geliştirme
JavaScript + Node.js   = Backend geliştirme, araçlar, scriptler
```

### 2.3 npm (Node Package Manager) Nedir?

Başkalarının yazdığı hazır kodları (paket/kütüphane) tek komutla projene eklemeyi sağlayan paket yöneticisidir.

| Dil | Paket Yöneticisi |
|-----|-----------------|
| JavaScript/Node.js | npm |
| Python | pip |
| Java | Maven / Gradle |
| C# | NuGet |

**Temel komutlar:**

```bash
npm init -y          # Yeni proje başlat (package.json oluştur)
npm install express  # Express paketini kur
npm start            # package.json'daki "start" script'ini çalıştır
```

### 2.4 Express Nedir?

Express, Node.js için yazılmış bir **web sunucu framework**'üdür. Tarayıcıdan gelen HTTP isteklerini karşılar ve uygun yanıtları döner.

**Restoran benzetmesi:**

```
Express Sunucu = Restoran
Route'lar      = Menüdeki yemekler
req (request)  = Müşterinin siparişi
res (response) = Mutfaktan gelen yemek
Port           = Restoranın adresi (kapı numarası)
Middleware     = Siparişten önce yapılan kontroller (kimlik, rezervasyon)
```

### 2.5 Port Nedir?

Bilgisayarında birden fazla program aynı anda çalışabilir. Port, her programın dinlediği "kapı numarası"dır. Böylece tarayıcı hangi programa bağlanacağını bilir.

```
localhost:3000  →  Bizim Express sunucumuz
localhost:5432  →  PostgreSQL veritabanı (ileride)
localhost:8080  →  Başka bir uygulama
```

### 2.6 REST API Nedir?

**API** (Application Programming Interface) = Programların birbiriyle iletişim kurma yolu.

**REST** = Bu iletişimin nasıl yapılacağını belirleyen standart kurallar.

```
HTTP Metodu    Anlam              Örnek
───────────    ──────             ──────
GET            Veri al            GET  /api/results    → Sonuçları getir
POST           Veri gönder/oluş.  POST /api/vote       → Oy ver
PUT            Veri güncelle      PUT  /api/user/5     → 5 nolu kullanıcıyı güncelle
DELETE         Veri sil           DELETE /api/user/5   → 5 nolu kullanıcıyı sil
```

---

## 3. Proje Yapısı

```
seng_project_v2/
│
├── server.js              → Sunucunun ana dosyası (giriş noktası)
├── package.json           → Proje kimlik kartı + bağımlılıklar
├── package-lock.json      → Bağımlılıkların kesin versiyonları (npm yönetir)
├── .gitignore             → Git'e yüklenmeyecek dosyalar
├── node_modules/          → Kurulu paketler (npm yönetir, Git'e yüklenmez)
│
├── public/                → Frontend dosyaları (Express otomatik sunar)
│   ├── index.html         → Ana sayfa (Dashboard + Oylama ekranı)
│   ├── js/
│   │   └── blockchain.js  → Blockchain motoru (SHA-256, zincir doğrulama)
│   └── images/            → Görseller (logolar, aday fotoğrafları)
│
└── docs/                  → Dökümanlar
    ├── Whitepaper.pdf
    └── Whitepaper.docx
```

**Her dosyanın rolü:**

| Dosya | Ne İşe Yarar | Kim Yönetir |
|-------|-------------|------------|
| `server.js` | Sunucuyu başlatır, API'leri tanımlar | Biz yazıyoruz |
| `package.json` | Proje bilgileri, bağımlılıklar, script'ler | Biz + npm birlikte |
| `node_modules/` | İndirilen kütüphaneler (Express vb.) | npm yönetir |
| `.gitignore` | Git'e yüklenmeyecek dosya/klasör listesi | Biz yazıyoruz |
| `public/` | Tarayıcıya sunulan frontend dosyaları | Biz yazıyoruz |

---

## 4. server.js Detaylı Açıklama

```javascript
// ─── ADIM 1: GEREKLİ MODÜLLER ───
const express = require('express');   // Express kütüphanesini dahil et
const path = require('path');         // Dosya yolu yönetimi (Node.js dahili)
```

**`require()` nedir?** Başka dosya veya kütüphanedeki kodu mevcut dosyana dahil eder. Python'daki `import` ile aynı mantık.

```javascript
// ─── ADIM 2: UYGULAMA OLUŞTUR ───
const app = express();
```

`express()` çağrısı bir uygulama nesnesi döner. Tüm ayarlar, route'lar ve middleware'ler bu `app` üzerinden tanımlanır.

```javascript
// ─── ADIM 3: PORT TANIMLA ───
const PORT = process.env.PORT || 3000;
```

`process.env.PORT` → Ortam değişkeni (deploy ortamlarında otomatik atanır).
`|| 3000` → Eğer ortam değişkeni yoksa 3000 kullan. (`||` = "veya" operatörü)

```javascript
// ─── ADIM 4: MIDDLEWARE'LER ───
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
```

**Middleware nedir?** İstek (request) ve yanıt (response) arasına giren fonksiyonlardır. Her istek bu katmanlardan geçer.

```
İstek geldi → [express.json()] → [express.static()] → Route Handler → Yanıt gitti
                    ↑                     ↑
          JSON verisini oku     Statik dosya varsa sun
```

- `express.json()` → Gelen POST isteklerindeki JSON gövdesini okur
- `express.static('public')` → `public/` klasöründeki dosyaları otomatik sunar

**Statik dosya sunma nasıl çalışır?**

```
Tarayıcı isteği          Express ne yapıyor
────────────────          ──────────────────
localhost:3000/         → public/index.html dosyasını gönderir
localhost:3000/js/x.js  → public/js/x.js dosyasını gönderir
localhost:3000/img/a.png→ public/img/a.png dosyasını gönderir
```

```javascript
// ─── ADIM 5: API ENDPOINT ───
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Blockchain Voting System backend is running',
        timestamp: new Date().toISOString()
    });
});
```

**Bu kod ne diyor?**
"Birisi tarayıcıdan `GET /api/health` adresine istek atarsa, bu fonksiyonu çalıştır."

- `app.get(yol, fonksiyon)` → GET isteği için route tanımla
- `req` = request (gelen istek bilgileri)
- `res` = response (göndereceğimiz yanıt)
- `res.json({...})` = JSON formatında yanıt gönder

```javascript
// ─── ADIM 6: SUNUCUYU BAŞLAT ───
app.listen(PORT, () => {
    console.log('Sunucu çalışıyor...');
});
```

Bu satır sunucuyu belirtilen portta "dinleme" moduna alır. Program burada durmaz — sürekli yeni istekleri bekler.

---

## 5. İstek-Yanıt Döngüsü (Request-Response Cycle)

Bir kullanıcı tarayıcıda `localhost:3000` yazdığında olan şey:

```
  ┌──────────┐         ┌──────────────────────────────────┐
  │ Tarayıcı │         │        Express Sunucu             │
  └────┬─────┘         └──────────────┬───────────────────┘
       │                              │
       │  1. GET / isteği gönder      │
       │ ─────────────────────────>   │
       │                              │  2. "public/" klasörüne bak
       │                              │  3. index.html dosyasını bul
       │  4. index.html dosyasını     │
       │     geri gönder              │
       │ <─────────────────────────   │
       │                              │
       │  5. HTML içindeki CSS, JS,   │
       │     görselleri iste          │
       │ ─────────────────────────>   │
       │                              │  6. public/ altından bul
       │  7. Hepsini gönder           │
       │ <─────────────────────────   │
       │                              │
       │  8. Sayfa tamamen yüklendi!  │
       │                              │
```

---

## 6. package.json Detaylı Açıklama

```json
{
  "name": "blockchain-voting-system",
  "version": "1.0.0",
  "description": "Blockchain tabanli oylama sistemi",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

| Alan | Açıklama |
|------|---------|
| `name` | Projenin tekil adı (küçük harf, boşluk yok) |
| `version` | Semantik versiyonlama: MAJOR.MINOR.PATCH |
| `main` | Projenin giriş noktası dosyası |
| `scripts` | Terminal komutları kısayolları. `npm start` = `node server.js` |
| `dependencies` | Projenin çalışması için gereken kütüphaneler |

**`^5.2.1` ne demek?**
- `^` = MINOR ve PATCH güncellemelerine izin ver (5.2.1, 5.3.0 olabilir ama 6.0.0 olmaz)
- Bu, projenin uyumluluğunu korurken güvenlik güncellemelerini almasını sağlar

---

## 7. Önemli Terminal Komutları

```bash
# Projeyi başlatma
npm start                    # Sunucuyu başlat (package.json'daki start script'i)
node server.js               # Aynı şey, doğrudan çalıştır

# Paket yönetimi
npm init -y                  # Yeni proje oluştur (package.json)
npm install <paket-adı>      # Paket kur (dependencies'e ekler)
npm install                  # package.json'daki tüm paketleri kur

# Sunucuyu durdurma
Ctrl + C                     # Terminalde çalışan sunucuyu durdur
```

---

## 8. Sonraki Modül: Veritabanı

Modül 1'de sunucuyu kurduk ama henüz veriler hâlâ tarayıcının localStorage'ında tutuluyor. Modül 2'de:

- SQLite veritabanı kurulacak
- Oylar, kullanıcılar, adaylar tablolarda saklanacak
- Tarayıcı kapansa bile veriler kaybolmayacak

---

## 9. Kontrol Listesi

Bu modülü tamamladıktan sonra şunları yapabilmelisin:

- [x] `npm start` ile sunucuyu başlatabilmek
- [x] `localhost:3000` adresinde frontend'i görebilmek
- [x] `localhost:3000/api/health` adresinde JSON yanıt alabilmek
- [x] package.json dosyasının ne işe yaradığını açıklayabilmek
- [x] Express'in statik dosya sunma mantığını anlayabilmek
- [x] Bir API endpoint'inin nasıl tanımlandığını bilmek
- [x] req (request) ve res (response) kavramlarını açıklayabilmek
