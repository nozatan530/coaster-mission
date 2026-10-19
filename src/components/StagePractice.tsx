/**
 * 練習ステージ (Practice 1, 2, 3)
 * レール制限なしで物理現象と法則を深く体験・解明する共通レイアウト
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Practice1State,
  Practice2State,
  Practice3State,
  CourseConfig,
  TrajectoryPoint,
} from '../types';
import { CourseCanvas } from './CourseCanvas';
import { EnergyBarChart } from './EnergyBarChart';
import { simulateRun, getCanDistance, PHYSICS_CONSTANTS } from '../physics';
import { DEFAULT_PRACTICE3 } from '../storage';
import {
  HelpCircle,
  Eye,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StagePracticeProps {
  p1State: Practice1State;
  p2State: Practice2State;
  p3State: Practice3State;
  onUpdateP1: (updates: Partial<Practice1State>) => void;
  onUpdateP2: (updates: Partial<Practice2State>) => void;
  onUpdateP3: (updates: Partial<Practice3State>) => void;
  onProceedToDesign: () => void;
}

export const StagePractice: React.FC<StagePracticeProps> = ({
  p1State,
  p2State,
  p3State,
  onUpdateP1,
  onUpdateP2,
  onUpdateP3,
  onProceedToDesign,
}) => {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentPt, setCurrentPt] = useState<TrajectoryPoint | null>(null);

  // 結果（判定・速さ・得点）は、その設定で走らせ終えてから見せる。設定を変えたらまた隠す
  const [finishedKey, setFinishedKey] = useState<string | null>(null);
  const runKeyRef = useRef('');

  const handleAnimationFinish = useCallback(() => {
    setIsAnimating(false);
    setFinishedKey(runKeyRef.current);
  }, []);

  // --- Practice 1 コース設定 ---
  const p1Config: CourseConfig = useMemo(
    () => ({
      startHeight: p1State.startHeight,
      loopType: p1State.loopSize,
      loop1Bottom: Math.min(p1State.startHeight - 0.1, p1State.loopBottom),
      loop2Bottom: 0.5,
      slowHeight: 0.5,
      launchHeight: 0.5,
      launchAngle: 0,
      canSize: 'medium',
      canHeight: 1.0,
      motionType: 'rolling',
    }),
    [p1State]
  );

  // --- Practice 2 コース設定 ---
  const p2Config: CourseConfig = useMemo(
    () => ({
      startHeight: p2State.startHeight,
      loopType: 'none',
      loop1Bottom: 0.5,
      loop2Bottom: 0.5,
      slowHeight: p2State.slowHeight,
      launchHeight: 0.5,
      launchAngle: 0,
      canSize: 'medium',
      canHeight: 1.0,
      motionType: 'rolling',
    }),
    [p2State]
  );

  // --- Practice 3 コース設定 ---
  const p3Config: CourseConfig = useMemo(
    () => ({
      startHeight: 1.5,
      loopType: 'none',
      loop1Bottom: 0.5,
      loop2Bottom: 0.5,
      slowHeight: 1.45,
      launchHeight: p3State.launchHeight,
      launchAngle: p3State.launchAngle,
      canSize: 'small',
      canHeight: p3State.canHeight,
      motionType: 'rolling',
    }),
    [p3State]
  );

  // 照準線は、練習③の問いに答えてから表示できる
  const p3Answered = p3State.answer.trim().length > 0;

  // 発射練習の「飛び出す速さ」（古い保存データには無いので既定値で補う）
  const launchSpeed = p3State.launchSpeed ?? DEFAULT_PRACTICE3.launchSpeed;

  // 現在のタブのアクティブ設定とシミュレーション。練習ではその部品だけを走らせる
  const currentConfig = activeTab === 1 ? p1Config : activeTab === 2 ? p2Config : p3Config;
  const focus = activeTab === 1 ? 'loop' : activeTab === 2 ? 'slow' : 'launch';
  const simResult = useMemo(
    () => simulateRun(currentConfig, { isIdeal: true, practice: focus, launchSpeed }),
    [currentConfig, focus, launchSpeed]
  );

  const runKey = JSON.stringify([activeTab, currentConfig, launchSpeed]);
  runKeyRef.current = runKey;
  const showResult = finishedKey === runKey;

  // 棒グラフの目盛りの基準（はじめに持っている力学的エネルギーを、高さに換算した値）
  const energyBaseHeight =
    activeTab === 3
      ? (simResult.trajectory[0]?.K ?? 0) / PHYSICS_CONSTANTS.G + p3State.launchHeight
      : currentConfig.startHeight;

  const handleRun = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsAnimating(true);
    }, 20);
  };

  const handleUpdatePracticeConfig = useCallback(
    (newConfig: CourseConfig) => {
      if (activeTab === 1) {
        onUpdateP1({
          startHeight: newConfig.startHeight,
          loopBottom: newConfig.loop1Bottom,
        });
      } else if (activeTab === 2) {
        onUpdateP2({
          startHeight: newConfig.startHeight,
          slowHeight: newConfig.slowHeight,
        });
      } else if (activeTab === 3) {
        onUpdateP3({
          launchHeight: newConfig.launchHeight,
          launchAngle: newConfig.launchAngle,
          canHeight: newConfig.canHeight,
        });
      }
    },
    [activeTab, onUpdateP1, onUpdateP2, onUpdateP3]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* 練習ステージ選択タブ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D6DEF0] dark:border-[#263657] pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#17223B] rounded-xl border border-[#D6DEF0] dark:border-[#263657] shadow-xs">
          <button
            onClick={() => {
              setActiveTab(1);
              setIsAnimating(false);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 1
                ? 'bg-[#1D2B53] text-white dark:bg-[#5AB0F0] dark:text-[#0E1626] shadow-xs'
                : 'text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC]'
            }`}
          >
            ① ループ練習
          </button>
          <button
            onClick={() => {
              setActiveTab(2);
              setIsAnimating(false);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 2
                ? 'bg-[#1D2B53] text-white dark:bg-[#5AB0F0] dark:text-[#0E1626] shadow-xs'
                : 'text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC]'
            }`}
          >
            ② ゆっくり区間練習
          </button>
          <button
            onClick={() => {
              setActiveTab(3);
              setIsAnimating(false);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 3
                ? 'bg-[#1D2B53] text-white dark:bg-[#5AB0F0] dark:text-[#0E1626] shadow-xs'
                : 'text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC]'
            }`}
          >
            ③ 発射・缶当て練習
          </button>
        </div>

        <button
          onClick={onProceedToDesign}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F9D74] hover:bg-[#1b8864] text-white text-xs font-bold shadow-sm transition-all"
        >
          <span>本番設計へ進む</span>
          <span>→</span>
        </button>
      </div>

      {/* 上段：コース可視化 & エネルギーグラフ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* コース可視化 (Canvas) */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sub">
              {activeTab === 1 && 'スタート台 → 坂 → ループ だけのコース'}
              {activeTab === 2 && 'スタート台 → 坂 → ゆっくり区間 だけのコース'}
              {activeTab === 3 && '発射台 → 缶 だけのコース'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                disabled={isAnimating}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#5AB0F0] hover:bg-[#4a9de0] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>走らせる</span>
              </button>
            </div>
          </div>

          <CourseCanvas
            config={currentConfig}
            simulationResult={simResult}
            isAnimating={isAnimating}
            onAnimationFinish={handleAnimationFinish}
            onCurrentPointChange={setCurrentPt}
            onUpdateConfig={handleUpdatePracticeConfig}
            showSightLine={activeTab === 3 && p3State.showSightLine && p3Answered}
            focus={focus}
          />
        </div>

        {/* リアルタイム エネルギーグラフ */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-sub">エネルギー推移</span>
          <EnergyBarChart currentPoint={currentPt} startHeight={energyBaseHeight} />
        </div>
      </div>

      {/* 下段：パラメータ調整コントロール & 問い・ヒント */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 左側：パラメータ調整コントロール */}
        <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span>
              {activeTab === 1 && 'ループだけを試す'}
              {activeTab === 2 && 'ゆっくり区間だけを試す'}
              {activeTab === 3 && '缶当てだけを試す'}
            </span>
            <span className="text-xs text-[#5AB0F0] font-normal">レールの長さ制限なし</span>
          </h4>

          {/* TAB 1: ループ練習用コントロール */}
          {activeTab === 1 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-sub mb-1.5">ループの大きさ</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdateP1({ loopSize: 'small' })}
                    className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${
                      p1State.loopSize === 'small'
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-[#5AB0F0] text-[#5AB0F0]'
                        : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                    }`}
                  >
                    小ループ (直径 30cm)
                  </button>
                  <button
                    onClick={() => onUpdateP1({ loopSize: 'large' })}
                    className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${
                      p1State.loopSize === 'large'
                        ? 'bg-sky-50 dark:bg-sky-950/50 border-[#5AB0F0] text-[#5AB0F0]'
                        : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                    }`}
                  >
                    大ループ (直径 50cm)
                  </button>
                </div>
              </div>

              {/* スタート高さ */}
              <HeightControl
                label="スタート台の高さ"
                valueCm={Math.round(p1State.startHeight * 100)}
                minCm={20}
                maxCm={150}
                stepCm={10}
                onChangeCm={(cm) => onUpdateP1({ startHeight: cm / 100 })}
              />

              {/* ループ最下点高さ */}
              <HeightControl
                label="ループ最下点の高さ"
                valueCm={Math.round(p1State.loopBottom * 100)}
                minCm={10}
                maxCm={Math.round(p1State.startHeight * 100) - 10}
                stepCm={10}
                onChangeCm={(cm) => onUpdateP1({ loopBottom: cm / 100 })}
              />

              {/* 結果サマリー */}
              {showResult ? (
  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sub">頂上での速度:</span>
                    <span className="font-bold font-mono">
                      {simResult.failReason === 'loop_fall'
                        ? '頂上まで届かない'
                        : simResult.speeds.loop1Top !== undefined
                        ? `${simResult.speeds.loop1Top.toFixed(2)} m/s`
                        : '到達できず'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sub">通過に必要な最小速度 (v² ≥ gr):</span>
                    <span className="font-bold font-mono">
                      {simResult.speeds.loop1TopCrit !== undefined
                        ? `${simResult.speeds.loop1TopCrit.toFixed(2)} m/s`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-bold">判定:</span>
                    {simResult.smallLoopPassed || simResult.largeLoopPassed ? (
                      <span className="text-[#1F9D74] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> クリア！
                      </span>
                    ) : (
                      <span className="text-[#E63946] font-bold flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> ループで落下
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <NotRunYet />
              )}
            </div>
          )}

          {/* TAB 2: ゆっくり区間用コントロール */}
          {activeTab === 2 && (
            <div className="space-y-4 text-xs">
              <HeightControl
                label="スタート台の高さ"
                valueCm={Math.round(p2State.startHeight * 100)}
                minCm={20}
                maxCm={150}
                stepCm={10}
                onChangeCm={(cm) => onUpdateP2({ startHeight: cm / 100 })}
              />

              <HeightControl
                label="ゆっくり区間の高さ（5cm刻み）"
                valueCm={Math.round(p2State.slowHeight * 100)}
                minCm={10}
                maxCm={Math.round(p2State.startHeight * 100)}
                stepCm={5}
                onChangeCm={(cm) => onUpdateP2({ slowHeight: cm / 100 })}
              />

              {/* 結果サマリー */}
              {showResult ? (
  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sub">中央での速度:</span>
                    <span className="font-bold font-mono">
                      {simResult.slowSpeedKmh !== undefined
                        ? `${simResult.slowSpeedKmh.toFixed(2)} km/h`
                        : '停止'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sub">獲得得点 (5.0km/h以下):</span>
                    <span className="font-bold text-[#FFC93C] font-mono">
                      +{simResult.slowSpeedPoints} 点
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-bold">判定:</span>
                    {simResult.failReason === 'slow_stop' || simResult.failReason === 'slope_rollback' ? (
                      <span className="text-[#E63946] font-bold flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> 途中で停止
                      </span>
                    ) : (
                      <span className="text-[#1F9D74] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> 通過成功！
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <NotRunYet />
              )}
            </div>
          )}

          {/* TAB 3: 発射・缶当て用コントロール */}
          {activeTab === 3 && (
            <div className="space-y-4 text-xs">
              {/* 飛び出す速さ */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sub">発射台を飛び出す速さ</span>
                  <span className="font-mono font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
                    {launchSpeed.toFixed(1)} m/s（時速 {(launchSpeed * 3.6).toFixed(1)} km）
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateP3({ launchSpeed: Math.max(1.0, Math.round((launchSpeed - 0.1) * 10) / 10) })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={1.0}
                    max={4.0}
                    step={0.1}
                    value={launchSpeed}
                    onChange={(e) => onUpdateP3({ launchSpeed: Number(e.target.value) })}
                    className="flex-1 accent-[#5AB0F0]"
                  />
                  <button
                    onClick={() => onUpdateP3({ launchSpeed: Math.min(4.0, Math.round((launchSpeed + 0.1) * 10) / 10) })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-sub mt-1">
                  本番では、この速さはスタートや坂の高さで決まる。練習では直接決めて試そう。
                </p>
              </div>

              <HeightControl
                label="発射台の高さ"
                valueCm={Math.round(p3State.launchHeight * 100)}
                minCm={10}
                maxCm={150}
                stepCm={10}
                onChangeCm={(cm) => onUpdateP3({ launchHeight: cm / 100 })}
              />

              {/* 発射角 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sub">発射角度 (0〜60°)</span>
                  <span className="font-mono font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
                    {p3State.launchAngle}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateP3({ launchAngle: Math.max(0, p3State.launchAngle - 1) })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={1}
                    value={p3State.launchAngle}
                    onChange={(e) => onUpdateP3({ launchAngle: Number(e.target.value) })}
                    className="flex-1 accent-[#5AB0F0]"
                  />
                  <button
                    onClick={() => onUpdateP3({ launchAngle: Math.min(60, p3State.launchAngle + 1) })}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 缶のつるす高さ */}
              <div>
                <label className="block font-bold text-sub mb-1.5">缶をつるす高さ（高いほど遠くに置く）</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[60, 80, 100, 120, 140].map((h) => (
                    <button
                      key={h}
                      onClick={() => onUpdateP3({ canHeight: h / 100 })}
                      className={`py-1.5 rounded-lg font-bold border text-center transition-colors ${
                        Math.round(p3State.canHeight * 100) === h
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-[#1F9D74] text-[#1F9D74]'
                          : 'border-[#D6DEF0] dark:border-[#263657] text-sub'
                      }`}
                    >
                      <div>{h}cm</div>
                      <div className="text-[10px] font-normal text-sub">{getCanDistance(h / 100).toFixed(2)} m 先</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 照準線切り替え */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#1D2B53] dark:text-[#EAEFFC] block">
                    照準線（発射台から缶への直線）
                  </span>
                  <span className="text-[11px] text-sub">
                    {p3Answered
                      ? '問いに答えたので表示できます'
                      : '下の問いに答えると表示できるようになります'}
                  </span>
                </div>
                <button
                  onClick={() => onUpdateP3({ showSightLine: !p3State.showSightLine })}
                  disabled={!p3Answered}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    p3State.showSightLine && p3Answered
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-[#E63946] text-[#E63946]'
                      : 'bg-slate-50 dark:bg-slate-800 border-[#D6DEF0] dark:border-[#263657] text-sub'
                  }`}
                >
                  {p3State.showSightLine && p3Answered ? '照準線を隠す' : '照準線を表示'}
                </button>
              </div>

              {/* 命中判定 */}
              {showResult ? (
  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">判定:</span>
                    {simResult.canHitSuccess ? (
                      <span className="text-[#1F9D74] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> 缶に命中！ (+{simResult.canPoints}点)
                      </span>
                    ) : (
                      <span className="text-[#E63946] font-bold flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> 外れ ({simResult.failDescription})
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <NotRunYet />
              )}
            </div>
          )}
        </div>

        {/* 右側：問い・答え入力・3段階ヒント */}
        <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5AB0F0]" />
              <h4 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
                練習の問い（考察と記録）
              </h4>
            </div>

            {/* 各練習の問い文 */}
            <div className="p-3 rounded-xl bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0] dark:border-[#263657] text-xs sm:text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] leading-relaxed mb-3">
              {activeTab === 1 && (
                <>
                  Q. ループの直径の何倍くらいの高さの差が必要だった？ なぜ直径と同じ高さでは足りないのだろう？
                </>
              )}
              {activeTab === 2 && (
                <>
                  Q. 遅くするほど点は上がるのに、なぜぎりぎりにすると本番では危ないのだろう？
                </>
              )}
              {activeTab === 3 && (
                <>
                  Q. 缶に当たったとき、ボールは何に向けて飛ばした？ 速さを変えても当たるのはなぜだろう？
                </>
              )}
            </div>

            {/* 答え入力欄 */}
            <label className="block text-xs font-bold text-sub mb-1">
              自分の考察・答えを入力（レポートに自動反映されます）
            </label>
            <textarea
              rows={3}
              placeholder="実験して気づいたことや、エネルギーの観点から考えた理由を書こう..."
              value={
                activeTab === 1
                  ? p1State.answer
                  : activeTab === 2
                  ? p2State.answer
                  : p3State.answer
              }
              onChange={(e) => {
                if (activeTab === 1) onUpdateP1({ answer: e.target.value });
                else if (activeTab === 2) onUpdateP2({ answer: e.target.value });
                else onUpdateP3({ answer: e.target.value });
              }}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#17223B] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
            />
            <p className="text-[10px] text-sub mt-1">※名前や連絡先などの個人情報は書かないでね</p>

            {/* 3段階ヒント */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-sub mb-1">
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#FFC93C]" />
                  <span>3段階ヒント（自分で選んで開こう）</span>
                </span>
                <span className="text-[10px] text-sub font-normal">
                  開いた段階はレポートに記録されます
                </span>
              </div>

              {renderHintBox(1, activeTab, p1State, p2State, p3State, onUpdateP1, onUpdateP2, onUpdateP3)}
              {renderHintBox(2, activeTab, p1State, p2State, p3State, onUpdateP1, onUpdateP2, onUpdateP3)}
              {renderHintBox(3, activeTab, p1State, p2State, p3State, onUpdateP1, onUpdateP2, onUpdateP3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// まだ走らせていないときに、結果の欄の代わりに出す案内
const NotRunYet: React.FC = () => (
  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 text-sub flex items-center gap-2">
    <Play className="w-3.5 h-3.5 text-[#5AB0F0]" />
    <span>どうなるか予想してから「走らせる」を押そう。結果はここに出ます。</span>
  </div>
);

// スライダー & +/- ボタン対応の高さ操作コンポーネント
const HeightControl: React.FC<{
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
          -
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
          +
        </button>
      </div>
    </div>
  );
};

// ヒントレンダリング
function renderHintBox(
  step: 1 | 2 | 3,
  activeTab: 1 | 2 | 3,
  p1: Practice1State,
  p2: Practice2State,
  p3: Practice3State,
  onUpdateP1: (u: Partial<Practice1State>) => void,
  onUpdateP2: (u: Partial<Practice2State>) => void,
  onUpdateP3: (u: Partial<Practice3State>) => void
) {
  const hintsData = {
    1: {
      1: {
        title: 'ヒント1：見る場所',
        text: 'ループの「頂上」にボールがある瞬間の、運動 K と 位置 U の棒グラフを見てみよう。速さは0（運動Kがゼロ）になっているかな？',
      },
      2: {
        title: 'ヒント2：比べ方',
        text: 'もしスタートの高さをループの直径（頂上と同じ高さ）にすると、頂上に着いたとき位置エネルギーだけで使い果たしてしまい、速さが 0 になってしまいます。レールから離れずに回るには、頂上でもある速さが必要です。',
      },
      3: {
        title: 'ヒント3：式とのつながり',
        text: '頂上でレールから離れずに回るには v² ≥ gr（g は重力加速度、r は半径）が必要です。転がる球は回転にもエネルギーを使うので、損失がなくても高さの差は直径の 1.35 倍（半径の 2.7 倍）いります。摩擦やループに入るときの衝突の損失を入れると約 1.5 倍（小ループ 45 cm、大ループ 75 cm）。10 cm ずつ試すと、小ループは 50 cm、大ループは 80 cm の差で通過できるはずです。',
      },
    },
    2: {
      1: {
        title: 'ヒント1：見る場所',
        text: 'ゆっくり区間の高さをスタートの高さに近づけていき、ボールが止まってしまう高さと、通過できる高さの境目を観察してみよう。',
      },
      2: {
        title: 'ヒント2：比べ方',
        text: 'レール上を進むと摩擦によってエネルギーが熱 T に変わります。理想の計算ではギリギリ通過できても、現実にはレールの継ぎ目や埃などで摩擦が少し増えただけでどうなるかな？',
      },
      3: {
        title: 'ヒント3：式とのつながり',
        text: '本番では摩擦係数 μ が約12%ばらつきます。速度をギリギリ（時速0.5km/hなど）に攻めすぎると、摩擦が少し増えた瞬間に E ≤ 0 となり途中で止まって0点になってしまいます！',
      },
    },
    3: {
      1: {
        title: 'ヒント1：見る場所',
        text: '缶に当たったときの発射台の向き（角度 θ）は、発射台の先端からつるされた缶へ引いた直線と比べてどうなっているかな？（問いに答えると、照準線を表示して確かめられる）',
      },
      2: {
        title: 'ヒント2：比べ方',
        text: 'ボールが発射台を離れた瞬間、缶も同時に自由落下を始めます。ボールも重力によって、まっすぐ進むはずの直線軌道から下に落ちていきます。',
      },
      3: {
        title: 'ヒント3：式とのつながり',
        text: '時間 t の間に落ちる距離は、ボールも缶も同じ ½gt² です！ だから最初から「缶の中心」に向けて真っ直ぐ狙って撃てば、速さに関わらず必ず落下中に命中します（モンキーハンティングの原理）。',
      },
    },
  };

  const currentHints = hintsData[activeTab][step];
  const currentState = activeTab === 1 ? p1 : activeTab === 2 ? p2 : p3;
  const isOpened = currentState.hintsOpened[step - 1];

  const toggleHint = () => {
    const nextHints: [boolean, boolean, boolean] = [...currentState.hintsOpened];
    nextHints[step - 1] = !isOpened;
    if (activeTab === 1) onUpdateP1({ hintsOpened: nextHints });
    else if (activeTab === 2) onUpdateP2({ hintsOpened: nextHints });
    else onUpdateP3({ hintsOpened: nextHints });
  };

  return (
    <div className="border border-[#D6DEF0] dark:border-[#263657] rounded-lg overflow-hidden text-xs">
      <button
        onClick={toggleHint}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center justify-between transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Eye className={`w-3.5 h-3.5 ${isOpened ? 'text-[#5AB0F0]' : 'text-sub'}`} />
          <span>{currentHints.title}</span>
        </span>
        {isOpened ? <ChevronUp className="w-3.5 h-3.5 text-sub" /> : <ChevronDown className="w-3.5 h-3.5 text-sub" />}
      </button>

      {isOpened && (
        <div className="px-3 py-2.5 bg-white dark:bg-[#17223B] text-sub leading-relaxed border-t border-[#D6DEF0] dark:border-[#263657]">
          {currentHints.text}
        </div>
      )}
    </div>
  );
}
