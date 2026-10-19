/**
 * ステージ0: スタート画面
 * アプリの目的、ルール、得点表、目標予想入力
 */

import React, { useState } from 'react';
import { Target, ArrowRight, ShieldAlert, Award, Compass, Sparkles } from 'lucide-react';
import { ReportState } from '../types';

interface Stage0StartProps {
  reportState: ReportState;
  onUpdateReport: (updates: Partial<ReportState>) => void;
  onProceed: () => void;
}

export const Stage0Start: React.FC<Stage0StartProps> = ({
  reportState,
  onUpdateReport,
  onProceed,
}) => {
  const [expectedScore, setExpectedScore] = useState(
    reportState.initialPredictions.expectedScore
  );
  const [strategy, setStrategy] = useState(reportState.initialPredictions.strategy);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedScore.trim() || !strategy.trim()) {
      setErrorMsg('予想得点と作戦の両方を入力してください（振り返りレポートで使用します）');
      return;
    }

    onUpdateReport({
      initialPredictions: {
        expectedScore: expectedScore.trim(),
        strategy: strategy.trim(),
      },
    });
    onProceed();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* ヒーローカード */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-[#5AB0F0] text-xs font-bold mb-3 border border-sky-100 dark:border-sky-900/50">
            <Compass className="w-3.5 h-3.5" />
            <span>物理基礎 · エネルギー保存と斜方投射</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1D2B53] dark:text-[#EAEFFC] tracking-tight leading-tight mb-3">
            ボールコースター・ミッション
          </h2>
          <p className="text-sm sm:text-base text-sub leading-relaxed">
            使えるレールは <strong className="text-[#1D2B53] dark:text-[#EAEFFC] font-bold">6.0 m</strong>。
            スタートの高さを上げればエネルギーは増えますが、そのぶん坂道にレールを取られてしまいます。
            「エネルギー」と「レール」の限られた資源をどう配分するかを考え、最高得点を目指しましょう！
          </p>
        </div>

        {/* 背景装飾 */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#5AB0F0]/10 pointer-events-none blur-2xl" />
      </div>

      {/* 3大制約 & コース構造 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* コースのルール */}
        <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-[#5AB0F0]" />
            コース設計の厳格なルール
          </h3>
          <ul className="space-y-2 text-xs text-sub leading-normal">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC]">1.</span>
              <span>
                コースの順番は固定：
                <span className="font-mono text-[#1D2B53] dark:text-[#EAEFFC]">スタート → ループ → ゆっくり区間 → 発射台 →（空中）→ 缶</span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC]">2.</span>
              <span>
                レールは <strong className="text-[#E63946]">6.0 m 以内</strong>。1 cm でも超えると走らせられません。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC]">3.</span>
              <span>
                坂の傾きは <strong className="text-[#1D2B53] dark:text-[#EAEFFC]">30° 固定</strong>。高さを Δh 変えると、レールを <strong className="text-[#1D2B53] dark:text-[#EAEFFC]">2 × |Δh|</strong> 消費します。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC]">4.</span>
              <span>
                支柱高さは <strong className="text-[#1D2B53] dark:text-[#EAEFFC]">10〜150 cm（10cm刻み）</strong>。ゆっくり区間のみ 5cm刻みで細かく調整可能。
              </span>
            </li>
          </ul>
        </div>

        {/* 得点表 */}
        <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-[#FFC93C]" />
            得点システム
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60 flex justify-between items-center">
              <span>🌀 <strong>大ループ通過</strong> / <strong>小ループ通過</strong></span>
              <span className="font-bold text-[#5AB0F0]">+30点 / +10点</span>
            </div>
            <div className="p-2 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60 flex justify-between items-center">
              <span>🐢 <strong>ゆっくり区間</strong> (5.0 km/h未満)</span>
              <span className="font-bold text-[#FFC93C]">0.1km/h遅いごとに +1点</span>
            </div>
            <div className="p-2 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60 flex justify-between items-center">
              <span>🎯 <strong>缶当て命中</strong> (サイズ + つるす高さ)</span>
              <span className="font-bold text-[#1F9D74]">最大 +80点 (小30 + 140cm 50)</span>
            </div>
            <p className="text-[11px] text-sub text-right">※途中で落下・停止した場合はそこまでの得点で終了</p>
          </div>
        </div>
      </div>

      {/* ミッション全体の流れ */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-sub uppercase tracking-wider mb-3">授業全体の流れ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#5AB0F0] mb-1">STEP 1: 3つの練習</div>
            <p className="text-sub text-[11px]">
              レール制限なしで、ループの通過条件・ゆっくり区間の停止限界・缶当ての照準の物理法則を解明します。
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#FFC93C] mb-1">STEP 2: 本番設計 & 10回試走</div>
            <p className="text-sub text-[11px]">
              6mの制限の中で設計。「理想の1回」と摩擦などのばらつきが入る「本番10回連続」で平均点を競います。
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#1F9D74] mb-1">STEP 3: 振り返りレポート</div>
            <p className="text-sub text-[11px]">
              試行錯誤のプロセスと問いの考察を1枚のレポートにまとめ、印刷・PDF・テキストコピーで提出します。
            </p>
          </div>
        </div>
      </div>

      {/* 予想入力フォーム (必須) */}
      <form onSubmit={handleStart} className="bg-white dark:bg-[#17223B] border-2 border-[#5AB0F0] dark:border-[#4D9DE0] rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
          <Sparkles className="w-5 h-5 text-[#5AB0F0]" />
          <span>実験前の予想を立てよう（必須）</span>
        </div>

        <p className="text-xs text-sub">
          設計を始める前に、自分の直感と作戦を記録します。入力すると練習ステージへ進めます。
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-1">
              Q1. 何点くらい取れそうだと思いますか？ <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="例: 100点前後を目指したい、90点は手堅く取りたい"
              value={expectedScore}
              onChange={(e) => {
                setExpectedScore(e.target.value);
                setErrorMsg('');
              }}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-1">
              Q2. どこで得点を稼ぐつもりですか？（ループ重視？ ゆっくり区間？ 缶当て？） <span className="text-[#E63946]">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="例: レールを節約して大ループを通過させ、高い缶に確実に当てて稼ぎたい"
              value={strategy}
              onChange={(e) => {
                setStrategy(e.target.value);
                setErrorMsg('');
              }}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
            />
          </div>

          <p className="text-[11px] text-sub">
            ※名前や連絡先などの個人情報は書かないでね。データはこのブラウザ内にのみ保存されます。
          </p>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs font-bold text-[#E63946]">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1D2B53] hover:bg-[#15203e] dark:bg-[#5AB0F0] dark:hover:bg-[#4a9de0] text-white dark:text-[#0E1626] font-bold text-sm shadow-md transition-all transform active:scale-98"
            >
              <span>予想を決定して練習ステージへ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
