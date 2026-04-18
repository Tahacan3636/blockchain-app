"use client";
// =============================================================
// useLiveVotes.ts - Canli Oy Simulasyonu Hook'u
// =============================================================
// setInterval ile 2 saniyede bir rastgele illerin oylarini gunceller.
// Gercek bir backend olmadan "canli secim gecesi" etkisi yaratir.
//
// Ileride WebSocket'e geciste sadece setInterval yerine ws.onmessage
// kullanilir, hook'un dondurdugu ElectionState degismez.
// =============================================================

import { useState, useEffect, useRef } from "react";
import { ElectionState, ProvinceVoteData } from "@/lib/types";
import { provinces } from "@/lib/provinces";
import { generateInitialVotes, generateVoteIncrement } from "@/lib/voteUtils";

export function useLiveVotes() {
  const [electionState, setElectionState] = useState<ElectionState>({
    provinces: new Map(),
    totalVotes: 0,
    lastUpdate: new Date(),
    isLive: true,
  });

  // useRef: setInterval icinden guncel state'e erisim icin
  const stateRef = useRef(electionState);
  stateRef.current = electionState;

  useEffect(() => {
    // 1) Baslangic verilerini olustur (bir kere)
    const initial = generateInitialVotes();
    let totalVotes = 0;
    initial.forEach((p) => (totalVotes += p.totalVotes));

    setElectionState({
      provinces: initial,
      totalVotes,
      lastUpdate: new Date(),
      isLive: true,
    });

    // 2) Her 2 saniyede rastgele 5-15 ili guncelle
    const interval = setInterval(() => {
      setElectionState((prev) => {
        // Tum iller %100'e ulastiysa dur
        let allDone = true;
        prev.provinces.forEach((p) => {
          if (p.countedPercentage < 100) allDone = false;
        });
        if (allDone) {
          clearInterval(interval);
          return { ...prev, isLive: false };
        }

        const newProvinces = new Map(prev.provinces);
        // Rastgele 5-15 il sec
        const updateCount = 5 + Math.floor(Math.random() * 11);
        const provinceCodes = provinces.map((p) => p.code);

        for (let i = 0; i < updateCount; i++) {
          const randomCode =
            provinceCodes[Math.floor(Math.random() * provinceCodes.length)];
          const current = newProvinces.get(randomCode);
          if (!current) continue;

          const province = provinces.find((p) => p.code === randomCode);
          if (!province) continue;

          const updated = generateVoteIncrement(current, province.population);
          newProvinces.set(randomCode, updated);
        }

        let newTotal = 0;
        newProvinces.forEach((p) => (newTotal += p.totalVotes));

        return {
          provinces: newProvinces,
          totalVotes: newTotal,
          lastUpdate: new Date(),
          isLive: true,
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return electionState;
}
