/**
 * 提出用レポート画面 (Stage 6)
 * 最終設計図・ベストスコア・記録表・予想比較・練習の答え・振り返りの問い3つ・印刷/PDF保存・テキストコピー
 */

import React, { useState, useMemo } from 'react';
import {
  CourseConfig,
  Practice1State,
  Practice2State,
  Practice3State,
  ReportState,
  TrialHistoryEntry,
} from '../types';
import { CourseCanvas } from './CourseCanvas';
import { calculateRailUsage, simulateRun, PHYSICS_CONSTANTS } from '../physics';
import {
  Printer,
  Copy,
  Check,
  AlertCircle,
  Award,
  CheckCircle2,
  FileText,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface StageReportProps {
  config: CourseConfig;
  reportState: ReportState;
  p1State: Practice1State;
  p2State: Practice2State;
  p3State: Practice3State;
  historyEntries: TrialHistoryEntry[];
  onUpdateReport: (updates: Partial<ReportState>) => void;
  // レポートの画面でも、練習の答えと記録表の理由を書き直せるようにする
  onUpdateP1: (updates: Partial<Practice1State>) => void;
  onUpdateP2: (updates: Partial<Practice2State>) => void;
  onUpdateP3: (updates: Partial<Practice3State>) => void;
  onUpdateNote: (id: string, notes: string) => void;
}

export const StageReport: React.FC<StageReportProps> = ({
  config: currentConfig,
  reportState,
  p1State,
  p2State,
  p3State,
  historyEntries,
  onUpdateReport,
  onUpdateP1,
  onUpdateP2,
  onUpdateP3,
  onUpdateNote,
}) => {
  const updatePrediction = (key: 'expectedScore' | 'strategy', val: string) => {
    onUpdateReport({ initialPredictions: { ...reportState.initialPredictions, [key]: val } });
  };
  const [copySuccess, setCopySuccess] = useState(false);
  // 自動でコピーできなかったとき、手でコピーしてもらうための文章
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);

  // ベスト記録の算出
  const bestEntry = useMemo(() => {
    if (historyEntries.length === 0) return null;
    return [...historyEntries].sort((a, b) => b.averageScore - a.averageScore)[0];
  }, [historyEntries]);

  // レポートの「最終設計」は、10回連続の平均点がいちばん高かった設計。まだ記録がなければ今の設計
  const config = bestEntry?.config ?? currentConfig;

  // レール情報と理想計算
  const railInfo = useMemo(() => calculateRailUsage(config), [config]);
  const idealSim = useMemo(() => simulateRun(config, { isIdeal: true }), [config]);

  // 未入力チェック
  const checklist = useMemo(() => {
    const hasPrediction =
      Boolean(reportState.initialPredictions.expectedScore.trim()) &&
      Boolean(reportState.initialPredictions.strategy.trim());
    const hasP1 = Boolean(p1State.answer.trim());
    const hasP2 = Boolean(p2State.answer.trim());
    const hasP3 = Boolean(p3State.answer.trim());
    const hasHistory = historyEntries.length > 0;
    const hasQ1 = Boolean(reportState.reflection.q1.trim());
    const hasQ2 = Boolean(reportState.reflection.q2.trim());
    const hasQ3 = Boolean(reportState.reflection.q3.trim());

    const totalItems = 8;
    const completedItems = [
      hasPrediction,
      hasP1,
      hasP2,
      hasP3,
      hasHistory,
      hasQ1,
      hasQ2,
      hasQ3,
    ].filter(Boolean).length;

    return {
      hasPrediction,
      hasP1,
      hasP2,
      hasP3,
      hasHistory,
      hasQ1,
      hasQ2,
      hasQ3,
      allComplete: completedItems === totalItems,
      completedItems,
      totalItems,
    };
  }, [reportState, p1State, p2State, p3State, historyEntries]);

  // 振り返り設問の更新
  const updateReflection = (key: 'q1' | 'q2' | 'q3', val: string) => {
    onUpdateReport({
      reflection: {
        ...reportState.reflection,
        [key]: val,
      },
    });
  };

  // 印刷
  const handlePrint = () => {
    window.print();
  };

  // テキストコピー
  const handleCopyText = async () => {
    const p1HintsCount = p1State.hintsOpened.filter(Boolean).length;
    const p2HintsCount = p2State.hintsOpened.filter(Boolean).length;
    const p3HintsCount = p3State.hintsOpened.filter(Boolean).length;

    const loopDesc =
      config.loopType === 'none'
        ? 'なし'
        : config.loopType === 'small'
        ? `小ループ (底${Math.round(config.loop1Bottom * 100)}cm)`
        : config.loopType === 'large'
        ? `大ループ (底${Math.round(config.loop1Bottom * 100)}cm)`
        : config.loopType === 'small_large'
        ? `小(底${Math.round(config.loop1Bottom * 100)}cm) → 大(底${Math.round(config.loop2Bottom * 100)}cm)`
        : `大(底${Math.round(config.loop1Bottom * 100)}cm) → 小(底${Math.round(config.loop2Bottom * 100)}cm)`;

    const text = `【ボールコースター・ミッション 振り返りレポート】

■ 1. 最初の予想
・目標予想得点: ${reportState.initialPredictions.expectedScore || '（未記入）'}
・得点を狙う作戦: ${reportState.initialPredictions.strategy || '（未記入）'}

■ 2. 練習ステージでの発見
・Q1 (ループの高さ差): ${p1State.answer || '（未記入）'}
  [ヒント参照: ${p1HintsCount}/3段階]
・Q2 (ゆっくり区間のリスク): ${p2State.answer || '（未記入）'}
  [ヒント参照: ${p2HintsCount}/3段階]
・Q3 (缶当ての照準): ${p3State.answer || '（未記入）'}
  [ヒント参照: ${p3HintsCount}/3段階]

■ 3. 最終コース設計（${bestEntry ? `10回連続の平均点がいちばん高かった設計 #${bestEntry.trialNumber}` : 'まだ10回連続をしていないため、いまの設計'}）
・スタート高さ: ${Math.round(config.startHeight * 100)} cm
・ループ: ${loopDesc}
・ゆっくり区間高さ: ${Math.round(config.slowHeight * 100)} cm
・発射台高さ・角度: ${Math.round(config.launchHeight * 100)} cm, ${config.launchAngle}°
・標的缶: ${PHYSICS_CONSTANTS.CAN_SPECS[config.canSize].name} (床から${Math.round(config.canHeight * 100)} cm)
・使用レール長: ${railInfo.total.toFixed(2)} m / ${PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(2)} m (${railInfo.isExceeded ? `${railInfo.excess.toFixed(2)} m 超過` : `残り ${railInfo.remaining.toFixed(2)} m`})
・理想の得点: ${idealSim.totalScore} 点

■ 4. 本番試走の記録（最高成績）
${
  bestEntry
    ? `・最高の10回平均点: ${bestEntry.averageScore} 点 (成功率: ${bestEntry.successRate}%)`
    : '・試走記録なし'
}
${
  historyEntries.length > 0
    ? historyEntries
        .map(
          (h) =>
            `#${h.trialNumber} | 予想:${h.predictedScore ?? '—'} | 理想:${h.idealScore}点 | 平均:${h.averageScore}点 | 成功率:${h.successRate}% | メモ:${h.notes}`
        )
        .join('\n')
    : ''
}

■ 5. 振り返りの問い
1. いちばん得点を左右した判断は何か。エネルギーとレールの配分の言葉で説明しよう:
${reportState.reflection.q1 || '（未記入）'}

2. 缶に当てるために、何に向けて飛ばしたか。それで当たる理由を説明しよう:
${reportState.reflection.q2 || '（未記入）'}

3. 「理想の点」と「平均点」に差が出たのはなぜか。差を小さくするために何を変えたか:
${reportState.reflection.q3 || '（未記入）'}
`;

    const copied = await copyToClipboard(text);
    if (copied) {
      setManualCopyText(null);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } else {
      setManualCopyText(text);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 提出前チェックバー & アクションボタン */}
      <div className="no-print bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {checklist.allComplete ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#1F9D74] text-xs font-bold border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>すべての項目が記入完了しています！</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[#D97706] text-xs font-bold border border-amber-200">
              <AlertCircle className="w-4 h-4" />
              <span>
                記入完了: {checklist.completedItems} / {checklist.totalItems} 項目（未記入の項目に印があります）
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* テキストコピー */}
          <button
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D6DEF0] dark:border-[#263657] bg-slate-50 dark:bg-slate-800 text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC] hover:bg-slate-100 transition-colors shadow-xs"
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1F9D74]" />
                <span className="text-[#1F9D74]">コピー完了！</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-sub" />
                <span>テキストをコピー</span>
              </>
            )}
          </button>

          {/* 印刷 / PDF保存 */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D2B53] dark:bg-[#5AB0F0] text-white dark:text-[#0E1626] text-xs font-bold hover:opacity-90 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>印刷 / PDF保存</span>
          </button>
        </div>
      </div>

      {/* 自動でコピーできなかったときの手動コピー欄 */}
      {manualCopyText !== null && (
        <div className="no-print bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-[#B45309] dark:text-[#FFC93C]">
              自動でコピーできませんでした。下の枠の文章を全部選んで（Ctrl＋A または長押し →「すべて選択」）、コピーしてね。
            </p>
            <button
              onClick={() => setManualCopyText(null)}
              className="text-xs text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC] px-2 py-1 shrink-0"
            >
              閉じる
            </button>
          </div>
          <textarea
            readOnly
            value={manualCopyText}
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
          />
        </div>
      )}

      {/* レポート本文（印刷時にA4に最適化） */}
      <div className="print-card bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* レポートタイトル */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between text-xs text-sub mb-1">
            <span>高校 物理基礎「ボールコースター・ミッション」学習成果レポート</span>
            <span>使えるレール {PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(1)} m</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1D2B53] dark:text-[#EAEFFC]">
            ボールコースター・ミッション 振り返りシート
          </h2>
        </div>

        {/* 1. 最初の予想との比較 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#5AB0F0]" />
              <span>1. 最初の予想と結果の比較</span>
            </span>
            {!checklist.hasPrediction && (
              <span className="text-[10px] text-[#E63946] font-bold">※未記入</span>
            )}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0] dark:border-[#263657]">
              <span className="text-sub block text-[11px] mb-0.5">目標予想得点:</span>
              <input
                type="text"
                value={reportState.initialPredictions.expectedScore}
                onChange={(e) => updatePrediction('expectedScore', e.target.value)}
                placeholder="（未入力）"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
              />
            </div>
            <div className="p-3 rounded-xl bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0] dark:border-[#263657]">
              <span className="text-sub block text-[11px] mb-0.5">得点を狙う作戦:</span>
              <textarea
                rows={2}
                value={reportState.initialPredictions.strategy}
                onChange={(e) => updatePrediction('strategy', e.target.value)}
                placeholder="（未入力）"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
              />
            </div>
          </div>
        </section>

        {/* 2. 最終コース設計図 & パラメータ */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#5AB0F0]" />
            <span>2. 最終コース設計</span>
          </h3>
          <p className="text-[11px] text-sub">
            {bestEntry
              ? `10回連続の平均点がいちばん高かった設計（記録表の #${bestEntry.trialNumber}）`
              : 'まだ10回連続を走らせていないため、いまの設計を表示しています'}
          </p>

          <div className="rounded-xl overflow-hidden border border-[#D6DEF0] dark:border-[#263657]">
            <CourseCanvas config={config} isAnimating={false} staticView className="border-none shadow-none" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sub text-[10px] block">スタート高さ</span>
              <span className="font-bold">{Math.round(config.startHeight * 100)} cm</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sub text-[10px] block">ゆっくり区間高さ</span>
              <span className="font-bold">{Math.round(config.slowHeight * 100)} cm</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sub text-[10px] block">発射台高さ / 角度</span>
              <span className="font-bold">
                {Math.round(config.launchHeight * 100)}cm / {config.launchAngle}°
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sub text-[10px] block">標的缶 / つるす高さ</span>
              <span className="font-bold">
                {PHYSICS_DATA_LABEL(config.canSize)} / {Math.round(config.canHeight * 100)}cm
              </span>
            </div>
          </div>

          {/* 成績サマリー */}
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-sub">使用レール長: </span>
              <strong className="font-mono text-sm text-[#1D2B53] dark:text-[#EAEFFC]">
                {railInfo.total.toFixed(2)} m / {PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(2)} m
              </strong>
              <span className="text-sub text-[11px] ml-1">
                ({railInfo.isExceeded ? `${railInfo.excess.toFixed(2)} m 超過` : `残り ${railInfo.remaining.toFixed(2)} m`})
              </span>
            </div>

            <div>
              <span className="text-sub">理想の点: </span>
              <strong className="font-mono text-sm text-[#5AB0F0] mr-3">
                {idealSim.totalScore} 点
              </strong>

              <span className="text-sub">公式最高平均点: </span>
              <strong className="font-mono text-base text-[#1F9D74]">
                {bestEntry ? `${bestEntry.averageScore} 点` : '未試走'}
              </strong>
              {bestEntry && (
                <span className="text-[11px] text-sub ml-1">
                  (成功率: {bestEntry.successRate}%)
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 3. 練習ステージの答え & ヒント段階 */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-[#5AB0F0]" />
              <span>3. 練習ステージでの考察・答え</span>
            </span>
            {(!checklist.hasP1 || !checklist.hasP2 || !checklist.hasP3) && (
              <span className="text-[10px] text-[#E63946] font-bold">※未記入あり</span>
            )}
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
              <div className="flex items-center justify-between font-bold mb-1">
                <span>① ループ：直径の何倍の高さが必要か？ なぜ同じ高さでは足りないか？</span>
                <span className="text-sub text-[10px] font-normal font-mono">
                  ヒント開放: {p1State.hintsOpened.filter(Boolean).length}/3
                </span>
              </div>
              <textarea
                rows={2}
                value={p1State.answer}
                onChange={(e) => onUpdateP1({ answer: e.target.value })}
                placeholder="（未記入）ここに答えを書こう"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
              />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
              <div className="flex items-center justify-between font-bold mb-1">
                <span>② ゆっくり区間：遅くするほど得点が高いのに、なぜ限界を攻めると危ないか？</span>
                <span className="text-sub text-[10px] font-normal font-mono">
                  ヒント開放: {p2State.hintsOpened.filter(Boolean).length}/3
                </span>
              </div>
              <textarea
                rows={2}
                value={p2State.answer}
                onChange={(e) => onUpdateP2({ answer: e.target.value })}
                placeholder="（未記入）ここに答えを書こう"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
              />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
              <div className="flex items-center justify-between font-bold mb-1">
                <span>③ 発射台・缶当て：何に向けて飛ばしたか？ 速さを変えても当たる理由は？</span>
                <span className="text-sub text-[10px] font-normal font-mono">
                  ヒント開放: {p3State.hintsOpened.filter(Boolean).length}/3
                </span>
              </div>
              <textarea
                rows={2}
                value={p3State.answer}
                onChange={(e) => onUpdateP3({ answer: e.target.value })}
                placeholder="（未記入）ここに答えを書こう"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
              />
            </div>
          </div>
        </section>

        {/* 4. 試走ログ (記録表) */}
        <section className="space-y-2 print-break-inside-avoid">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
            <span>4. 試走と改善の記録表</span>
            {!checklist.hasHistory && (
              <span className="text-[10px] text-[#E63946] font-bold">※未試走</span>
            )}
          </h3>

          {historyEntries.length === 0 ? (
            <p className="text-xs text-sub">まだ10回試走を行っていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-sub">
                    <th className="p-2 w-8 text-center">回</th>
                    <th className="p-2">設計要点</th>
                    <th className="p-2 text-center w-16">予想</th>
                    <th className="p-2 text-center w-16">理想</th>
                    <th className="p-2 text-center w-16">平均点</th>
                    <th className="p-2 text-center w-16">成功率</th>
                    <th className="p-2">何を変えたか・なぜか</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {historyEntries.map((h) => (
                    <tr key={h.id}>
                      <td className="p-2 text-center font-bold font-mono">#{h.trialNumber}</td>
                      <td className="p-2 font-mono text-[10px]">{h.configSummary}</td>
                      <td className="p-2 text-center">{h.predictedScore ?? '—'}</td>
                      <td className="p-2 text-center font-mono">{h.idealScore}点</td>
                      <td className="p-2 text-center font-mono font-bold text-[#1F9D74]">
                        {h.averageScore}点
                      </td>
                      <td className="p-2 text-center font-mono">{h.successRate}%</td>
                      <td className="p-2 min-w-[140px]">
                        <input
                          type="text"
                          value={h.notes}
                          onChange={(e) => onUpdateNote(h.id, e.target.value)}
                          placeholder="何を変えたか・なぜか"
                          aria-label={`#${h.trialNumber} の何を変えたか・なぜか`}
                          className="w-full text-xs px-2 py-1 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 5. 振り返りの問い3つ (入力欄付き) */}
        <section className="space-y-4 pt-2 print-break-inside-avoid">
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Award className="w-4 h-4 text-[#FFC93C]" />
            <span>5. 振り返りの問い（本時の総括）</span>
          </h3>

          <div className="space-y-3 text-xs">
            {/* 問い 1 */}
            <div className="space-y-1">
              <label className="block font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
                <span>
                  問1. いちばん得点を左右した判断は何か。「エネルギー」と「レール」の配分の言葉で説明しよう。
                </span>
                {!checklist.hasQ1 && (
                  <span className="text-[10px] text-[#E63946] font-bold">※要入力</span>
                )}
              </label>
              <textarea
                rows={3}
                placeholder="例: スタートを150cmにすると位置エネルギーは最大になるが、坂道にレールを食われてループを諦めざるを得なかった。そこで..."
                value={reportState.reflection.q1}
                onChange={(e) => updateReflection('q1', e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
              />
            </div>

            {/* 問い 2 */}
            <div className="space-y-1">
              <label className="block font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
                <span>
                  問2. 缶に当てるために、何に向けて飛ばしたか。それで当たる理由を説明しよう。
                </span>
                {!checklist.hasQ2 && (
                  <span className="text-[10px] text-[#E63946] font-bold">※要入力</span>
                )}
              </label>
              <textarea
                rows={3}
                placeholder="例: 発射台を缶の初期位置にまっすぐ向けて飛ばした。ボールと缶の両方に同じ重力加速度gがはたらき、同じ時間で同じ距離（½gt²）だけ落下するため..."
                value={reportState.reflection.q2}
                onChange={(e) => updateReflection('q2', e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
              />
            </div>

            {/* 問い 3 */}
            <div className="space-y-1">
              <label className="block font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between">
                <span>
                  問3. 「理想の点」と「平均点」に差が出たのはなぜか。差を小さくするために何を変えたか。
                </span>
                {!checklist.hasQ3 && (
                  <span className="text-[10px] text-[#E63946] font-bold">※要入力</span>
                )}
              </label>
              <textarea
                rows={3}
                placeholder="例: 理想では通過できても、摩擦μのばらつきでゆっくり区間で停止したり、角度のズレで缶を外したりした。差を減らすために安全マージンとして..."
                value={reportState.reflection.q3}
                onChange={(e) => updateReflection('q3', e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
              />
            </div>

            <p className="text-[10px] text-sub">※名前や連絡先は書かないでね</p>
          </div>
        </section>
      </div>
    </div>
  );
};

function PHYSICS_DATA_LABEL(canSize: string): string {
  if (canSize === 'small') return '小缶(φ6cm)';
  if (canSize === 'medium') return '中缶(φ9cm)';
  return '大缶(φ12cm)';
}

// クリップボードにコピーする。新しい方法が使えないときは、古い方法（execCommand）でも試す
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 下の方法で試す
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
