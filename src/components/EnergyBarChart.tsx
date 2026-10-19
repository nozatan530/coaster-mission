/**
 * エネルギー変化 棒グラフコンポーネント
 * 運動 K / 位置 U / 熱など T の推移をリアルタイム表示
 */

import React from 'react';
import { TrajectoryPoint } from '../types';

interface EnergyBarChartProps {
  currentPoint: TrajectoryPoint | null;
  startHeight: number;
}

export const EnergyBarChart: React.FC<EnergyBarChartProps> = ({
  currentPoint,
  startHeight,
}) => {
  // 基準全エネルギー (J/kg): E_total = g * h_start
  const initialTotalE = 9.8 * Math.max(0.1, startHeight);

  const K = currentPoint ? Math.max(0, currentPoint.K) : 0;
  const U = currentPoint ? Math.max(0, currentPoint.U) : initialTotalE;
  const T = currentPoint ? Math.max(0, currentPoint.T) : 0;
  const total = Math.max(0.001, K + U + T);

  // 全体に対する割合 (%)
  const kPct = Math.min(100, (K / total) * 100);
  const uPct = Math.min(100, (U / total) * 100);
  const tPct = Math.min(100, (T / total) * 100);

  const speedMs = currentPoint ? currentPoint.v : 0;
  const speedKmh = speedMs * 3.6;
  const heightCm = currentPoint ? Math.round(currentPoint.y * 100) : Math.round(startHeight * 100);
  const sectionName = currentPoint ? currentPoint.section : 'スタート前';

  return (
    <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-4 shadow-sm">
      {/* ヘッダー情報 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[#D6DEF0]/60 dark:border-[#263657]/60">
        <div>
          <span className="text-xs font-bold text-[#5AB0F0] dark:text-[#4D9DE0] uppercase tracking-wide">
            リアルタイム物理量
          </span>
          <div className="text-sm font-semibold text-[#1D2B53] dark:text-[#EAEFFC] truncate max-w-[200px]">
            {sectionName}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-[#F4F8FF] dark:bg-[#0E1626] px-2.5 py-1 rounded-lg border border-[#D6DEF0] dark:border-[#263657]">
            <span className="text-sub text-[10px] block">高さ y</span>
            <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC] font-mono">{heightCm} cm</span>
          </div>
          <div className="bg-[#F4F8FF] dark:bg-[#0E1626] px-2.5 py-1 rounded-lg border border-[#D6DEF0] dark:border-[#263657]">
            <span className="text-sub text-[10px] block">速さ v</span>
            <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC] font-mono">
              {speedMs.toFixed(2)} m/s <span className="text-sub font-normal">({speedKmh.toFixed(1)} km/h)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 積み上げバー (エネルギー保存則の可視化: K + U + T = 一定) */}
      <div className="mb-3">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="font-medium text-[#1D2B53] dark:text-[#EAEFFC]">エネルギー配分 (保存則)</span>
          <span className="text-sub text-[11px] font-mono">合計: {total.toFixed(1)} J/kg</span>
        </div>
        <div className="h-6 w-full rounded-md overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
          <div
            style={{ width: `${kPct}%` }}
            className="bg-[#5AB0F0] transition-all duration-75 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
            title={`運動 K: ${kPct.toFixed(1)}%`}
          >
            {kPct > 12 && `K ${Math.round(kPct)}%`}
          </div>
          <div
            style={{ width: `${uPct}%` }}
            className="bg-[#FFC93C] transition-all duration-75 flex items-center justify-center text-[10px] font-bold text-[#1D2B53] overflow-hidden"
            title={`位置 U: ${uPct.toFixed(1)}%`}
          >
            {uPct > 12 && `U ${Math.round(uPct)}%`}
          </div>
          <div
            style={{ width: `${tPct}%` }}
            className="bg-[#E63946] transition-all duration-75 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
            title={`熱など T: ${tPct.toFixed(1)}%`}
          >
            {tPct > 12 && `T ${Math.round(tPct)}%`}
          </div>
        </div>
      </div>

      {/* 個別エネルギーメーター */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
        {/* 運動エネルギー K */}
        <div className="p-2 rounded-lg bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40">
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5AB0F0]"></span>
            <span className="text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC]">運動 K</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-[#5AB0F0]">
            {K.toFixed(2)}
          </div>
          <div className="text-[10px] text-sub font-mono">J/kg</div>
        </div>

        {/* 位置エネルギー U */}
        <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#FFC93C]"></span>
            <span className="text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC]">位置 U</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-[#D97706] dark:text-[#FFC93C]">
            {U.toFixed(2)}
          </div>
          <div className="text-[10px] text-sub font-mono">J/kg</div>
        </div>

        {/* 熱など T */}
        <div className="p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
            <span className="text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC]">熱など T</span>
          </div>
          <div className="font-mono text-sm font-extrabold text-[#E63946]">
            {T.toFixed(2)}
          </div>
          <div className="text-[10px] text-sub font-mono">J/kg</div>
        </div>
      </div>
    </div>
  );
};
