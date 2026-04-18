"use client";
// =============================================================
// MapTooltip.tsx - Harita Hover Tooltip'i
// =============================================================
// Mouse ile bir ilin uzerine gelindiginde gosterilen bilgi kutusu.
// Il adi, sayim yuzdesi, aday oylari ve yuzdeleri goruntulenir.
// fixed pozisyon + mouse koordinatlari ile takip eder.
// =============================================================

import React, { memo } from "react";
import { TooltipData } from "@/lib/types";

interface MapTooltipProps {
  data: TooltipData | null;
}

function MapTooltipInner({ data }: MapTooltipProps) {
  if (!data) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none bg-gray-900 text-white rounded-lg shadow-xl px-4 py-3 min-w-[220px]"
      style={{
        left: data.x + 15,
        top: data.y - 10,
      }}
    >
      {/* Il adi */}
      <div className="font-bold text-base mb-1">{data.provinceName}</div>

      {/* Sayim yuzdesi */}
      <div className="text-gray-400 text-xs mb-2">
        Sayım: %{data.countedPercentage.toFixed(1)}
      </div>

      {/* Aday sonuclari */}
      {data.candidates.map((c) => (
        <div key={c.name} className="flex items-center gap-2 mb-1 last:mb-0">
          {/* Aday renk noktasi */}
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: c.color }}
          />
          <span className="text-sm flex-1 truncate">{c.name}</span>
          <span className="text-sm font-mono font-bold">
            %{c.percentage.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            ({c.votes.toLocaleString("tr-TR")})
          </span>
        </div>
      ))}
    </div>
  );
}

export const MapTooltip = memo(MapTooltipInner);
