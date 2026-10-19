/**
 * 本番の設計 & 試走ステージ (Stage 3 & 4)
 * 6.0m レール制限メーター、コース即時反映、1回試走、10回連続、試走ログ記録
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CourseConfig,
  CanSize,
  LoopType,
  MotionType,
  SimulationResult,
  TrialHistoryEntry,
  TrajectoryPoint,
} from '../types';
import { CourseCanvas } from './CourseCanvas';
import { CourseIllustration } from './CourseIllustration';
import { EnergyBarChart } from './EnergyBarChart';
import {
  calculateRailUsage,
  getCanDistance,
  simulateRun,
  simulateTenRuns,
  PHYSICS_CONSTANTS,
  FAIL_REASON_LABELS,
} from '../physics';
import { STORAGE_KEYS, safeGetStorage, safeSetStorage } from '../storage';
import {
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gauge,
  Plus,
  Minus,
  Info,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';

interface StageDesignProps {
  config: CourseConfig;
  onUpdateConfig: (newConfig: CourseConfig) => void;
  onAddHistory: (entry: Omit<TrialHistoryEntry, 'id' | 'timestamp' | 'trialNumber'>) => void;
  historyEntries: TrialHistoryEntry[];
}

export const StageDesign: React.FC<StageDesignProps> = ({
  config,
  onUpdateConfig,
  onAddHistory,
  historyEntries,
}) => {
  // レール計算
  const railInfo = useMemo(() => calculateRailUsage(config), [config]);

  // 理想状態での事前計算（速さの目安・理想得点）
  const idealResult = useMemo(() => simulateRun(config, { isIdeal: true }), [config]);

  // アニメーション・試走状態
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeSimResult, setActiveSimResult] = useState<SimulationResult>(idealResult);
  const [currentPt, setCurrentPt] = useState<TrajectoryPoint | null>(null);

  // 設定変更時に activeSimResult を最新の理想結果に同期
  useEffect(() => {
    setActiveSimResult(idealResult);
    setIsAnimating(false);
  }, [idealResult]);

  const handleAnimationFinish = useCallback(() => {
    setIsAnimating(false);
  }, []);

  // 10回連続結果
  const [batchResult, setBatchResult] = useState<ReturnType<typeof simulateTenRuns> | null>(null);

  // 結果（得点・失敗原因・理想得点・10回連続の結果）は、いまの設計で走らせたあとだけ見せる。
  // 設計を変えたら隠す（前の設計の結果が残って見えないように）
  const configKey = JSON.stringify(config);
  const [ranKey, setRanKey] = useState<string | null>(null);
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const hasRunThisDesign = ranKey === configKey;

  // 変更理由メモ入力
  // 書きかけは端末に保存し、タブを切り替えても消えないようにする
  const [noteInput, setNoteInput] = useState(
    () => safeGetStorage(STORAGE_KEYS.DESIGN_DRAFT, { predicted: '', note: '' }).note
  );
  const [predictedScoreInput, setPredictedScoreInput] = useState(
    () => safeGetStorage(STORAGE_KEYS.DESIGN_DRAFT, { predicted: '', note: '' }).predicted
  );
  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.DESIGN_DRAFT, { predicted: predictedScoreInput, note: noteInput });
  }, [predictedScoreInput, noteInput]);
  const [showDetailRail, setShowDetailRail] = useState(false);

  // 単発走らせる（理想）
  const handleRunIdeal = () => {
    if (railInfo.isExceeded) return;
    setIsAnimating(false);
    const res = simulateRun(config, { isIdeal: true });
    setActiveSimResult(res);
    setRanKey(configKey);
    setTimeout(() => setIsAnimating(true), 20);
  };

  // 単発走らせる（本番ばらつき）
  const handleRunRealOnce = () => {
    if (railInfo.isExceeded) return;
    setIsAnimating(false);
    const res = simulateRun(config, { isIdeal: false });
    setActiveSimResult(res);
    setRanKey(configKey);
    setTimeout(() => setIsAnimating(true), 20);
  };

  // 「すべる物体」は比べるための切り替え。公式記録（10回連続）は「転がる球」でだけ取る
  const isSlidingMode = config.motionType === 'sliding';

  // 10回連続実行
  const handleRunTenTimes = () => {
    if (railInfo.isExceeded || isSlidingMode) return;
    setIsAnimating(false);
    const batch = simulateTenRuns(config);
    setBatchResult(batch);
    setRanKey(configKey);
    setBatchKey(configKey);
    // 最初の1回の軌道でアニメーション
    setActiveSimResult(batch.batchTrials[0]);
    setTimeout(() => setIsAnimating(true), 20);

    // 設計要約の作成
    let loopDesc = 'なし';
    if (config.loopType === 'small') loopDesc = `小(${Math.round(config.loop1Bottom * 100)}cm)`;
    else if (config.loopType === 'large') loopDesc = `大(${Math.round(config.loop1Bottom * 100)}cm)`;
    else if (config.loopType === 'small_large')
      loopDesc = `小(${Math.round(config.loop1Bottom * 100)})→大(${Math.round(config.loop2Bottom * 100)})`;
    else if (config.loopType === 'large_small')
      loopDesc = `大(${Math.round(config.loop1Bottom * 100)})→小(${Math.round(config.loop2Bottom * 100)})`;

    const summary = `開始${Math.round(config.startHeight * 100)}cm / ループ:${loopDesc} / ゆ:${Math.round(
      config.slowHeight * 100
    )}cm / 発:${Math.round(config.launchHeight * 100)}cm(${config.launchAngle}°) / 缶:${
      PHYSICS_CONSTANTS.CAN_SPECS[config.canSize].name
    }(${Math.round(config.canHeight * 100)}cm)`;

    onAddHistory({
      configSummary: summary,
      config: { ...config },
      idealScore: batch.idealResult.totalScore,
      averageScore: batch.averageScore,
      successRate: batch.successRate,
      predictedScore: predictedScoreInput.trim() || '（無記入）',
      notes: noteInput.trim() || '（無記入）',
    });
    // 記録したら、次の設計のために予想と理由の欄を空にする
    setPredictedScoreInput('');
    setNoteInput('');
  };

  // ヘルパー：部分更新
  const updateField = <K extends keyof CourseConfig>(field: K, val: CourseConfig[K]) => {
    setIsAnimating(false);
    onUpdateConfig({ ...config, [field]: val });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* レール制限メーター (常時目立つ位置に表示) */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-[#5AB0F0]" />
            <h3 className="text-sm sm:text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
              使用レールメーター（上限 6.00 m）
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {railInfo.isExceeded ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#E63946] text-xs font-bold border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-4 h-4" />
                <span>+{(railInfo.excess * 100).toFixed(1)} cm 超過！(走らせられません)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#1F9D74] text-xs font-bold border border-emerald-200 dark:border-emerald-900/50">
                <CheckCircle2 className="w-4 h-4" />
                <span>残り {railInfo.remaining.toFixed(2)} m</span>
              </span>
            )}

            <button
              onClick={() => setShowDetailRail(!showDetailRail)}
              className="text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC] p-1 text-xs flex items-center gap-0.5"
            >
              <span>内訳</span>
              {showDetailRail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.min(100, (railInfo.total / 6.0) * 100)}%` }}
            className={`transition-all duration-200 ${
              railInfo.isExceeded ? 'bg-[#E63946]' : 'bg-[#5AB0F0]'
            }`}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-sub mt-1.5 font-mono">
          <span>0.00 m</span>
          <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC] text-xs">
            現在: {railInfo.total.toFixed(2)} m / 6.00 m
          </span>
          <span>6.00 m</span>
        </div>

        {/* レール内訳アコーディオン */}
        {showDetailRail && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-sub font-mono">
            <div>スタート台: 0.30m</div>
            <div>スタート坂: {railInfo.startToFirst.toFixed(2)}m</div>
            <div>ループ1: {railInfo.loop1Rail.toFixed(2)}m</div>
            <div>間坂道: {railInfo.betweenLoops.toFixed(2)}m</div>
            <div>ループ2: {railInfo.loop2Rail.toFixed(2)}m</div>
            <div>ゆっくり前坂: {railInfo.toSlow.toFixed(2)}m</div>
            <div>ゆっくり区間: 0.50m</div>
            <div>発射台坂+台: {(railInfo.slowToLaunch + 0.3).toFixed(2)}m</div>
          </div>
        )}
      </div>

      {/* コース可視化 Canvas & リアルタイム速さ目安 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 各地点の速さ目安 (理想値) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-sub">理想の通過目安:</span>
            {idealResult.speeds.loop1Top !== undefined && (
              <span className="bg-white dark:bg-[#17223B] px-2 py-0.5 rounded border border-[#D6DEF0] dark:border-[#263657] font-mono text-[11px]">
                ループ頂上 {idealResult.speeds.loop1Top.toFixed(1)}m/s
              </span>
            )}
            <span className="bg-white dark:bg-[#17223B] px-2 py-0.5 rounded border border-[#D6DEF0] dark:border-[#263657] font-mono text-[11px]">
              ゆっくり {idealResult.slowSpeedKmh !== undefined ? `${idealResult.slowSpeedKmh.toFixed(1)}km/h` : '停止'}
            </span>
            <span className="bg-white dark:bg-[#17223B] px-2 py-0.5 rounded border border-[#D6DEF0] dark:border-[#263657] font-mono text-[11px]">
              発射速度 {idealResult.speeds.launchTip.toFixed(1)}m/s
            </span>
            {hasRunThisDesign && (
              <span className="bg-amber-50 dark:bg-amber-950/40 text-[#D97706] dark:text-[#FFC93C] font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40 font-mono text-[11px]">
                理想得点: {idealResult.totalScore}点
              </span>
            )}
          </div>

          {/* 転がる球 vs すべる物体 の切替 */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#17223B] p-1 rounded-lg border border-[#D6DEF0] dark:border-[#263657] text-xs">
            <span className="text-sub text-[11px] px-1">物理設定:</span>
            <button
              onClick={() => updateField('motionType', 'rolling')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                config.motionType === 'rolling'
                  ? 'bg-[#5AB0F0] text-white'
                  : 'text-sub hover:text-[#1D2B53]'
              }`}
            >
              転がる球 (0.7mv²)
            </button>
            <button
              onClick={() => updateField('motionType', 'sliding')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                config.motionType === 'sliding'
                  ? 'bg-[#5AB0F0] text-white'
                  : 'text-sub hover:text-[#1D2B53]'
              }`}
            >
              すべる物体 (½mv²)
            </button>
          </div>
        </div>

        {/* コース図 & エネルギーチャート */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CourseCanvas
              config={config}
              simulationResult={activeSimResult}
              isAnimating={isAnimating}
              onAnimationFinish={handleAnimationFinish}
              onCurrentPointChange={setCurrentPt}
              onUpdateConfig={onUpdateConfig}
            />
          </div>
          <div>
            <EnergyBarChart currentPoint={currentPt} startHeight={config.startHeight} />
          </div>
        </div>
      </div>

      {/* 試走アクションバー */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-5 shadow-xs space-y-4">
        {/* 今回の予想得点と試走理由メモ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-sub mb-1">今回の予想得点（走らせる前に入力）</label>
            <input
              type="text"
              placeholder="例: 102点取れそう"
              value={predictedScoreInput}
              onChange={(e) => setPredictedScoreInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
            />
          </div>

          <div>
            <label className="block font-bold text-sub mb-1">何を変えたか・なぜか（記録表に残ります）</label>
            <input
              type="text"
              placeholder="例: 発射台の角度を23°に変えて缶の中心に照準を合わせた"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC]"
            />
          </div>
        </div>

        {/* 走らせるボタン群 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {/* 1回（理想） */}
            <button
              onClick={handleRunIdeal}
              disabled={railInfo.isExceeded || isAnimating}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#1D2B53] dark:text-[#EAEFFC] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5" />
              <span>1回走らせる（理想・ばらつきなし）</span>
            </button>

            {/* 1回（本番） */}
            <button
              onClick={handleRunRealOnce}
              disabled={railInfo.isExceeded || isAnimating}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 border border-[#5AB0F0] text-[#5AB0F0] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5" />
              <span>1回走らせる（本番ばらつき）</span>
            </button>
          </div>

          {/* 10回連続（本番公式記録） */}
          <button
            onClick={handleRunTenTimes}
            disabled={railInfo.isExceeded || isAnimating || isSlidingMode}
            title={isSlidingMode ? '公式記録は「転がる球」で走らせます' : undefined}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1D2B53] dark:bg-[#5AB0F0] text-white dark:text-[#0E1626] text-xs sm:text-sm font-black shadow-md hover:opacity-90 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${isAnimating ? 'animate-spin' : ''}`} />
            <span>10回連続で本番試走！（公式記録）</span>
          </button>
        </div>

        {isSlidingMode && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-[#B45309] dark:text-[#FFC93C] flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              いまは「すべる物体」で比べるモードです。1回ずつ走らせて、転がる球との違いを確かめよう。
              10回連続（公式記録）は「転がる球」に戻すと走らせられます。
            </span>
          </div>
        )}

        {/* まだこの設計で走らせていないときの案内 */}
        {!hasRunThisDesign && !isAnimating && (
          <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-sub flex items-center gap-2">
            <Info className="w-4 h-4 text-[#5AB0F0] shrink-0" />
            <span>この設計ではまだ走らせていません。予想得点を書いてから走らせよう。結果はここに出ます。</span>
          </div>
        )}

        {/* 直近の試走結果表示 */}
        {activeSimResult && !isAnimating && hasRunThisDesign && (
          <div className="p-4 rounded-xl bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0] dark:border-[#263657] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-xs text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-1.5">
                {activeSimResult.canHitSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-[#1F9D74]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#E63946]" />
                )}
                <span>
                  {activeSimResult.isIdeal ? '【理想の1回】' : '【本番の1回】'} 結果得点:{' '}
                  <strong className="text-base font-extrabold text-[#5AB0F0] font-mono">
                    {activeSimResult.totalScore} 点
                  </strong>
                </span>
              </span>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span>ループ: +{activeSimResult.loopPoints}</span>
                <span>·</span>
                <span>
                  ゆっくり: +{activeSimResult.slowSpeedPoints} (
                  {activeSimResult.slowSpeedKmh !== undefined
                    ? `${activeSimResult.slowSpeedKmh.toFixed(1)}km/h`
                    : '停止'}
                  )
                </span>
                <span>·</span>
                <span>缶当て: +{activeSimResult.canPoints}</span>
              </div>
            </div>

            {/* 失敗理由のフィードバック */}
            {!activeSimResult.canHitSuccess && activeSimResult.failDescription && (
              <div className="text-xs text-[#E63946] font-bold bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/40 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>失敗原因: {activeSimResult.failDescription}</span>
              </div>
            )}
          </div>
        )}

        {/* 10回連続の統計・失敗内訳 */}
        {batchResult && batchKey === configKey && (
          <div className="p-4 rounded-xl bg-white dark:bg-[#17223B] border-2 border-[#1F9D74] shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div>
                <span className="text-xs font-bold text-[#1F9D74] uppercase tracking-wide">
                  本番10回連続の公式結果
                </span>
                <div className="text-sm sm:text-base font-black text-[#1D2B53] dark:text-[#EAEFFC]">
                  平均点:{' '}
                  <span className="text-xl text-[#1F9D74] font-mono font-extrabold">
                    {batchResult.averageScore} 点
                  </span>{' '}
                  <span className="text-xs text-sub font-normal">
                    （理想: {batchResult.idealResult.totalScore}点 / 成功率: {batchResult.successRate}%）
                  </span>
                </div>
              </div>

              <div className="text-xs text-sub">
                記録表に自動保存されました（合計 {historyEntries.length} 件）
              </div>
            </div>

            {/* 10回の個別スコア */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-sub mb-1">
                <span>10回の試走スコア:</span>
                <span className="font-normal text-[10px]">クリックするとその回の試走をコースで再生できます</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center font-mono text-xs">
                {batchResult.batchTrials.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsAnimating(false);
                      setActiveSimResult(t);
                      setTimeout(() => setIsAnimating(true), 20);
                    }}
                    className={`py-1.5 rounded border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                      t.canHitSuccess
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#1F9D74] text-[#1F9D74] font-bold'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-[#E63946] text-[#E63946]'
                    }`}
                    title={`試走 #${idx + 1} をコースで再生（得点: ${t.totalScore}点）`}
                  >
                    <span className="text-[9px] block text-sub">#{idx + 1}</span>
                    <span>{t.totalScore}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 失敗の内訳 */}
            {batchResult.successRate < 100 && (
              <div>
                <div className="text-[11px] font-bold text-sub mb-1">失敗の内訳（10回中）:</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(batchResult.failBreakdown)
                    .filter(([_, count]) => count > 0)
                    .map(([reason, count]) => (
                      <span
                        key={reason}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sub text-[11px]"
                      >
                        {FAIL_REASON_LABELS[reason as keyof typeof FAIL_REASON_LABELS] || reason}:{' '}
                        <strong className="text-[#E63946] font-mono">{count}回</strong>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* コース設計パラメータ調整パネル */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-5 shadow-xs space-y-5">
        {/* スマホ・タブレット：操作欄の上に小さなコース図と残りのレールを貼り付け、変えた結果をその場で見せる */}
        <div
          className="lg:hidden sticky z-20 -mx-5 -mt-5 px-3 pt-2 pb-1.5 rounded-t-2xl bg-white/95 dark:bg-[#17223B]/95 backdrop-blur-sm border-b border-[#D6DEF0] dark:border-[#263657]"
          style={{ top: 'var(--header-h, 100px)' }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
            <span className="text-sub">いまのコース</span>
            <span className={railInfo.isExceeded ? 'text-[#E63946]' : 'text-[#1F9D74]'}>
              {railInfo.isExceeded
                ? `レール ${railInfo.excess.toFixed(2)} m 超過`
                : `残りのレール ${railInfo.remaining.toFixed(2)} m`}
            </span>
          </div>
          <CourseIllustration config={config} showLabels={false} showFlight={false} className="max-h-24" />
        </div>

        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-[#5AB0F0]" />
          <h3 className="text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
            各部品の高さ & 設定の調整
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* 1. スタート台 */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <HeightSliderWithButtons
              label="スタート台の高さ（10〜150cm）"
              valueCm={Math.round(config.startHeight * 100)}
              minCm={10}
              maxCm={150}
              stepCm={10}
              onChangeCm={(cm) => updateField('startHeight', cm / 100)}
            />
            <p className="text-[11px] text-sub leading-normal">
              スタートが高いほど位置エネルギーを得られますが、坂道にレール（2×高さ差）を消費します。
            </p>
          </div>

          {/* 2. ループ区間 */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div>
              <label className="block font-bold text-sub mb-1.5">ループの選択</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 text-center font-bold">
                {(
                  [
                    { id: 'none', label: 'なし' },
                    { id: 'small', label: '小のみ' },
                    { id: 'large', label: '大のみ' },
                    { id: 'small_large', label: '小 → 大' },
                    { id: 'large_small', label: '大 → 小' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => updateField('loopType', item.id)}
                    className={`py-1.5 px-1 rounded-lg border text-xs transition-colors ${
                      config.loopType === item.id
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-[#5AB0F0] text-[#5AB0F0]'
                        : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ループ1の最下点高さ */}
            {config.loopType !== 'none' && (
              <HeightSliderWithButtons
                label="ループ1 最下点の高さ"
                valueCm={Math.round(config.loop1Bottom * 100)}
                minCm={10}
                maxCm={Math.max(10, Math.round(config.startHeight * 100) - 10)}
                stepCm={10}
                onChangeCm={(cm) => updateField('loop1Bottom', cm / 100)}
              />
            )}

            {/* ループ2の最下点高さ */}
            {(config.loopType === 'small_large' || config.loopType === 'large_small') && (
              <HeightSliderWithButtons
                label="ループ2 最下点の高さ"
                valueCm={Math.round(config.loop2Bottom * 100)}
                minCm={10}
                maxCm={Math.max(10, Math.round(config.startHeight * 100) - 10)}
                stepCm={10}
                onChangeCm={(cm) => updateField('loop2Bottom', cm / 100)}
              />
            )}
          </div>

          {/* 3. ゆっくり区間 */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <HeightSliderWithButtons
              label="ゆっくり区間の高さ（5cm刻み）"
              valueCm={Math.round(config.slowHeight * 100)}
              minCm={10}
              maxCm={150}
              stepCm={5}
              onChangeCm={(cm) => updateField('slowHeight', cm / 100)}
            />
            <p className="text-[11px] text-sub leading-normal">
              計測区間（0.50m）の中央で時速を測ります。5.0 km/h から 0.1 km/h 遅いごとに +1点！
            </p>
          </div>

          {/* 4. 発射台 & 缶 */}
          <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 space-y-3">
            {/* 発射台の高さ */}
            <HeightSliderWithButtons
              label="発射台の高さ（10〜150cm）"
              valueCm={Math.round(config.launchHeight * 100)}
              minCm={10}
              maxCm={150}
              stepCm={10}
              onChangeCm={(cm) => updateField('launchHeight', cm / 100)}
            />

            {/* 発射台の角度 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sub">発射角度 (0〜60°)</span>
                <span className="font-mono font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
                  {config.launchAngle}°
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateField('launchAngle', Math.max(0, config.launchAngle - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold"
                >
                  -
                </button>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={config.launchAngle}
                  onChange={(e) => updateField('launchAngle', Number(e.target.value))}
                  className="flex-1 accent-[#5AB0F0]"
                />
                <button
                  onClick={() => updateField('launchAngle', Math.min(60, config.launchAngle + 1))}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* 缶の大きさ */}
            <div>
              <label className="block font-bold text-sub mb-1">缶の大きさ</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { size: 'small' as CanSize, name: '小 (+30点)', dim: 'φ6cm·高10cm' },
                    { size: 'medium' as CanSize, name: '中 (+20点)', dim: 'φ9cm·高12cm' },
                    { size: 'large' as CanSize, name: '大 (+10点)', dim: 'φ12cm·高16cm' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.size}
                    onClick={() => updateField('canSize', c.size)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                      config.canSize === c.size
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-[#E63946] text-[#E63946] font-bold'
                        : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                    }`}
                  >
                    <div className="text-xs">{c.name}</div>
                    <div className="text-[10px] text-sub font-mono">{c.dim}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 缶をつるす高さ */}
            <div>
              <label className="block font-bold text-sub mb-1">缶をつるす高さ（床から）と、発射台からの距離</label>
              <div className="grid grid-cols-5 gap-1.5 text-center font-bold">
                {[
                  { h: 140, pts: 50 },
                  { h: 120, pts: 40 },
                  { h: 100, pts: 30 },
                  { h: 80, pts: 20 },
                  { h: 60, pts: 10 },
                ].map((item) => (
                  <button
                    key={item.h}
                    onClick={() => updateField('canHeight', item.h / 100)}
                    className={`py-1.5 rounded-lg border transition-colors ${
                      Math.round(config.canHeight * 100) === item.h
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#1F9D74] text-[#1F9D74]'
                        : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                    }`}
                  >
                    <div>{item.h}cm</div>
                    <div className="text-[10px] font-mono text-[#1F9D74]">+{item.pts}</div>
                    <div className="text-[10px] font-normal text-sub">{getCanDistance(item.h / 100).toFixed(2)} m 先</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// スライダーとプラス・マイナスボタン
const HeightSliderWithButtons: React.FC<{
  label: string;
  valueCm: number;
  minCm: number;
  maxCm: number;
  stepCm: number;
  onChangeCm: (cm: number) => void;
}> = ({ label, valueCm, minCm, maxCm, stepCm, onChangeCm }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-sub">{label}</span>
        <span className="font-mono font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
          {valueCm} cm
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChangeCm(Math.max(minCm, valueCm - stepCm))}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors"
        >
          <Minus className="w-3.5 h-3.5 mx-auto" />
        </button>
        <input
          type="range"
          min={minCm}
          max={maxCm}
          step={stepCm}
          value={valueCm}
          onChange={(e) => onChangeCm(Number(e.target.value))}
          className="flex-1 accent-[#5AB0F0]"
        />
        <button
          onClick={() => onChangeCm(Math.min(maxCm, valueCm + stepCm))}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mx-auto" />
        </button>
      </div>
    </div>
  );
};
