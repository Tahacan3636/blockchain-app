// =============================================================
// js/i18n.js - Dil Destegi (Turkce / Ingilizce)
// =============================================================
// Kullanim:
//   HTML:  <span data-i18n="nav.vote"></span>
//          <input data-i18n-placeholder="vote.studentNumber">
//   JS:    I18n.t('vote.success')
//          I18n.t('results.votes', { n: 5 })  -> "{n} oy" -> "5 oy"
// Secilen dil tarayicida hatirlanir (localStorage).
// Dil degisince I18n.onChange ile kayitli fonksiyonlar calisir
// (Observer deseni): sayfalar dinamik metinlerini yeniden cizer.
// =============================================================

const I18n = (function () {
    'use strict';

    const STORAGE_KEY = 'lang';

    const DICT = {
        tr: {
            'page.title': 'Blockchain Tabanlı Seçim Sistemi',
            'nav.vote': 'OY VER',
            'nav.results': 'SONUÇLAR',

            'election.title': 'ÖĞRENCİ TEMSİLCİSİ SEÇİMİ — CANLI SONUÇLAR',
            'election.subtitle': 'BLOCKCHAIN TABANLI SEÇİM',
            'election.toWin': 'Kazanmak için %50 + 1',
            'results.votes': '{n} oy',
            'results.voteOne': '{n} oy',
            'results.total': 'Toplam Oy: {n}',
            'results.turnout': 'Katılım: %{n}',
            'results.turnoutNone': 'Katılım: —',

            'status.title': 'BLOCKCHAIN DURUMU',
            'status.checking': 'Kontrol ediliyor...',
            'status.valid': 'Zincir doğrulandı',
            'status.invalid': 'Zincir bozuk',
            'status.blocks': 'Blok sayısı',
            'status.head': 'Son blok hash',
            'status.inspect': 'Zinciri İncele',
            'status.error': 'Durum alınamadı',

            'map.title': 'İL BAZLI SEÇİM HARİTASI',
            'map.live': 'CANLI',
            'map.loading': 'Veriler yükleniyor...',
            'map.noData': 'Henüz oy verisi yok',
            'map.total': 'Toplam: {n} oy',
            'map.noVotes': 'Oy yok / Yakın yarış',
            'map.error': 'Harita yüklenemedi.',

            'city.title': 'İL BAZLI SEÇİM SONUÇLARI',
            'city.select': 'Diğer illerin sonuçlarını görüntüle...',
            'city.candidate': 'Aday',
            'city.percent': 'Oran',
            'city.votes': 'Oy',
            'city.ahead': '{n} önde',
            'city.total': 'Toplam: {n} oy',

            'vote.studentNumber': 'Öğrenci Numarası (9 hane)',
            'vote.code': 'Oy Kodu (örn. K7M4-P9QX)',
            'vote.button': 'OY VER',
            'vote.selectCandidate': 'Lütfen bir aday seçin.',
            'vote.enterNumber': 'Lütfen öğrenci numaranızı girin.',
            'vote.numberFormat': 'Öğrenci numarası tam 9 haneli olmalıdır.',
            'vote.enterCode': 'Lütfen oy kodunuzu girin.',
            'vote.success': 'Oyunuz başarıyla kaydedildi.',
            'vote.copy': 'Kopyala',
            'vote.copied': 'Kopyalandı ✓',
            'vote.showOnChain': 'Zincirde Göster',
            'vote.goToResults': 'Sonuçlara Dön',
            'vote.err.credentials': 'Öğrenci numarası veya oy kodu hatalı.',
            'vote.err.alreadyVoted': 'Bu öğrenci numarasıyla zaten oy kullanılmış.',
            'vote.err.tooMany': 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
            'vote.err.invalid': 'Geçersiz istek. Bilgilerinizi kontrol edin.',
            'vote.err.server': 'Sunucu hatası. Lütfen tekrar deneyin.',
            'vote.err.connection': 'Bağlantı hatası.',

            'chain.button': 'ZİNCİR',
            'chain.title': 'Blockchain Zinciri',
            'chain.loading': 'Yükleniyor...',
            'chain.close': 'Kapat',
            'chain.currentBlock': 'Seçili Blok:',
            'chain.hint': 'Bloklar previousHash alanı ile birbirine bağlıdır. Bir bloğa tıklayınca detayı yukarıda görünür.',
            'chain.valid': 'Zincir geçerli | Uzunluk: {n} | Son: {h}',
            'chain.invalid': 'Zincir geçersiz | Sebep: {r}',
            'chain.loadError': 'Zincir yüklenemedi',
            'chain.genesis': 'Genesis (Blok #{n})',
            'chain.block': 'Blok #{n}',
            'chain.hash': 'Hash: {h}',
            'chain.prev': 'Önceki: {h}',

            'receipt.title': 'Oyunu Doğrula (Makbuz)',
            'receipt.desc': 'Oy verdikten sonra aldığın İşlem Numarasını (TxID) girerek oyunun zincirde olduğunu doğrula.',
            'receipt.placeholder': 'Örnek: 2c1f... (TxID)',
            'receipt.lookup': 'Sorgula',
            'receipt.note': 'Makbuz kimliğini ya da kime oy verdiğini göstermez.',
            'receipt.enter': 'Lütfen bir TxID girin.',
            'receipt.notFound': 'Bu TxID zincirde bulunamadı.',
            'receipt.found': 'Oyun zincirde ✓',
            'receipt.time': 'Zaman:',
            'receipt.blockHash': 'Blok hash:',

            'export.title': 'Denetim: Zinciri Dışa Aktar',
            'export.desc': 'Zincirin tamamını JSON olarak indir; herkes hash\'leri bağımsız olarak yeniden hesaplayabilir.',
            'export.button': 'Dışa Aktar (JSON)',
            'export.ready': 'Hazır',
            'export.error': 'Zincir verisi alınamadı.',

            'login.title': 'Yönetici Girişi',
            'login.username': 'Kullanıcı adı',
            'login.password': 'Şifre',
            'login.cancel': 'Vazgeç',
            'login.submit': 'Giriş',
            'login.missing': 'Lütfen kullanıcı adı ve şifre girin.',
            'login.failed': 'Kullanıcı adı veya şifre hatalı.',
            'login.denied': 'Erişim reddedildi. Sadece yönetici.',

            'footer.rights': '© 2026 Blockchain Seçim Sistemi - Tüm hakları saklıdır.',
            'footer.dev': 'Geliştiren: MUHAMMED TAHA CAN',

            'admin.title': 'Admin Paneli - Blockchain Seçim Sistemi',
            'admin.home': 'Ana Sayfa',
            'admin.panel': 'YÖNETİCİ PANELİ',
            'admin.logout': 'Çıkış',
            'admin.stats': 'İSTATİSTİKLER',
            'admin.registered': 'Kayıtlı Seçmen',
            'admin.votesCast': 'Kullanılan Oy',
            'admin.turnout': 'Katılım Oranı',
            'admin.distribution': 'OY DAĞILIMI',
            'admin.totalVotes': 'Toplam Oy',
            'admin.registry': 'SEÇMEN KAYIT SİSTEMİ',
            'admin.importTitle': 'Seçmen Listesi İçe Aktar (Excel)',
            'admin.importDesc': 'Excel dosyası (.xlsx) yükleyin: A = Sıra No, B = 9 haneli Öğrenci Numarası, C = İl Plaka Kodu (1-81). Her öğrenci için tek kullanımlık oy kodu üretilir ve dağıtım listesi Excel olarak indirilir.',
            'admin.importBtn': 'Excel Yükle',
            'admin.clearBtn': 'Listeyi Temizle',
            'admin.currentList': 'Mevcut Seçmen Listesi',
            'admin.loading': 'Yükleniyor...',
            'admin.noList': 'Seçmen listesi yüklenmedi. Liste yüklenene kadar oylama kapalı.',
            'admin.listInfo': '{total} kayıtlı seçmen, {voted} kişi oy kullandı.',
            'admin.controls': 'SEÇİM KONTROLLERİ',
            'admin.resetTitle': 'Seçimi Sıfırla',
            'admin.resetDesc': 'Tüm oylar ve zincir kalıcı olarak silinir, yeni bir genesis blok oluşturulur. Seçmen listesi ve oy kodları korunur. Bu işlem GERİ ALINAMAZ.',
            'admin.cancel': 'Vazgeç',
            'admin.confirm': 'Onayla',
            'admin.importConfirmTitle': 'Seçmen Listesini Yükle',
            'admin.importConfirm': 'Yeni liste yüklenince mevcut liste, tüm oylar ve zincir sıfırlanır (yeni seçim). Her öğrenci için yeni oy kodu üretilir. Devam edilsin mi?',
            'admin.noRows': 'Geçerli satır bulunamadı. Sütunlar: A = Sıra, B = 9 haneli Öğrenci No, C = İl Kodu (1-81).',
            'admin.importError': 'Yükleme hatası: {e}',
            'admin.importOk': '{n} seçmen yüklendi. Oy kodları Excel olarak indirildi; bu dosyayı güvenli saklayın, kodlar tekrar gösterilemez.',
            'admin.fileError': 'Dosya okunamadı: {e}',
            'admin.clearConfirm': 'Tüm seçmen listesi, oylar ve zincir silinecek. Bu işlem GERİ ALINAMAZ. Devam edilsin mi?',
            'admin.clearOk': 'Seçmen listesi ve tüm oylar temizlendi.',
            'admin.resetConfirm': 'TÜM oylar ve zincir silinecek, yeni genesis blok oluşturulacak. Seçmen listesi korunur. Bu işlem GERİ ALINAMAZ. Devam edilsin mi?',
            'admin.resetOk': 'Seçim sıfırlandı.',
            'admin.error': 'Hata: {e}',
            'admin.codesSheet': 'Oy Kodları',
            'admin.col.no': 'Sıra',
            'admin.col.student': 'Öğrenci No',
            'admin.col.province': 'İl Kodu',
            'admin.col.code': 'Oy Kodu'
        },

        en: {
            'page.title': 'Blockchain-Based Voting System',
            'nav.vote': 'VOTE',
            'nav.results': 'RESULTS',

            'election.title': 'STUDENT REPRESENTATIVE ELECTION — LIVE RESULTS',
            'election.subtitle': 'BLOCKCHAIN-BASED ELECTION',
            'election.toWin': '50% + 1 to win',
            'results.votes': '{n} votes',
            'results.voteOne': '{n} vote',
            'results.total': 'Total Votes: {n}',
            'results.turnout': 'Turnout: {n}%',
            'results.turnoutNone': 'Turnout: —',

            'status.title': 'Blockchain Status',
            'status.checking': 'Checking...',
            'status.valid': 'Chain verified',
            'status.invalid': 'Chain broken',
            'status.blocks': 'Blocks',
            'status.head': 'Latest block hash',
            'status.inspect': 'Inspect Chain',
            'status.error': 'Status unavailable',

            'map.title': 'ELECTION MAP BY PROVINCE',
            'map.live': 'LIVE',
            'map.loading': 'Loading data...',
            'map.noData': 'No votes yet',
            'map.total': 'Total votes: {n}',
            'map.noVotes': 'No votes / Close race',
            'map.error': 'Map could not be loaded.',

            'city.title': 'RESULTS BY PROVINCE',
            'city.select': 'View results for other provinces...',
            'city.candidate': 'Candidate',
            'city.percent': 'Percent',
            'city.votes': 'Votes',
            'city.ahead': '{n} ahead',
            'city.total': 'Total votes: {n}',

            'vote.studentNumber': 'Student Number (9 digits)',
            'vote.code': 'Voting Code (e.g. K7M4-P9QX)',
            'vote.button': 'VOTE',
            'vote.selectCandidate': 'Please select a candidate.',
            'vote.enterNumber': 'Please enter your student number.',
            'vote.numberFormat': 'Student number must be exactly 9 digits.',
            'vote.enterCode': 'Please enter your voting code.',
            'vote.success': 'Your vote has been recorded.',
            'vote.copy': 'Copy',
            'vote.copied': 'Copied ✓',
            'vote.showOnChain': 'Show on Chain',
            'vote.goToResults': 'Back to Results',
            'vote.err.credentials': 'Student number or voting code is incorrect.',
            'vote.err.alreadyVoted': 'A vote has already been cast with this student number.',
            'vote.err.tooMany': 'Too many attempts. Please try again later.',
            'vote.err.invalid': 'Invalid request. Please check your details.',
            'vote.err.server': 'Server error. Please try again.',
            'vote.err.connection': 'Connection error.',

            'chain.button': 'CHAIN',
            'chain.title': 'Blockchain',
            'chain.loading': 'Loading...',
            'chain.close': 'Close',
            'chain.currentBlock': 'Selected Block:',
            'chain.hint': 'Blocks are linked through the previousHash field. Click a block to see its details above.',
            'chain.valid': 'Chain valid | Length: {n} | Head: {h}',
            'chain.invalid': 'Chain invalid | Reason: {r}',
            'chain.loadError': 'Chain could not be loaded',
            'chain.genesis': 'Genesis (Block #{n})',
            'chain.block': 'Block #{n}',
            'chain.hash': 'Hash: {h}',
            'chain.prev': 'Prev: {h}',

            'receipt.title': 'Verify Your Vote (Receipt)',
            'receipt.desc': 'Enter the Transaction ID (TxID) you received after voting to confirm your vote is on the chain.',
            'receipt.placeholder': 'Example: 2c1f... (TxID)',
            'receipt.lookup': 'Lookup',
            'receipt.note': 'The receipt does not reveal your identity or your choice.',
            'receipt.enter': 'Please enter a TxID.',
            'receipt.notFound': 'TxID not found on the chain.',
            'receipt.found': 'Your vote is on the chain ✓',
            'receipt.time': 'Time:',
            'receipt.blockHash': 'Block hash:',

            'export.title': 'Audit: Export Chain',
            'export.desc': 'Download the whole chain as JSON so anyone can recompute the hashes independently.',
            'export.button': 'Export (JSON)',
            'export.ready': 'Ready',
            'export.error': 'Chain data could not be loaded.',

            'login.title': 'Admin Login',
            'login.username': 'Username',
            'login.password': 'Password',
            'login.cancel': 'Cancel',
            'login.submit': 'Login',
            'login.missing': 'Please enter username and password.',
            'login.failed': 'Incorrect username or password.',
            'login.denied': 'Access denied. Admins only.',

            'footer.rights': '© 2026 Blockchain Voting System - All rights reserved.',
            'footer.dev': 'Developed by MUHAMMED TAHA CAN',

            'admin.title': 'Admin Panel - Blockchain Voting System',
            'admin.home': 'Home',
            'admin.panel': 'ADMIN PANEL',
            'admin.logout': 'Logout',
            'admin.stats': 'STATISTICS',
            'admin.registered': 'Registered Voters',
            'admin.votesCast': 'Votes Cast',
            'admin.turnout': 'Turnout',
            'admin.distribution': 'VOTE DISTRIBUTION',
            'admin.totalVotes': 'Total Votes',
            'admin.registry': 'VOTER REGISTRY',
            'admin.importTitle': 'Import Voter List (Excel)',
            'admin.importDesc': 'Upload an Excel file (.xlsx): A = Row No, B = 9-digit Student Number, C = Province Code (1-81). A one-time voting code is generated for each student and the distribution list is downloaded as Excel.',
            'admin.importBtn': 'Import Excel',
            'admin.clearBtn': 'Clear List',
            'admin.currentList': 'Current Voter List',
            'admin.loading': 'Loading...',
            'admin.noList': 'No voter list imported. Voting is closed until a list is imported.',
            'admin.listInfo': '{total} registered voters, {voted} have voted.',
            'admin.controls': 'ELECTION CONTROLS',
            'admin.resetTitle': 'Reset Election',
            'admin.resetDesc': 'All votes and the chain are permanently deleted and a new genesis block is created. The voter list and voting codes are kept. This action CANNOT be undone.',
            'admin.cancel': 'Cancel',
            'admin.confirm': 'Confirm',
            'admin.importConfirmTitle': 'Import Voter List',
            'admin.importConfirm': 'Importing a new list resets the current list, all votes and the chain (new election). New voting codes are generated for every student. Continue?',
            'admin.noRows': 'No valid rows found. Columns: A = Row, B = 9-digit Student No, C = Province Code (1-81).',
            'admin.importError': 'Import error: {e}',
            'admin.importOk': '{n} voters imported. Voting codes were downloaded as Excel; keep this file safe, the codes cannot be shown again.',
            'admin.fileError': 'File could not be read: {e}',
            'admin.clearConfirm': 'The whole voter list, all votes and the chain will be deleted. This action CANNOT be undone. Continue?',
            'admin.clearOk': 'Voter list and all votes cleared.',
            'admin.resetConfirm': 'ALL votes and the chain will be deleted and a new genesis block created. The voter list is kept. This action CANNOT be undone. Continue?',
            'admin.resetOk': 'Election reset.',
            'admin.error': 'Error: {e}',
            'admin.codesSheet': 'Voting Codes',
            'admin.col.no': 'No',
            'admin.col.student': 'Student No',
            'admin.col.province': 'Province Code',
            'admin.col.code': 'Voting Code'
        }
    };

    // Oncelik: adresteki ?lang=en > daha once secilen dil > Turkce
    function readSaved() {
        const fromUrl = new URLSearchParams(window.location.search).get('lang');
        if (DICT[fromUrl]) return fromUrl;
        try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    }

    let lang = DICT[readSaved()] ? readSaved() : 'tr';
    const listeners = [];

    // Anahtarin karsiligini doner; {n} gibi yer tutuculari doldurur.
    function t(key, params = {}) {
        const text = DICT[lang][key] ?? DICT.tr[key] ?? key;
        return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
    }

    // Sayi ve tarih bicimi icin dil kodu
    function locale() {
        return lang === 'tr' ? 'tr-TR' : 'en-US';
    }

    // Sayfadaki data-i18n etiketli tum metinleri gunceller.
    function apply() {
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.classList.toggle('lang-active', btn.dataset.lang === lang);
        });
    }

    function setLang(next) {
        if (!DICT[next] || next === lang) return;
        lang = next;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* gizli mod vb. */ }
        apply();
        listeners.forEach(fn => fn(lang));
    }

    function onChange(fn) {
        listeners.push(fn);
    }

    // TR | EN dugmelerini baglar
    function bindToggle() {
        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => setLang(btn.dataset.lang));
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindToggle();
        apply();
    });

    // Zincir dogrulama sebebi backend'den Turkce gelir; Ingilizce arayuzde cevrilir.
    const REASONS_EN = [
        [/^Blockchain bos - hic blok yok$/, 'Blockchain is empty - no blocks'],
        [/^Genesis blok gecersiz$/, 'Invalid genesis block'],
        [/^Genesis blok hash uyumsuzlugu$/, 'Genesis block hash mismatch'],
        [/^Blok (\d+): index hatasi \(beklenen: (\d+), bulunan: (\d+)\)$/, 'Block $1: index error (expected: $2, found: $3)'],
        [/^Blok (\d+): previousHash uyumsuzlugu$/, 'Block $1: previousHash mismatch'],
        [/^Blok (\d+): hash uyumsuzlugu \(icerik degistirilmis olabilir\)$/, 'Block $1: hash mismatch (content may have been modified)'],
        [/^Blok (\d+): ayni secmen ikinci kez oy kullanmis$/, 'Block $1: the same voter voted a second time'],
        [/^Kayit uyumsuzlugu: (\d+) secmen oy kullanmis gorunuyor ama zincirde (\d+) oy var \(blok silinmis olabilir\)$/,
            'Record mismatch: $1 voters are marked as voted but the chain has $2 votes (a block may have been deleted)']
    ];

    function reason(r) {
        if (!r || lang === 'tr') return r;
        for (const [re, en] of REASONS_EN) {
            if (re.test(r)) return r.replace(re, en);
        }
        return r;
    }

    return { t, reason, locale, apply, setLang, onChange, getLang: () => lang };
})();
