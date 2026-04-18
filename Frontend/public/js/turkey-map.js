// =============================================================
// turkey-map.js - Turkiye Secim Haritasi (Vanilla JS + SVG)
// =============================================================
// Dashboard'a gomulu interaktif Turkiye haritasi.
// GeoJSON verisinden SVG path'leri olusturur.
// Her il, gercek oy verisine gore renklendirilir.
// GET /api/results/map endpoint'inden veri cekilir.
// 5 saniyede bir polling yaparak canli guncellenir.
//
// Kullanim:
//   TurkeyMap.init('turkeyMapContainer');
//   TurkeyMap.setTooltipRenderer(fn);  // fn(code) => HTMLElement
//   TurkeyMap.setOnClick(fn);          // fn(code)
// =============================================================

const TurkeyMap = (function () {
    'use strict';

    // ==================== ADAY TANIMLARI ====================
    const CANDIDATES = [
        { id: 1, name: 'FENERBAHÇE', party: 'Fenerbahçe SK', color: '#001e62' },
        { id: 2, name: 'GALATASARAY', party: 'Galatasaray SK', color: '#c8102e' },
    ];

    // ==================== STATE ====================
    let provinceVotes = {};   // { code: { c1: votes, c2: votes } }
    let svgPaths = {};        // { code: SVGPathElement }
    let tooltipEl = null;
    let containerEl = null;
    let pollIntervalId = null;

    // Disaridan set edilen callback'ler (DRY prensibi)
    let _tooltipRenderer = null;  // function(code) => HTMLElement | null
    let _onClickCallback = null;  // function(code)

    // ==================== PROJEKSIYON ====================
    const BOUNDS = { minLon: 25.5, maxLon: 45.0, minLat: 35.8, maxLat: 42.5 };
    const SVG_WIDTH = 800;
    const SVG_HEIGHT = 380;

    function projectLon(lon) {
        return ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * SVG_WIDTH;
    }

    function projectLat(lat) {
        return ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * SVG_HEIGHT;
    }

    // ==================== GEOJSON -> SVG PATH ====================
    function coordsToPath(coords) {
        if (!coords || coords.length === 0) return '';
        let d = '';
        coords.forEach((point, i) => {
            const x = projectLon(point[0]).toFixed(2);
            const y = projectLat(point[1]).toFixed(2);
            d += (i === 0 ? `M${x},${y}` : `L${x},${y}`);
        });
        d += 'Z';
        return d;
    }

    function geometryToPath(geometry) {
        let d = '';
        if (geometry.type === 'Polygon') {
            geometry.coordinates.forEach(ring => {
                d += coordsToPath(ring);
            });
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                polygon.forEach(ring => {
                    d += coordsToPath(ring);
                });
            });
        }
        return d;
    }

    // ==================== RENK HESAPLAMA ====================
    function interpolateColor(c1, c2, t) {
        const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
        const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    function getProvinceColor(data) {
        if (!data || (data.c1 + data.c2) === 0) return '#e5e7eb';
        const total = data.c1 + data.c2;
        const winnerPct = (Math.max(data.c1, data.c2) / total) * 100;
        const winnerColor = data.c1 >= data.c2 ? CANDIDATES[0].color : CANDIDATES[1].color;
        const intensity = Math.max(0, Math.min(1, (winnerPct - 50) / 15));
        return interpolateColor('#f0f0f0', winnerColor, intensity);
    }

    // ==================== API'DEN VERI CEK ====================
    async function fetchMapData() {
        try {
            const base = (typeof API_BASE !== 'undefined') ? API_BASE : '';
            const res = await fetch(base + '/api/results/map');
            const data = await res.json();
            if (!data.success) return;

            // provinceVotes state'ini guncelle
            // API response: { provinces: { "6": { "1": 5, "2": 3 }, ... } }
            provinceVotes = {};
            Object.keys(data.provinces).forEach(code => {
                const pData = data.provinces[code];
                provinceVotes[code] = {
                    c1: pData['1'] || 0,
                    c2: pData['2'] || 0
                };
            });

            updateMapColors();
            updateSummary();
        } catch (err) {
            console.error('Harita verisi cekilemedi:', err);
        }
    }

    // ==================== UI GUNCELLEME ====================
    function updateMapColors() {
        Object.keys(svgPaths).forEach(code => {
            const path = svgPaths[code];
            const data = provinceVotes[code];
            const color = getProvinceColor(data);
            path.style.fill = color;
        });
    }

    function updateSummary() {
        let total1 = 0, total2 = 0;
        Object.values(provinceVotes).forEach(d => {
            total1 += d.c1;
            total2 += d.c2;
        });
        const total = total1 + total2;
        const pct1 = total > 0 ? ((total1 / total) * 100).toFixed(1) : '0.0';
        const pct2 = total > 0 ? ((total2 / total) * 100).toFixed(1) : '0.0';

        const summaryEl = document.getElementById('mapSummary');
        if (summaryEl) {
            if (total === 0) {
                summaryEl.innerHTML = `
                    <div class="text-gray-400 text-sm">Henüz oy verisi yok</div>
                `;
            } else {
                summaryEl.innerHTML = `
                    <div class="flex items-center justify-center gap-6 flex-wrap">
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-3 h-3 rounded-full" style="background:${CANDIDATES[0].color}"></span>
                            <span class="font-semibold text-gray-700">${CANDIDATES[0].name}</span>
                            <span class="font-bold" style="color:${CANDIDATES[0].color}">%${pct1}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-3 h-3 rounded-full" style="background:${CANDIDATES[1].color}"></span>
                            <span class="font-semibold text-gray-700">${CANDIDATES[1].name}</span>
                            <span class="font-bold" style="color:${CANDIDATES[1].color}">%${pct2}</span>
                        </div>
                        <div class="text-gray-500 text-sm">
                            Toplam: ${total.toLocaleString('tr-TR')} oy
                        </div>
                    </div>
                `;
            }
        }
    }

    // ==================== TOOLTIP ====================
    function showTooltip(code, event) {
        if (!tooltipEl) return;

        tooltipEl.innerHTML = '';

        // Disaridan renderer set edildiyse onu kullan (DRY — createCityCard)
        if (_tooltipRenderer) {
            const content = _tooltipRenderer(code);
            if (content instanceof HTMLElement) {
                tooltipEl.appendChild(content);
            } else if (typeof content === 'string') {
                tooltipEl.innerHTML = content;
            }
        } else {
            // Fallback: basit tooltip
            const name = svgPaths[code]?.getAttribute('data-name') || `İl ${code}`;
            tooltipEl.innerHTML = `
                <div class="font-bold text-sm mb-1">${name}</div>
                <div class="text-gray-400 text-xs">Henüz oy yok</div>
            `;
        }

        tooltipEl.style.display = 'block';
        positionTooltip(event);
    }

    function positionTooltip(event) {
        if (!tooltipEl) return;
        const pad = 15;
        let x = event.clientX + pad;
        let y = event.clientY - 10;

        // Ekran kenarlarindan tasmamasi icin
        const rect = tooltipEl.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 10) {
            x = event.clientX - rect.width - pad;
        }
        if (y + rect.height > window.innerHeight - 10) {
            y = window.innerHeight - rect.height - 10;
        }
        if (y < 10) y = 10;

        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.style.display = 'none';
    }

    // ==================== INIT ====================
    async function init(containerId) {
        containerEl = document.getElementById(containerId);
        if (!containerEl) return;

        // Baslik + Live badge
        containerEl.innerHTML = `
            <div class="text-center mb-4">
                <div class="flex items-center justify-center gap-3 mb-2">
                    <h2 class="text-xl md:text-2xl font-black text-gray-800 tracking-tight">İL BAZLI SEÇİM HARİTASI</h2>
                    <span id="mapLiveBadge" class="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <span class="relative flex h-2.5 w-2.5">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                        CANLI
                    </span>
                </div>
                <div id="mapSummary" class="text-sm text-gray-600">
                    <div class="text-gray-400 text-sm">Veriler yükleniyor...</div>
                </div>
            </div>
            <div id="mapSvgWrapper" class="relative w-full" style="max-width:800px; margin:0 auto;"></div>
        `;

        // Tooltip — kart gorunumlu container (icerik disaridan gelecek)
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'fixed z-50 pointer-events-none';
        tooltipEl.style.cssText = 'display:none; border-radius:8px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05); width:460px;';
        document.body.appendChild(tooltipEl);

        // GeoJSON yukle
        try {
            const res = await fetch('/data/tr-cities.json');
            const geo = await res.json();

            // SVG olustur (tum iller gri baslayacak)
            renderMap(geo);

            // Ilk veri cekimi
            await fetchMapData();

            // 5 saniyede bir polling
            pollIntervalId = setInterval(fetchMapData, 5000);
        } catch (err) {
            containerEl.innerHTML += '<p class="text-red-500 text-center">Harita yüklenemedi.</p>';
            console.error('Turkey map error:', err);
        }
    }

    function renderMap(geoData) {
        const wrapper = document.getElementById('mapSvgWrapper');
        if (!wrapper) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
        svg.setAttribute('class', 'w-full h-auto');
        svg.style.maxHeight = '450px';

        geoData.features.forEach(feature => {
            const code = feature.properties.number;
            const name = feature.properties.name;
            const pathD = geometryToPath(feature.geometry);
            if (!pathD) return;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('data-code', code);
            path.setAttribute('data-name', name);
            path.setAttribute('fill', '#e5e7eb'); // Baslangicta gri
            path.setAttribute('stroke', '#9ca3af');
            path.setAttribute('stroke-width', '0.5');
            path.style.transition = 'fill 0.8s ease, stroke 0.15s ease, stroke-width 0.15s ease';
            path.style.cursor = 'pointer';

            // Hover efektleri (orijinal)
            path.addEventListener('mouseenter', (e) => {
                path.setAttribute('stroke', '#1f2937');
                path.setAttribute('stroke-width', '1.5');
                showTooltip(code, e);
            });
            path.addEventListener('mousemove', positionTooltip);
            path.addEventListener('mouseleave', () => {
                path.setAttribute('stroke', '#9ca3af');
                path.setAttribute('stroke-width', '0.5');
                hideTooltip();
            });

            // Click — il kartini dropdown'da goster
            path.addEventListener('click', () => {
                if (_onClickCallback) _onClickCallback(code);
            });

            svg.appendChild(path);
            svgPaths[code] = path;
        });

        wrapper.appendChild(svg);

        // Renk legendi
        const legend = document.createElement('div');
        legend.className = 'flex items-center justify-center gap-4 mt-3 text-xs text-gray-500';
        legend.innerHTML = `
            <div class="flex items-center gap-1.5">
                <span class="inline-block w-3 h-3 rounded" style="background:${CANDIDATES[0].color}"></span>
                <span>${CANDIDATES[0].party}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="inline-block w-3 h-3 rounded" style="background:${CANDIDATES[1].color}"></span>
                <span>${CANDIDATES[1].party}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="inline-block w-3 h-3 rounded bg-gray-200 border border-gray-300"></span>
                <span>Oy yok / Yakın yarış</span>
            </div>
        `;
        wrapper.appendChild(legend);
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        setTooltipRenderer(fn) { _tooltipRenderer = fn; },
        setOnClick(fn) { _onClickCallback = fn; }
    };
})();
