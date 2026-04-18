# Modül 4: Frontend-API Entegrasyonu

## Bu Modülde Ne Yaptık?

Frontend (site) artık localStorage değil, backend API'yi kullanıyor.
Yani oy verdiğinde veri **veritabanına** gidiyor, sonuçlar **veritabanından** geliyor.

**Önceki durum (Modül 3 sonrası):**
- Site: `localStorage` ile çalışıyordu (tarayıcıya kaydediyordu)
- API: Hazırdı ama site tarafından kullanılmıyordu

**Şimdiki durum (Modül 4 sonrası):**
- Site → `fetch()` → Backend API → PostgreSQL
- localStorage tamamen devre dışı

---

## Yeni Dosya: `public/js/api.js`

Frontend'ten API'ye istek gönderen 4 fonksiyon:

```
API.vote(voterId, candidateId)    → POST /api/vote
API.getResults()                  → GET  /api/results
API.getChain()                    → GET  /api/chain
API.verifyChain()                 → GET  /api/chain/verify
```

### fetch() Nedir?

Tarayıcının dahili HTTP istek fonksiyonu. Sunucuya istek gönderir, yanıt alır.

```js
// GET istegi (veri cekme - body yok)
const response = await fetch('/api/results');
const data = await response.json();

// POST istegi (veri gonderme - body var)
const response = await fetch('/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId: '123', candidateId: 1 })
});
```

**Önemli noktalar:**
- `fetch()` Promise döner → `async/await` ile kullanılır
- GET isteklerinde `body` olmaz (sadece URL yeterli)
- POST isteklerinde `headers` ile "JSON gönderiyorum" denir
- `response.json()` ile yanıt parse edilir

---

## Candidate ID Eşleşmesi (CANDIDATE_MAP)

Frontend'te adaylar `"left"` / `"right"` olarak tanımlı (UI kartları).
Veritabanında ise `id=1` (Arif Furkan) ve `id=2` (Satoshi).

```js
const CANDIDATE_MAP = { left: 1, right: 2 };      // UI → DB
const CANDIDATE_REVERSE = { 1: 'left', 2: 'right' };  // DB → UI
```

**Kullanım:**
- Oy verirken: `CANDIDATE_MAP[selectedCandidate]` → 1 veya 2
- Sonuç gösterirken: `CANDIDATE_REVERSE[result.candidateId]` → "left" veya "right"

Bu pattern'e **mapping** denir. İki farklı sistem arasında veri dönüşümü yapar.

---

## snake_case → camelCase Dönüşümü

Backend (PostgreSQL) snake_case kullanır, Frontend (JavaScript) camelCase kullanır.
Bu, yazılım dünyasında yaygın bir konvansiyondur.

```
PostgreSQL/Backend     →    Frontend/JavaScript
─────────────────            ─────────────────
block_index            →    index
previous_hash          →    previousHash
next_hash              →    nextHash
```

`api.js`'deki `getChain()` fonksiyonu bu dönüşümü otomatik yapar:

```js
data.blocks = data.blocks.map(block => ({
    index:        block.block_index,
    timestamp:    block.timestamp,
    data:         block.data,
    hash:         block.hash,
    previousHash: block.previous_hash,
    nextHash:     block.next_hash
}));
```

---

## Değişen Bileşenler

### Blockchain Objesi (Eskiden localStorage, şimdi API)

| Eski (Modül 3) | Yeni (Modül 4) |
|---|---|
| `new SimpleBlockchain()` | Yok (API kullanılıyor) |
| `voteChain.addVote()` | `API.vote()` |
| `voteChain.getChain()` | `API.getChain()` |
| `voteChain.verify()` | `API.verifyChain()` |
| localStorage'dan oy sayma | `API.getResults()` |

### ChainUI (Blockchain görselleştirme)

| Eski | Yeni |
|---|---|
| `voteChain.getChain()` | `API.getChain()` → `chainCache` |
| `voteChain.verify()` | `API.verifyChain()` |
| `voteChain.inspectHash()` | `chainCache` içinde arama |
| tamperDemo (client-side) | Devre dışı (sunucu tarafı) |
| Import | Devre dışı (sunucu tarafı) |
| Export (localStorage) | Export (API'den çek, indir) |

### App (Ana uygulama)

| Eski | Yeni |
|---|---|
| `App.init()` (sync) | `App.init()` (async) |
| `Blockchain.init()` | `Blockchain.applyVotesToData()` (API çağrısı) |
| Oy sonrası lokal güncelleme | Oy sonrası `API.getResults()` ile güncelleme |

---

## Promise.all ile Paralel İstekler

ChainUI'da chain ve verify verilerini **aynı anda** çekiyoruz:

```js
const [chainData, verifyData] = await Promise.all([
    API.getChain(),
    API.verifyChain()
]);
```

**Neden?**
- Sıralı: getChain (200ms) → verifyChain (200ms) = 400ms
- Paralel: her ikisi aynı anda = ~200ms

`Promise.all()` birden fazla async işlemi paralel çalıştırır.
Hepsi tamamlanınca sonuçları dizi olarak döner.

---

## Devre Dışı Bırakılan Özellikler

### Tamper Demo
- Eskiden: localStorage'daki veriyi değiştirerek "chain bozuldu" gösteriyordu
- Şimdi: Veri sunucuda, client değiştiremez → demo anlamsız
- Çözüm: Bölüm gizlendi, açıklama notu eklendi

### Import
- Eskiden: JSON dosyasından chain yükleyebiliyordun
- Şimdi: Chain sunucuda, client yükleyemez → devre dışı
- Export hala çalışıyor (API'den çekip JSON indir)

---

## Veri Akışı (Özet)

```
OY VERME:
  Kullanıcı → VOTE buton → App.submitVote()
    → Blockchain.addVote("left")
    → CANDIDATE_MAP["left"] = 1
    → API.vote(voterId, 1)
    → fetch POST /api/vote
    → Sunucu → PostgreSQL'e yazar
    → { txId, blockIndex } döner
    → Blockchain.applyVotesToData() → API.getResults()
    → Dashboard güncellenir

SONUÇ GÖRME:
  Sayfa yüklenir → App.init()
    → Blockchain.applyVotesToData()
    → API.getResults() → fetch GET /api/results
    → { results: [{candidateId:1, votes:3}, {candidateId:2, votes:2}] }
    → CANDIDATE_REVERSE[1] = "left" → electionData güncellenir
    → UI.updateDashboard()

CHAIN GÖRME:
  CHAIN butonu → ChainUI.openModal() → ChainUI.render()
    → Promise.all([ API.getChain(), API.verifyChain() ])
    → Bloklar gösterilir, doğrulama durumu gösterilir
```

---

## Dosya Değişiklikleri

| Dosya | Durum | Açıklama |
|---|---|---|
| `public/js/api.js` | YENİ | API client (4 fonksiyon) |
| `public/index.html` | GÜNCELLENDİ | Script tag, inline script, tamper/import devre dışı |
| `public/js/blockchain.js` | KULLANILMIYOR | Artık yüklenmıyor (referans olarak kalıyor) |

---

## Doğrulama Adımları

1. `node server.js` ile sunucuyu başlat
2. `localhost:3000` aç → Dashboard'da önceki oylar görünsün
3. VOTE → Kimlik gir → Aday seç → OY VER
4. "Vote successfully recorded" + TxID görünsün
5. Dashboard'a dön → Oy sayısı güncellenmiş olsun
6. CHAIN → Bloklar API'den gelsin
7. Verify → "Chain Valid" görünsün
8. `psql` ile veritabanında oyu doğrula:
   ```sql
   SELECT * FROM blocks ORDER BY block_index DESC LIMIT 1;
   ```
