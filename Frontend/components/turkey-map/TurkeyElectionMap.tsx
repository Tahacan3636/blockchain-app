"use client";
// =============================================================
// TurkeyElectionMap.tsx - Ana Turkiye Secim Haritasi
// =============================================================
// react-simple-maps ile interaktif SVG harita.
// Her il oy oranina gore renklendirilir.
// Hover ile tooltip gosterilir.
//
// Performans:
// - useMemo ile renk hesaplamalari cache'lenir
// - useCallback ile event handler'lar stabil kalir
// - CSS transition ile yumusak renk gecisi (React re-render degil)
// - memo() ile gereksiz render onlenir
// =============================================================

import React, { useState, useMemo, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { useLiveVotes } from "@/hooks/useLiveVotes";
import { getProvinceColor } from "@/lib/voteUtils";
import { candidates } from "@/lib/candidates";
import { TooltipData } from "@/lib/types";
import { MapTooltip } from "./MapTooltip";
import { LiveBadge } from "./LiveBadge";

const GEO_URL = "/data/tr-cities.json";

function TurkeyElectionMapInner() {
  const electionState = useLiveVotes();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Her il icin rengi hesapla (sadece provinces degisince)
  const provinceColors = useMemo(() => {
    const colors: Record<number, string> = {};
    electionState.provinces.forEach((data, code) => {
      colors[code] = getProvinceColor(data);
    });
    return colors;
  }, [electionState.provinces]);

  // Genel sonuclar (ust panel)
  const overallResults = useMemo(() => {
    let total1 = 0;
    let total2 = 0;
    electionState.provinces.forEach((data) => {
      total1 += data.candidates[0]?.votes || 0;
      total2 += data.candidates[1]?.votes || 0;
    });
    const total = total1 + total2;
    return candidates.map((c, i) => ({
      ...c,
      votes: i === 0 ? total1 : total2,
      percentage: total > 0 ? ((i === 0 ? total1 : total2) / total) * 100 : 0,
    }));
  }, [electionState.provinces]);

  // Mouse hover -> tooltip icin yardimci fonksiyon
  const showTooltip = useCallback(
    (code: number, event: React.MouseEvent) => {
      const data = electionState.provinces.get(code);
      if (!data) return;

      const total = data.candidates.reduce((sum, c) => sum + c.votes, 0);
      setTooltip({
        provinceName: data.provinceName,
        countedPercentage: data.countedPercentage,
        candidates: candidates.map((c, i) => ({
          name: c.name,
          color: c.color,
          votes: data.candidates[i]?.votes || 0,
          percentage: total > 0 ? ((data.candidates[i]?.votes || 0) / total) * 100 : 0,
        })),
        x: event.clientX,
        y: event.clientY,
      });
    },
    [electionState.provinces]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltip((prev) =>
      prev ? { ...prev, x: event.clientX, y: event.clientY } : null
    );
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-950 text-white">
      {/* Ust Panel - Baslik ve Genel Sonuclar */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-2">
          Türkiye Seçim Haritası
        </h1>
        <LiveBadge
          isLive={electionState.isLive}
          lastUpdate={electionState.lastUpdate}
          totalVotes={electionState.totalVotes}
        />

        {/* Aday sonuc kartlari */}
        <div className="grid grid-cols-2 gap-4 mt-6 max-w-2xl">
          {overallResults.map((c) => (
            <div
              key={c.id}
              className="rounded-xl p-4"
              style={{
                backgroundColor: c.color + "20",
                borderLeft: `4px solid ${c.color}`,
              }}
            >
              <div className="text-sm text-gray-400">{c.party}</div>
              <div className="font-bold text-lg">{c.name}</div>
              <div className="text-3xl font-bold mt-1" style={{ color: c.color }}>
                %{c.percentage.toFixed(1)}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {c.votes.toLocaleString("tr-TR")} oy
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Harita */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [35.5, 39.0],
            scale: 1800,
          }}
          width={800}
          height={400}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = geo.properties.number as number;
                const fillColor = provinceColors[code] || "#e5e7eb";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke="#1f2937"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        outline: "none",
                        transition: "fill 0.8s ease",
                      },
                      hover: {
                        outline: "none",
                        strokeWidth: 1.5,
                        stroke: "#ffffff",
                        cursor: "pointer",
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    onMouseEnter={(event) => showTooltip(code, event)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      <MapTooltip data={tooltip} />

      {/* Renk legendi */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex items-center gap-6 justify-center text-sm text-gray-400">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-4 rounded"
                style={{ backgroundColor: c.color }}
              />
              <span>{c.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded bg-gray-300" />
            <span>Yakın yarış</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TurkeyElectionMap = memo(TurkeyElectionMapInner);
