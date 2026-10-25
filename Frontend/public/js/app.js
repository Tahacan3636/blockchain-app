// =============================================================
// js/app.js - Ana Sayfa (index.html) Mantigi
// =============================================================
// Moduller:
//   Utils       -> kucuk yardimci fonksiyonlar
//   UI          -> sonuc ekrani ve oy mesajlari
//   Election    -> sonuclari cekme ve oy gonderme (api.js uzerinden)
//   ChainStatus -> ana sayfadaki "Blockchain Durumu" seridi
//   ChainUI     -> zincir gezgini, makbuz sorgulama, disa aktarma
//   CityResults -> il bazli sonuc kartlari
//   App         -> sayfa baslatma ve kullanici etkilesimleri
// Metinler js/i18n.js'teki sozlukten gelir: t('anahtar').
// =============================================================
(function () {
    'use strict';

    const t = I18n.t;

    const TRANSITION_DELAY = 400;
    const REFRESH_INTERVAL = 5000;

    // Arayuzdeki sol/sag kart <-> veritabanindaki aday id'si
    const CANDIDATE_MAP = { left: 1, right: 2 };
    const CANDIDATE_REVERSE = { 1: 'left', 2: 'right' };

    const CITIES = {
        "1":"Adana","2":"Adıyaman","3":"Afyonkarahisar","4":"Ağrı",
        "5":"Amasya","6":"Ankara","7":"Antalya","8":"Artvin",
        "9":"Aydın","10":"Balıkesir","11":"Bilecik","12":"Bingöl",
        "13":"Bitlis","14":"Bolu","15":"Burdur","16":"Bursa",
        "17":"Çanakkale","18":"Çankırı","19":"Çorum","20":"Denizli",
        "21":"Diyarbakır","22":"Edirne","23":"Elazığ","24":"Erzincan",
        "25":"Erzurum","26":"Eskişehir","27":"Gaziantep","28":"Giresun",
        "29":"Gümüşhane","30":"Hakkari","31":"Hatay","32":"Isparta",
        "33":"Mersin","34":"İstanbul","35":"İzmir","36":"Kars",
        "37":"Kastamonu","38":"Kayseri","39":"Kırklareli","40":"Kırşehir",
        "41":"Kocaeli","42":"Konya","43":"Kütahya","44":"Malatya",
        "45":"Manisa","46":"Kahramanmaraş","47":"Mardin","48":"Muğla",
        "49":"Muş","50":"Nevşehir","51":"Niğde","52":"Ordu",
        "53":"Rize","54":"Sakarya","55":"Samsun","56":"Siirt",
        "57":"Sinop","58":"Sivas","59":"Tekirdağ","60":"Tokat",
        "61":"Trabzon","62":"Tunceli","63":"Şanlıurfa","64":"Uşak",
        "65":"Van","66":"Yozgat","67":"Zonguldak","68":"Aksaray",
        "69":"Bayburt","70":"Karaman","71":"Kırıkkale","72":"Batman",
        "73":"Şırnak","74":"Bartın","75":"Ardahan","76":"Iğdır",
        "77":"Yalova","78":"Karabük","79":"Kilis","80":"Osmaniye",
        "81":"Düzce"
    };
    const FEATURED_PLATES = ['34', '6', '26', '36'];

    // ==================== STATE ====================
    const state = {
        candidates: {
            left:  { name: 'YENİLİKÇİLER', party: 'Yenilikçi Öğrenci Topluluğu', votes: 0 },
            right: { name: 'GELENEKÇİLER', party: 'Gelenekçi Öğrenci Topluluğu', votes: 0 }
        },
        allowedVoters: 0,
        panel: 'dashboard',
        selectedCandidate: null,
        lastReceipt: null   // dil degisince basari mesajini yeniden cizmek icin
    };

    // ==================== UTILS ====================
    const Utils = {
        $(id) { return document.getElementById(id); },
        show(el) { el?.classList.remove('hidden'); },
        hide(el) { el?.classList.add('hidden'); },
        num(n) { return Number(n).toLocaleString(I18n.locale()); },
        shortHash(h) { return h ? `${h.slice(0, 10)}…${h.slice(-6)}` : ''; },

        // Sunucudan gelen HTTP koduna gore kullaniciya uygun mesaj
        voteErrorMessage(status) {
            switch (status) {
                case 403: return t('vote.err.credentials');
                case 409: return t('vote.err.alreadyVoted');
                case 429: return t('vote.err.tooMany');
                case 400: return t('vote.err.invalid');
                default:  return t('vote.err.server');
            }
        },

        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
        }
    };

    // ==================== UI ====================
    const UI = {
        updateDateTime() {
            const el = Utils.$('dateTime');
            if (!el) return;
            el.textContent = new Date().toLocaleString(I18n.locale(), {
                day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        },

        updateDashboard() {
            const { left, right } = state.candidates;
            const total = left.votes + right.votes;
            const leftPct = total > 0 ? ((left.votes / total) * 100).toFixed(1) : '50.0';
            const rightPct = total > 0 ? ((right.votes / total) * 100).toFixed(1) : '50.0';

            Utils.$('leftCandidateName').textContent = left.name;
            Utils.$('leftPartyName').textContent = left.party;
            Utils.$('leftVotes').textContent = t(left.votes === 1 ? 'results.voteOne' : 'results.votes', { n: Utils.num(left.votes) });
            Utils.$('rightCandidateName').textContent = right.name;
            Utils.$('rightPartyName').textContent = right.party;
            Utils.$('rightVotes').textContent = t(right.votes === 1 ? 'results.voteOne' : 'results.votes', { n: Utils.num(right.votes) });

            Utils.$('leftProgressBar').style.width = `${leftPct}%`;
            Utils.$('rightProgressBar').style.width = `${rightPct}%`;
            Utils.$('leftPercentage').textContent = `${leftPct}%`;
            Utils.$('rightPercentageBar').textContent = `${rightPct}%`;

            Utils.$('totalVotes').textContent = t('results.total', { n: Utils.num(total) });
            Utils.$('turnoutRate').textContent = state.allowedVoters > 0
                ? t('results.turnout', { n: ((total / state.allowedVoters) * 100).toFixed(1) })
                : t('results.turnoutNone');

            Utils.hide(Utils.$('leftWinnerBadge'));
            Utils.hide(Utils.$('rightWinnerBadge'));
            if (left.votes > right.votes) Utils.show(Utils.$('leftWinnerBadge'));
            else if (right.votes > left.votes) Utils.show(Utils.$('rightWinnerBadge'));
        },

        updateVotingPanel() {
            const { left, right } = state.candidates;
            Utils.$('voteLeftName').textContent = left.name;
            Utils.$('voteLeftParty').textContent = left.party;
            Utils.$('voteRightName').textContent = right.name;
            Utils.$('voteRightParty').textContent = right.party;
        },

        showMessage(text, type = 'info') {
            const el = Utils.$('voteMessage');
            state.lastReceipt = null;
            el.textContent = text;
            el.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-gray-700');
            el.classList.add(type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-gray-700');
        },

        hideMessage() {
            state.lastReceipt = null;
            Utils.hide(Utils.$('voteMessage'));
        },

        // Basarili oy: makbuz numarasi + kopyala / zincirde goster
        showReceipt(txId, blockIndex) {
            state.lastReceipt = { txId, blockIndex };
            const el = Utils.$('voteMessage');
            el.classList.remove('hidden', 'text-red-600', 'text-gray-700');
            el.classList.add('text-green-600');

            el.innerHTML = `
                <div class="flex flex-col items-center gap-2">
                    <div>${t('vote.success')}</div>
                    <div class="font-mono text-xs break-all">
                        <span class="font-semibold">TxID:</span> <span title="${txId}">${Utils.shortHash(txId)}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1 flex-wrap justify-center">
                        <button id="copyTxBtn" class="px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50 transition text-gray-900">${t('vote.copy')}</button>
                        <button id="showInChainBtn" class="px-3 py-1 rounded-full bg-black text-white hover:opacity-90 transition">${t('vote.showOnChain')}</button>
                        <button id="goToResultsBtn" class="px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50 transition text-gray-900">${t('vote.goToResults')}</button>
                    </div>
                </div>`;

            Utils.$('copyTxBtn').addEventListener('click', async () => {
                await Utils.copyToClipboard(txId);
                Utils.$('copyTxBtn').textContent = t('vote.copied');
                setTimeout(() => { Utils.$('copyTxBtn').textContent = t('vote.copy'); }, 900);
            });
            Utils.$('showInChainBtn').addEventListener('click', () => ChainUI.openModal(blockIndex));
            Utils.$('goToResultsBtn').addEventListener('click', () => App.togglePanel());
        }
    };

    // ==================== ELECTION ====================
    const Election = {
        async loadResults() {
            try {
                const data = await API.getResults();
                if (!data.success) return;

                data.results.forEach(r => {
                    const key = CANDIDATE_REVERSE[r.candidateId];
                    if (key) {
                        Object.assign(state.candidates[key], { name: r.name, party: r.party, votes: r.votes });
                    }
                });
                state.allowedVoters = data.allowedVoters;
            } catch (err) {
                console.error('Sonuc cekme hatasi:', err);
            }
        },

        // Basarisizsa hata mesajiyla Error firlatir
        async addVote(studentNumber, voterCode, candidateKey) {
            const data = await API.vote(studentNumber, voterCode, CANDIDATE_MAP[candidateKey]);
            if (!data.success) {
                throw new Error(Utils.voteErrorMessage(data.status));
            }
            return { txId: data.txId, blockIndex: data.blockIndex };
        }
    };

    // ==================== CHAIN STATUS (ana sayfa seridi) ====================
    const ChainStatus = {
        async refresh() {
            const iconEl = Utils.$('chainStatusIcon');
            const textEl = Utils.$('chainStatusText');
            try {
                const result = await API.verifyChain();
                const valid = result.valid === true;

                textEl.textContent = valid ? t('status.valid') : t('status.invalid');
                textEl.className = `text-lg font-extrabold ${valid ? 'text-green-700' : 'text-red-700'}`;
                iconEl.className = `w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
                iconEl.innerHTML = `<i data-lucide="${valid ? 'shield-check' : 'shield-alert'}" class="w-6 h-6"></i>`;

                Utils.$('chainBlockCount').textContent = valid ? Utils.num(result.blockCount) : '—';
                Utils.$('chainHeadHash').textContent = valid ? Utils.shortHash(result.headHash) : (result.reason || '—');
                Utils.$('chainHeadHash').title = valid ? result.headHash : '';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } catch (err) {
                textEl.textContent = t('status.error');
            }
        }
    };

    // ==================== CHAIN UI (modal) ====================
    const ChainUI = {
        openModal(selectedIndex = null) {
            Utils.show(Utils.$('chainModal'));
            this.render(selectedIndex);
        },

        closeModal() {
            Utils.hide(Utils.$('chainModal'));
        },

        refresh() {
            if (!Utils.$('chainModal').classList.contains('hidden')) this.render();
        },

        blockTitle(index) {
            return index === 0 ? t('chain.genesis', { n: index }) : t('chain.block', { n: index });
        },

        async render(selectedIndex = null) {
            const listEl = Utils.$('chainBlocks');
            const statusEl = Utils.$('chainStatus');
            statusEl.textContent = t('chain.loading');

            try {
                const [chainData, verifyData] = await Promise.all([API.getChain(), API.verifyChain()]);
                const chain = chainData.blocks;

                statusEl.textContent = verifyData.valid
                    ? t('chain.valid', { n: chain.length, h: Utils.shortHash(verifyData.headHash) })
                    : t('chain.invalid', { r: verifyData.reason });

                listEl.innerHTML = '';
                chain.forEach((b, i) => {
                    const btn = document.createElement('button');
                    btn.id = `chain-block-${i}`;
                    btn.className = `chain-block text-left rounded-2xl border p-4 shadow-sm ${
                        i === selectedIndex ? 'selected' : 'border-gray-200 bg-white hover:shadow hover:ring-1 hover:ring-gray-300'
                    }`;

                    const title = document.createElement('div');
                    title.className = 'font-extrabold tracking-wide text-sm';
                    title.textContent = this.blockTitle(b.index);

                    const hashDiv = document.createElement('div');
                    hashDiv.className = 'text-xs text-gray-600 mt-2';
                    hashDiv.textContent = t('chain.hash', { h: Utils.shortHash(b.hash) });

                    const prevDiv = document.createElement('div');
                    prevDiv.className = 'text-xs text-gray-600 mt-1';
                    prevDiv.textContent = t('chain.prev', { h: Utils.shortHash(b.previousHash) });

                    btn.append(title, hashDiv, prevDiv);
                    btn.addEventListener('click', () => this.render(i));
                    listEl.appendChild(btn);

                    if (i < chain.length - 1) {
                        const arrow = document.createElement('div');
                        arrow.className = 'flex items-center justify-center min-w-[60px] text-gray-400';
                        arrow.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
                        listEl.appendChild(arrow);
                    }
                });

                this.fillDetail(chain[selectedIndex ?? 0]);
                if (selectedIndex !== null) this.scrollToBlock(selectedIndex);
            } catch (err) {
                console.error('Chain render hatasi:', err);
                statusEl.textContent = t('chain.loadError');
            }
        },

        fillDetail(block) {
            Utils.$('selectedBlockTitle').textContent = block ? this.blockTitle(block.index) : '-';
            Utils.$('chainDetail').textContent = block ? JSON.stringify(block, null, 2) : '';
        },

        scrollToBlock(index) {
            const btn = Utils.$(`chain-block-${index}`);
            if (!btn) return;
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            btn.classList.add('ring-4', 'ring-black/10');
            setTimeout(() => btn.classList.remove('ring-4', 'ring-black/10'), 1200);
        },

        // Makbuz dogrulama: sunucuya "bu txId zincirde mi?" diye sorar.
        // Kime oy verildigi bilerek gosterilmez (makbuz, oy satin alan
        // birine kanit olarak kullanilamasin diye).
        async queryTxId() {
            const resultEl = Utils.$('txQueryResult');
            const txId = Utils.$('txQueryInput').value.trim();

            if (!txId) {
                resultEl.innerHTML = `<span class="text-red-600 font-bold">${t('receipt.enter')}</span>`;
                return;
            }

            try {
                const receipt = await API.getReceipt(txId);
                if (!receipt.found) {
                    resultEl.innerHTML = `<span class="text-red-600 font-bold">${t('receipt.notFound')}</span>`;
                    return;
                }

                resultEl.innerHTML = `
                    <div class="p-3 border rounded-2xl bg-white">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-extrabold text-green-700">${t('receipt.found')}</span>
                            <span class="text-gray-500 text-xs">${t('chain.block', { n: receipt.blockIndex })}</span>
                        </div>
                        <div class="mt-2 text-sm">
                            <div><span class="font-bold">${t('receipt.time')}</span> ${new Date(receipt.timestamp).toLocaleString(I18n.locale())}</div>
                            <div class="font-mono text-xs break-all"><span class="font-bold font-sans">${t('receipt.blockHash')}</span> ${Utils.shortHash(receipt.blockHash)}</div>
                        </div>
                    </div>`;

                await this.render(receipt.blockIndex);
            } catch (err) {
                resultEl.innerHTML = `<span class="text-red-600 font-bold">${t('vote.err.connection')}</span>`;
            }
        },

        async exportChain() {
            const resultEl = Utils.$('exportResult');
            try {
                const chainData = await API.getChain();
                if (!chainData.success) {
                    resultEl.innerHTML = `<span class="text-red-600 font-bold">${t('export.error')}</span>`;
                    return;
                }

                const snapshot = { exportedAt: new Date().toISOString(), chain: chainData.blocks };
                const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
                const filename = `chain-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 50);

                resultEl.innerHTML = `<span class="text-green-700 font-extrabold">${t('export.ready')}</span> (${filename})`;
            } catch (err) {
                resultEl.innerHTML = `<span class="text-red-600 font-bold">${t('export.error')}</span>`;
            }
        }
    };

    // ==================== CITY RESULTS ====================
    const CityResults = {
        cityData: {},

        init() {
            const dropdown = Utils.$('cityDropdown');
            Object.entries(CITIES)
                .sort((a, b) => a[1].localeCompare(b[1], 'tr'))
                .forEach(([code, name]) => dropdown.add(new Option(name, code)));
            dropdown.addEventListener('change', (e) => this.showSelected(e.target.value));
            this.refresh();
        },

        async refresh() {
            try {
                const data = await API.getProvinceResults();
                if (!data.success) return;
                this.cityData = data.provinces;
                this.render();
            } catch (err) {
                console.error('Il sonuclari hatasi:', err);
            }
        },

        render() {
            const container = Utils.$('featuredCities');
            container.innerHTML = '';
            FEATURED_PLATES.forEach(plate => {
                const wrapper = document.createElement('div');
                wrapper.className = 'featured-city-card border border-gray-200 shadow-sm';
                wrapper.appendChild(this.createCityCard(plate));
                container.appendChild(wrapper);
            });
            this.showSelected(Utils.$('cityDropdown').value);
        },

        showSelected(plate) {
            const container = Utils.$('selectedCityCard');
            container.innerHTML = '';
            if (!plate) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'city-fade-in border border-gray-200';
            wrapper.appendChild(this.createCityCard(plate));
            container.appendChild(wrapper);
        },

        candidateRow(key, img, color, votes, pct, leading, diff, rowClass, isLast) {
            const c = state.candidates[key];
            const check = leading
                ? '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-white flex-shrink-0"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>'
                : '';
            return `
                <div class="${rowClass}"${isLast ? ' style="border-bottom: none;"' : ''}>
                    <img src="images/${img}" alt="" class="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0" style="border: 2px solid ${color};"/>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="cr-name font-bold text-sm md:text-base text-gray-900">${c.name}</span>${check}
                        </div>
                        <span class="cr-party text-xs md:text-sm text-gray-500">${c.party}</span>
                    </div>
                    <span class="cr-pct w-16 md:w-20 text-right font-extrabold text-lg md:text-2xl ${leading ? 'text-white' : 'text-gray-800'}" style="font-variant-numeric: tabular-nums;">${pct}%</span>
                    <div class="w-20 md:w-24 text-right">
                        <div class="cr-votes font-bold text-sm md:text-lg text-gray-900" style="font-variant-numeric: tabular-nums;">${Utils.num(votes)}</div>
                        ${leading ? `<div class="cr-ahead text-xs md:text-sm font-medium text-white/80">${t('city.ahead', { n: Utils.num(diff) })}</div>` : ''}
                    </div>
                </div>`;
        },

        createCityCard(plate) {
            const data = this.cityData[plate] || {};
            const v1 = parseInt(data['1'], 10) || 0;
            const v2 = parseInt(data['2'], 10) || 0;
            const total = v1 + v2;
            const p1 = total > 0 ? ((v1 / total) * 100).toFixed(1) : '0.0';
            const p2 = total > 0 ? ((v2 / total) * 100).toFixed(1) : '0.0';
            const diff = Math.abs(v1 - v2);

            let class1 = 'candidate-row tied', class2 = 'candidate-row tied';
            if (v1 > v2) { class1 = 'candidate-row lead-blue'; class2 = 'candidate-row trail-red'; }
            if (v2 > v1) { class1 = 'candidate-row trail-blue'; class2 = 'candidate-row lead-red'; }

            const card = document.createElement('div');
            card.className = 'city-card';
            card.innerHTML = `
                <div class="city-card-header">
                    <h3 class="font-extrabold text-lg md:text-xl uppercase tracking-wide text-gray-900">${CITIES[plate] || plate}</h3>
                </div>
                <div class="flex items-center px-5 py-2 border-b border-gray-200 bg-gray-50">
                    <span class="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">${t('city.candidate')}</span>
                    <span class="w-16 md:w-20 text-[11px] font-bold uppercase tracking-wider text-gray-500 text-right">${t('city.percent')}</span>
                    <span class="w-20 md:w-24 text-[11px] font-bold uppercase tracking-wider text-gray-500 text-right">${t('city.votes')}</span>
                </div>
                ${this.candidateRow('left', 'aday-1.jpg', '#001e62', v1, p1, v1 > v2, diff, class1, false)}
                ${this.candidateRow('right', 'aday-2.jpg', '#c8102e', v2, p2, v2 > v1, diff, class2, true)}
                <div class="px-5 py-3 border-t border-gray-200">
                    <span class="text-sm text-gray-500 font-medium">${t('city.total', { n: Utils.num(total) })}</span>
                </div>`;
            return card;
        }
    };

    // ==================== APP ====================
    const App = {
        async init() {
            await Election.loadResults();
            UI.updateDashboard();
            UI.updateVotingPanel();
            UI.updateDateTime();
            ChainStatus.refresh();
            CityResults.init();

            if (typeof lucide !== 'undefined') lucide.createIcons();

            TurkeyMap.init('turkeyMapContainer');
            // Harita ipucu, il kartinin aynisini gosterir (DRY)
            TurkeyMap.setTooltipRenderer(code => CityResults.createCityCard(code));
            TurkeyMap.setOnClick(code => {
                Utils.$('cityDropdown').value = code;
                CityResults.showSelected(code);
                setTimeout(() => Utils.$('selectedCityCard').scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            });

            setInterval(() => UI.updateDateTime(), 1000);
            setInterval(() => this.refreshAll(), REFRESH_INTERVAL);

            I18n.onChange(() => this.onLanguageChange());
            this.bindNavbarButton();

            document.addEventListener('click', (e) => {
                if (e.target?.id === 'chainModal') ChainUI.closeModal();
            });
        },

        async refreshAll() {
            await Election.loadResults();
            UI.updateDashboard();
            ChainStatus.refresh();
            CityResults.refresh();
        },

        // Dil degisince dinamik (JS ile yazilan) metinleri yeniden ciz
        onLanguageChange() {
            UI.updateDashboard();
            UI.updateDateTime();
            ChainStatus.refresh();
            CityResults.render();
            ChainUI.refresh();
            Utils.$('navbarButtonText').textContent = t(this.isVoting() ? 'nav.results' : 'nav.vote');
            if (state.lastReceipt) UI.showReceipt(state.lastReceipt.txId, state.lastReceipt.blockIndex);
            else UI.hideMessage();
        },

        isVoting() {
            return state.panel === 'voting';
        },

        // Kisa tiklama: panel degistir. 3 saniye basili tutma: admin girisi.
        bindNavbarButton() {
            const btn = Utils.$('navbarButton');
            let timer = null;
            let longPressed = false;

            const start = () => {
                longPressed = false;
                timer = setTimeout(() => { longPressed = true; this.openAdminLogin(); }, 3000);
            };
            const cancel = () => { clearTimeout(timer); timer = null; };
            const end = () => { cancel(); if (!longPressed) this.togglePanel(); };

            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', cancel);
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
            btn.addEventListener('touchcancel', cancel);
        },

        togglePanel() {
            const dashboard = Utils.$('dashboardPanel');
            const voting = Utils.$('votingPanel');

            if (!this.isVoting()) {
                dashboard.classList.replace('panel-visible', 'panel-hidden');
                voting.classList.replace('panel-hidden', 'panel-visible');
                state.panel = 'voting';
                this.resetVotingForm();
            } else {
                voting.classList.replace('panel-visible', 'panel-hidden');
                dashboard.classList.replace('panel-hidden', 'panel-visible');
                state.panel = 'dashboard';
                this.refreshAll();
            }
            Utils.$('navbarButtonText').textContent = t(this.isVoting() ? 'nav.results' : 'nav.vote');
        },

        selectCandidate(candidate) {
            ['Left', 'Right'].forEach(side => {
                Utils.$(`voteCard${side}`).classList.remove('selected');
                Utils.hide(Utils.$(`check${side}`));
            });
            const side = candidate === 'left' ? 'Left' : 'Right';
            Utils.$(`voteCard${side}`).classList.add('selected');
            Utils.show(Utils.$(`check${side}`));

            state.selectedCandidate = candidate;
            Utils.$('submitVoteBtn').disabled = false;
            if (!state.lastReceipt) UI.hideMessage();
        },

        validateVoter(studentNumber, code) {
            if (!studentNumber) return t('vote.enterNumber');
            if (!/^\d{9}$/.test(studentNumber)) return t('vote.numberFormat');
            if (!code) return t('vote.enterCode');
            return null;
        },

        async submitVote() {
            const submitBtn = Utils.$('submitVoteBtn');
            const studentNumber = Utils.$('studentNumber').value.trim();
            const voterCode = Utils.$('voterCode').value.trim();

            if (!state.selectedCandidate) {
                UI.showMessage(t('vote.selectCandidate'), 'error');
                return;
            }
            const error = this.validateVoter(studentNumber, voterCode);
            if (error) {
                UI.showMessage(error, 'error');
                return;
            }

            submitBtn.disabled = true;
            try {
                const receipt = await Election.addVote(studentNumber, voterCode, state.selectedCandidate);
                UI.showReceipt(receipt.txId, receipt.blockIndex);
                this.refreshAll();
                ChainUI.refresh();
                setTimeout(() => this.resetVotingForm({ keepMessage: true }), TRANSITION_DELAY);
            } catch (err) {
                UI.showMessage(err.message || t('vote.err.connection'), 'error');
                submitBtn.disabled = false;
            }
        },

        resetVotingForm({ keepMessage = false } = {}) {
            Utils.$('studentNumber').value = '';
            Utils.$('voterCode').value = '';
            Utils.$('submitVoteBtn').disabled = true;
            state.selectedCandidate = null;
            ['Left', 'Right'].forEach(side => {
                Utils.$(`voteCard${side}`).classList.remove('selected');
                Utils.hide(Utils.$(`check${side}`));
            });
            if (!keepMessage) UI.hideMessage();
        },

        // ==================== ADMIN LOGIN ====================
        openAdminLogin() {
            Utils.show(Utils.$('adminLoginModal'));
            Utils.$('adminUsername').value = '';
            Utils.$('adminPassword').value = '';
            Utils.hide(Utils.$('adminLoginMessage'));
            Utils.$('adminUsername').focus();
        },

        closeAdminLogin() {
            Utils.hide(Utils.$('adminLoginModal'));
        },

        async submitAdminLogin() {
            const username = Utils.$('adminUsername').value.trim();
            const password = Utils.$('adminPassword').value;
            const msgEl = Utils.$('adminLoginMessage');
            const fail = (key) => { msgEl.textContent = t(key); Utils.show(msgEl); };

            if (!username || !password) return fail('login.missing');

            try {
                const data = await API.login(username, password);
                if (!data.success) {
                    return fail(data.status === 429 ? 'vote.err.tooMany' : 'login.failed');
                }
                if (data.user.role !== 'admin') {
                    API.logout();
                    return fail('login.denied');
                }
                window.location.href = '/admin.html';
            } catch (err) {
                fail('vote.err.connection');
            }
        }
    };

    window.App = App;
    window.ChainUI = ChainUI;

    document.addEventListener('DOMContentLoaded', () => App.init());
})();
