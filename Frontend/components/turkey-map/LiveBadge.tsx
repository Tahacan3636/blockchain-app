"use client";
// =============================================================
// LiveBadge.tsx - Canli Yayin Badge'i
// =============================================================
// Secim sayimi devam ederken "CANLI" yazan kirmizi badge.
// animate-ping ile nabiz animasyonu gosterir.
// =============================================================

import React, { memo } from "react";

interface LiveBadgeProps {
  isLive: boolean;
  lastUpdate: Date;
  totalVotes: number;
}

function LiveBadgeInner({ isLive, lastUpdate, totalVotes }: LiveBadgeProps) {
  const timeStr = lastUpdate.toLocaleTimeString("tr-TR");

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* CANLI badge */}
      {isLive ? (
        <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          CANLI
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-bold">
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-300"></span>
          </span>
          SAYIM TAMAMLANDI
        </div>
      )}

      {/* Son guncelleme ve toplam oy */}
      <span className="text-gray-400 text-sm">
        Son güncelleme: {timeStr}
      </span>
      <span className="text-gray-400 text-sm">
        Toplam oy: {totalVotes.toLocaleString("tr-TR")}
      </span>
    </div>
  );
}

export const LiveBadge = memo(LiveBadgeInner);
