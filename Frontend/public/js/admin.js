// =============================================================
// js/admin.js - Admin Paneli (admin.html) Mantigi
// =============================================================
// Backend istekleri js/api.js uzerinden yapilir.
// Excel okuma/yazma tarayicida SheetJS (XLSX) ile yapilir.
// Metinler js/i18n.js'teki sozlukten gelir: t('anahtar').
// =============================================================
(function () {
    'use strict';

    const t = I18n.t;
    const $ = (id) => document.getElementById(id);
    const num = (n) => Number(n).toLocaleString(I18n.locale());

    const AdminApp = {
        modalCallback: null,
        lastStats: null,
        lastVoters: null,

        async init() {
            const user = API.getUser();
            if (!API.isLoggedIn() || !user || user.role !== 'admin') {
                window.location.href = '/';
                return;
            }
            $('adminUsername').textContent = user.username;
            I18n.onChange(() => this.render());
            await this.refresh();
            lucide.createIcons();
        },

        async refresh() {
            await Promise.all([this.loadStats(), this.loadVoters()]);
        },

        // Dil degisince son cekilen veriyle yeniden ciz
        render() {
            if (this.lastStats) this.renderStats(this.lastStats);
            if (this.lastVoters) this.renderVoters(this.lastVoters);
        },

        // Oturum suresi dolduysa (401/403) ana sayfaya don
        handleAuthError(data) {
            if (data && (data.status === 401 || data.status === 403)) {
                API.logout();
                window.location.href = '/';
                return true;
            }
            return false;
        },

        showMessage(text, ok) {
            const el = $('voterImportMessage');
            el.textContent = text;
            el.className = 'mb-4 px-4 py-3 rounded-xl text-sm font-medium ' +
                (ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700');
        },

        async loadStats() {
            try {
                const data = await API.getStats();
                if (this.handleAuthError(data) || !data.success) return;
                this.lastStats = data.stats;
                this.renderStats(data.stats);
            } catch (err) {
                console.error('Istatistik hatasi:', err);
            }
        },

        renderStats(s) {
            $('statTotalVotes').textContent = num(s.totalVotes);
            $('statAllowedVoters').textContent = num(s.allowedVoters);
            const pct = Math.round((s.totalVotes / s.allowedVoters) * 100);
            $('statTurnout').textContent = s.allowedVoters > 0
                ? (I18n.getLang() === 'tr' ? '%' + pct : pct + '%')
                : '—';
            this.renderCandidateBars(s.votesPerCandidate, s.totalVotes);
        },

        renderCandidateBars(candidates, totalVotes) {
            const colors = { 1: 'blue', 2: 'red' };
            const maxVotes = Math.max(...candidates.map(c => c.votes));

            let html = candidates.map((c, idx) => {
                const percentage = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
                const color = colors[c.candidateId] || 'gray';
                const isLeader = totalVotes > 0 && c.votes === maxVotes;
                const bgClass = isLeader ? (color === 'blue' ? 'bg-blue-50' : 'bg-red-50') : '';
                const borderClass = idx < candidates.length - 1 ? 'border-b border-gray-100' : '';

                return `
                    <div class="py-4 px-4 rounded-xl ${bgClass} ${borderClass}">
                        <div class="flex justify-between items-center mb-2">
                            <div class="flex items-center gap-3">
                                <span class="inline-block w-3 h-3 rounded bg-${color}-500"></span>
                                <div>
                                    <span class="text-sm font-bold text-gray-900">${c.name}</span>
                                    <span class="text-xs text-gray-400 ml-2">${c.party}</span>
                                </div>
                                ${isLeader ? '<span class="text-green-600 text-xs font-bold ml-1">✓</span>' : ''}
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-extrabold text-gray-900 font-mono">${num(c.votes)}</span>
                                <span class="text-xs text-gray-400 ml-1 font-mono">(${percentage}%)</span>
                            </div>
                        </div>
                        <div class="w-full bg-gray-100 rounded-full h-2.5">
                            <div class="h-2.5 rounded-full transition-all duration-700 bg-${color}-500" style="width: ${percentage}%"></div>
                        </div>
                    </div>`;
            }).join('');

            if (totalVotes > 0) {
                html += `
                    <div class="pt-4 mt-2 border-t border-gray-200 flex justify-between items-center px-4">
                        <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider">${t('admin.totalVotes')}</span>
                        <span class="text-sm font-extrabold text-gray-900 font-mono">${num(totalVotes)}</span>
                    </div>`;
            }
            $('candidateBars').innerHTML = html;
        },

        async loadVoters() {
            try {
                const data = await API.getVoters();
                if (this.handleAuthError(data) || !data.success) return;
                this.lastVoters = data.voters;
                this.renderVoters(data.voters);
            } catch (err) {
                console.error('Secmen listesi hatasi:', err);
            }
        },

        renderVoters(voters) {
            const voted = voters.filter(v => v.has_voted).length;
            $('voterListInfo').textContent = voters.length === 0
                ? t('admin.noList')
                : t('admin.listInfo', { total: num(voters.length), voted: num(voted) });
            $('voterCount').textContent = voters.length ? num(voters.length) : '-';
        },

        // Excel satirlarini { studentNumber, provinceCode } listesine cevirir.
        // Beklenen sutunlar: A = Sira, B = Ogrenci No, C = Il Plaka Kodu
        parseVoterSheet(workbook) {
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1); // baslik satiri atlanir
            return rows
                .map(row => ({
                    studentNumber: String(row[1] || '').trim(),
                    provinceCode: parseInt(row[2], 10)
                }))
                .filter(v => /^\d{9}$/.test(v.studentNumber) && v.provinceCode >= 1 && v.provinceCode <= 81);
        },

        // Uretilen oy kodlarini dagitim listesi olarak indirir.
        // Kodlar sunucuda saklanmadigi icin bu dosya TEK kopyadir.
        downloadVoterCodes(voters) {
            const rows = voters.map((v, i) => ({
                [t('admin.col.no')]: i + 1,
                [t('admin.col.student')]: v.studentNumber,
                [t('admin.col.province')]: v.provinceCode,
                [t('admin.col.code')]: v.code
            }));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), t('admin.codesSheet'));
            XLSX.writeFile(workbook, `voting-codes-${new Date().toISOString().slice(0, 10)}.xlsx`);
        },

        handleFileUpload(event) {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            this.showModal(t('admin.importConfirmTitle'), t('admin.importConfirm'), () => this.importFile(file));
        },

        async importFile(file) {
            try {
                const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                const voters = this.parseVoterSheet(workbook);
                if (voters.length === 0) {
                    this.showMessage(t('admin.noRows'), false);
                    return;
                }

                const result = await API.importVoters(voters);
                if (this.handleAuthError(result)) return;
                if (!result.success) {
                    this.showMessage(t('admin.importError', { e: result.error }), false);
                    return;
                }

                this.downloadVoterCodes(result.voters);
                this.showMessage(t('admin.importOk', { n: num(result.count) }), true);
                await this.refresh();
            } catch (err) {
                this.showMessage(t('admin.fileError', { e: err.message }), false);
            }
        },

        confirmClearVoters() {
            this.showModal(t('admin.clearBtn'), t('admin.clearConfirm'), async () => {
                const data = await API.clearVoters();
                if (this.handleAuthError(data)) return;
                this.showMessage(data.success ? t('admin.clearOk') : t('admin.error', { e: data.error }), data.success);
                await this.refresh();
            });
        },

        confirmReset() {
            this.showModal(t('admin.resetTitle'), t('admin.resetConfirm'), async () => {
                const data = await API.resetElection();
                if (this.handleAuthError(data)) return;
                this.showMessage(data.success ? t('admin.resetOk') : t('admin.error', { e: data.error }), data.success);
                await this.refresh();
            });
        },

        showModal(title, message, callback) {
            $('modalTitle').textContent = title;
            $('modalMessage').textContent = message;
            $('confirmModal').classList.remove('hidden');
            this.modalCallback = callback;
            $('modalConfirmBtn').onclick = async () => {
                const cb = this.modalCallback;
                this.closeModal();
                if (cb) await cb();
            };
        },

        closeModal() {
            $('confirmModal').classList.add('hidden');
            this.modalCallback = null;
        },

        logout() {
            API.logout();
            window.location.href = '/';
        }
    };

    window.AdminApp = AdminApp;
    document.addEventListener('DOMContentLoaded', () => AdminApp.init());
})();
