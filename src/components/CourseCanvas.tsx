/**
 * 高性能コース Canvas 描画 & 物理アニメーションコンポーネント
 * タップ & マウスドラッグによる直感的な直接操作 (Direct Manipulation)
 * スタート高さ・ループ設計・ゆっくり区間・発射高さ・発射角度・缶の高さをドラッグで変更可能
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CourseConfig, PracticeFocus, SimulationResult, TrajectoryPoint } from '../types';
import { PHYSICS_CONSTANTS, getCanDistance } from '../physics';
import { Play, Pause, RotateCcw, CheckCircle2, AlertTriangle, Move, Volume2, VolumeX } from 'lucide-react';
import {
  drawCan,
  drawCanStand,
  drawFloorShadow,
  drawLabScene,
  drawMetalStand,
  drawMeterStick,
  drawPhotogate,
  drawPopup,
  drawSparks,
  drawSteelBall,
  speedColor,
  strokeMetalRail,
} from './courseArt';
import * as sound from '../sound';

// 演出用（得点の計算には使わない）：命中・外れのあとに動きを見せる時間 (s)
const AFTER_SEC = 1.3;
const AFTER_RATE = 120; // 1 秒あたりの記録数

interface MotionSample {
  x: number;
  y: number;
  a: number; // 回転角 (rad)
  v: number;
}

interface EffectEvent {
  t: number;
  x: number;
  y: number;
  text: string;
  color: string;
  kind: 'loop' | 'slow' | 'hit';
}

export type DragHandleType =
  | 'startHeight'
  | 'loop1Bottom'
  | 'loop2Bottom'
  | 'slowHeight'
  | 'launchHeight'
  | 'launchAngle'
  | 'canHeight';

interface HandleInfo {
  id: DragHandleType;
  x: number;
  y: number;
  radius: number;
  label: string;
  valueStr: string;
  color: string;
  cursor: string;
}

interface CourseCanvasProps {
  config: CourseConfig;
  simulationResult?: SimulationResult;
  isAnimating: boolean;
  onAnimationFinish?: () => void;
  onCurrentPointChange?: (point: TrajectoryPoint | null) => void;
  onUpdateConfig?: (newConfig: CourseConfig) => void;
  showSightLine?: boolean;
  // 練習ステージ：その部品だけのコースを描く（physics の practice と同じ形）
  focus?: PracticeFocus;
  // レポート用：再生の操作を出さず、印刷しやすいよう常に明るい背景で描く
  staticView?: boolean;
  className?: string;
}

export const CourseCanvas: React.FC<CourseCanvasProps> = ({
  config,
  simulationResult,
  isAnimating,
  onAnimationFinish,
  onCurrentPointChange,
  onUpdateConfig,
  showSightLine = false,
  focus,
  staticView = false,
  className = '',
}) => {
  // どの部品を描くか（練習では1つだけ）
  const showStartPart = focus !== 'launch';
  const showSlowPart = focus === undefined || focus === 'slow';
  const showLaunchPart = focus === undefined || focus === 'launch';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // コールバックを Ref に保持
  const onAnimationFinishRef = useRef(onAnimationFinish);
  onAnimationFinishRef.current = onAnimationFinish;

  const onCurrentPointChangeRef = useRef(onCurrentPointChange);
  onCurrentPointChangeRef.current = onCurrentPointChange;

  const onUpdateConfigRef = useRef(onUpdateConfig);
  onUpdateConfigRef.current = onUpdateConfig;

  // アニメーション実行用の時間管理 Ref
  const currentTimeSecRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const lastTimestampRef = useRef<number>(0);
  const playbackSpeedRef = useRef<number>(1.0);
  const lastPointNotifyTimeRef = useRef<number>(0);

  // ドラッグ操作の状態
  const activeDragHandleRef = useRef<DragHandleType | null>(null);
  const [activeDragHandle, setActiveDragHandle] = useState<DragHandleType | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<DragHandleType | null>(null);
  const handlesRef = useRef<HandleInfo[]>([]);

  // UI表示用のステート
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [soundOn, setSoundOn] = useState<boolean>(() => sound.isSoundEnabled());
  const [animStatus, setAnimStatus] = useState<'ready' | 'running' | 'finished'>('ready');
  const [currentSectionLabel, setCurrentSectionLabel] = useState<string>('スタート待機中');

  // スケール計算キャッシュ用 Ref
  const scaleInfoRef = useRef<{
    scale: number;
    padLeft: number;
    padBottom: number;
    height: number;
    launchTipScreen: { x: number; y: number };
  }>({
    scale: 100,
    padLeft: 36,
    padBottom: 38,
    height: 340,
    launchTipScreen: { x: 0, y: 0 },
  });

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  // 指定時刻におけるボールと缶の位置
  const getPositionAtTime = useCallback(
    (tSec: number) => {
      if (!simulationResult || simulationResult.trajectory.length === 0) {
        return {
          ball: {
            x: 0.1,
            y: config.startHeight,
            v: 0,
            K: 0,
            U: PHYSICS_CONSTANTS.G * config.startHeight,
            T: 0,
            section: 'スタート待機中',
            time: 0,
          } as TrajectoryPoint,
          canY: config.canHeight,
          isLaunched: false,
          isFinished: false,
        };
      }

      const traj = simulationResult.trajectory;
      const totalTime = simulationResult.totalTime;
      const tLaunch = simulationResult.tLaunch;
      const hasLaunched = tLaunch > 0 && simulationResult.speeds.launchTip > 0;
      const isLaunched = hasLaunched && tSec >= tLaunch;

      let pt = traj[0];
      if (tSec <= 0) {
        pt = traj[0];
      } else if (tSec >= totalTime) {
        pt = traj[traj.length - 1];
      } else {
        // 区間を特定して滑らかに線形補間
        let idx = 0;
        while (idx < traj.length - 1 && traj[idx + 1].time < tSec) {
          idx++;
        }
        const p1 = traj[idx];
        const p2 = traj[idx + 1] || p1;
        const dt = p2.time - p1.time;
        if (dt > 1e-6) {
          const ratio = Math.max(0, Math.min(1, (tSec - p1.time) / dt));
          pt = {
            ...p2,
            x: p1.x + (p2.x - p1.x) * ratio,
            y: p1.y + (p2.y - p1.y) * ratio,
            v: p1.v + (p2.v - p1.v) * ratio,
            K: p1.K + (p2.K - p1.K) * ratio,
            U: p1.U + (p2.U - p1.U) * ratio,
            T: p1.T + (p2.T - p1.T) * ratio,
            time: tSec,
            section: ratio < 0.5 ? p1.section : p2.section,
          };
        } else {
          pt = p2;
        }
      }

      let canY = config.canHeight;
      if (isLaunched) {
        const tAir = tSec - tLaunch;
        const canSpec = PHYSICS_CONSTANTS.CAN_SPECS[config.canSize];
        canY = Math.max(canSpec.height / 2, config.canHeight - 0.5 * PHYSICS_CONSTANTS.G * tAir * tAir);
      }

      const isFinished = tSec >= totalTime - 0.001;

      return {
        ball: pt,
        canY,
        isLaunched,
        isFinished,
      };
    },
    [simulationResult, config]
  );

  // --- 演出用：点が入る場面と、命中・外れのあとの動き（得点の計算には使わない） ---
  const effects = useMemo(() => {
    const result = {
      events: [] as EffectEvent[],
      ballAfter: [] as MotionSample[],
      canAfter: [] as MotionSample[],
      ballLandT: -1,
      canLandT: -1,
      tail: 0.6,
    };
    if (!simulationResult) return result;
    const traj = simulationResult.trajectory;
    const totalTime = simulationResult.totalTime;
    const G = PHYSICS_CONSTANTS.G;

    // ループを回れたとき（頂上を過ぎた瞬間）
    const loopKinds =
      config.loopType === 'small' ? ['small'] :
      config.loopType === 'large' ? ['large'] :
      config.loopType === 'small_large' ? ['small', 'large'] :
      config.loopType === 'large_small' ? ['large', 'small'] : [];
    loopKinds.forEach((kind, i) => {
      const n = i + 1;
      const passed = traj.some((p) => p.section === `ループ${n}通過`);
      let topIdx = -1;
      traj.forEach((p, idx) => {
        if (p.section === `ループ${n}上昇`) topIdx = idx;
      });
      if (passed && topIdx >= 0) {
        const pts = kind === 'large' ? PHYSICS_CONSTANTS.LOOP_SCORES.large : PHYSICS_CONSTANTS.LOOP_SCORES.small;
        const top = traj[topIdx];
        result.events.push({ t: top.time, x: top.x, y: top.y + 0.06, text: `+${pts}`, color: '#1F9D74', kind: 'loop' });
      }
    });

    // ゆっくり区間の計測
    const mid = traj.find((p) => p.section.startsWith('ゆっくり区間中央'));
    if (mid && simulationResult.slowSpeedKmh !== undefined) {
      const pts = simulationResult.slowSpeedPoints;
      result.events.push({
        t: mid.time,
        x: mid.x,
        y: mid.y + 0.1,
        text: pts > 0 ? `+${pts}` : `${simulationResult.slowSpeedKmh.toFixed(1)} km/h`,
        color: pts > 0 ? '#D97706' : '#64748B',
        kind: 'slow',
      });
    }

    // 空中に飛び出したあと
    const last = traj[traj.length - 1];
    const prev = traj[traj.length - 2];
    const pd = simulationResult.projectileData;
    if (!last || !prev || !pd || simulationResult.tLaunch <= 0 || !last.section.includes('空中')) {
      return result;
    }
    const hit = simulationResult.canHitSuccess;
    if (hit) {
      result.events.push({ t: totalTime, x: last.x, y: pd.canYAtHit + 0.12, text: `+${simulationResult.canPoints}`, color: '#E63946', kind: 'hit' });
    }

    const dtLast = Math.max(1e-4, last.time - prev.time);
    let bx = last.x;
    let by = last.y;
    let bvx = (last.x - prev.x) / dtLast;
    let bvy = (last.y - prev.y) / dtLast;
    if (hit) {
      // 缶にぶつかって、はね返る
      bvx = -0.25 * bvx;
      bvy = 0.6;
    }

    const canSpec = PHYSICS_CONSTANTS.CAN_SPECS[config.canSize];
    let cx = last.x;
    let cy = Math.max(canSpec.height / 2, pd.canYAtHit);
    const onFloorAlready = pd.canYAtHit <= canSpec.height / 2;
    let cvx = 0;
    let cvy = onFloorAlready ? 0 : -G * (totalTime - simulationResult.tLaunch);
    let ca = 0;
    let cw = 0;
    if (hit) {
      // ボールに押されて、回りながら飛ぶ
      cvx = 0.45 * Math.abs((last.x - prev.x) / dtLast);
      cvy += 0.4;
      cw = 7;
    }
    let canLanded = onFloorAlready;
    if (onFloorAlready) result.canLandT = totalTime;

    const dt = 1 / 240;
    const steps = Math.round(AFTER_SEC / dt);
    for (let i = 0; i <= steps; i++) {
      if (i % 2 === 0) {
        result.ballAfter.push({ x: bx, y: by, a: 0, v: Math.hypot(bvx, bvy) });
        result.canAfter.push({ x: cx, y: cy, a: ca, v: 0 });
      }
      // ボール
      bvy -= G * dt;
      bx += bvx * dt;
      by += bvy * dt;
      if (by <= 0) {
        by = 0;
        if (result.ballLandT < 0) result.ballLandT = totalTime + i * dt;
        bvy = Math.abs(bvy) > 0.4 ? -bvy * 0.35 : 0;
        bvx *= 0.75;
      }
      if (by === 0 && bvy === 0) bvx *= 0.995;

      // 缶
      const lying = Math.abs(Math.sin(ca)) > 0.7;
      const floorC = lying ? canSpec.diameter / 2 : canSpec.height / 2;
      if (!canLanded || cvy !== 0) {
        cvy -= G * dt;
        cy += cvy * dt;
      }
      cx += cvx * dt;
      ca += cw * dt;
      if (cy <= floorC) {
        cy = floorC;
        if (!canLanded) {
          canLanded = true;
          if (result.canLandT < 0) result.canLandT = totalTime + i * dt;
        }
        cvy = Math.abs(cvy) > 0.5 ? -cvy * 0.2 : 0;
        cvx *= 0.97;
        if (hit) {
          // 横倒しに落ち着く
          cw = 0;
          ca += (Math.PI / 2 - ca) * 0.12;
        }
      }
    }
    result.tail = AFTER_SEC;
    return result;
  }, [simulationResult, config.loopType, config.canSize]);

  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  // 再生を終える時刻（命中・外れのあとの動きを含む）
  const endTime = (simulationResult?.totalTime || 2.0) + effects.tail;

  // --- Canvas 描画本体関数 ---
  const renderCanvas = useCallback(
    (tSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 640;
      const height = rect.height || 340;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // コース幾何学の算出
      let curX = 0;
      let curY = showStartPart ? config.startHeight : config.launchHeight;

      interface TrackSegment {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        type: 'start' | 'slope' | 'flat' | 'slow' | 'launch';
      }
      const segments: TrackSegment[] = [];
      const posts: { x: number; y: number; label: string }[] = [];

      // スタート台 (0.30m)
      if (showStartPart) {
        posts.push({ x: curX, y: curY, label: `スタート ${Math.round(curY * 100)}cm` });
        segments.push({ x1: curX, y1: curY, x2: curX + PHYSICS_CONSTANTS.START_FLAT_LENGTH, y2: curY, type: 'start' });
        curX += PHYSICS_CONSTANTS.START_FLAT_LENGTH;
      }

      // ループ
      interface LoopDrawItem {
        kind: 'small' | 'large';
        radius: number;
        bottom: number;
        centerX: number;
        centerY: number;
      }
      const loopItems: LoopDrawItem[] = [];

      const loopConfigs: { kind: 'small' | 'large'; bottom: number }[] = [];
      if (focus === 'launch' || focus === 'slow') {
        // 練習ではループを描かない
      } else if (config.loopType === 'small') {
        loopConfigs.push({ kind: 'small', bottom: config.loop1Bottom });
      } else if (config.loopType === 'large') {
        loopConfigs.push({ kind: 'large', bottom: config.loop1Bottom });
      } else if (config.loopType === 'small_large') {
        loopConfigs.push({ kind: 'small', bottom: config.loop1Bottom });
        loopConfigs.push({ kind: 'large', bottom: config.loop2Bottom });
      } else if (config.loopType === 'large_small') {
        loopConfigs.push({ kind: 'large', bottom: config.loop1Bottom });
        loopConfigs.push({ kind: 'small', bottom: config.loop2Bottom });
      }

      loopConfigs.forEach((lc, idx) => {
        const r = lc.kind === 'small' ? PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS : PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS;
        const deltaH = curY - lc.bottom;
        const slopeLength = 2.0 * Math.abs(deltaH);
        const slopeDx = slopeLength * Math.cos((30 * Math.PI) / 180);
        segments.push({ x1: curX, y1: curY, x2: curX + slopeDx, y2: lc.bottom, type: 'slope' });
        curX += slopeDx;
        curY = lc.bottom;

        posts.push({ x: curX, y: curY, label: `${Math.round(curY * 100)}cm` });

        // つなぎレール (0.10m)
        segments.push({ x1: curX, y1: curY, x2: curX + 0.10, y2: curY, type: 'flat' });
        curX += 0.10;

        loopItems.push({ kind: lc.kind, radius: r, bottom: lc.bottom, centerX: curX, centerY: curY + r });

        segments.push({ x1: curX, y1: curY, x2: curX + 0.10, y2: curY, type: 'flat' });
        curX += 0.10;
      });

      // ループ練習：ループを出たあとの短いレール（physics の practice: 'loop' と同じ 0.3 m）
      if (focus === 'loop') {
        segments.push({ x1: curX, y1: curY, x2: curX + 0.3, y2: curY, type: 'flat' });
        curX += 0.3;
      }

      // ゆっくり区間への坂
      let slowStartX = curX;
      if (showSlowPart) {
        const deltaHSlow = curY - config.slowHeight;
        const slopeDxSlow = 2.0 * Math.abs(deltaHSlow) * Math.cos((30 * Math.PI) / 180);
        segments.push({ x1: curX, y1: curY, x2: curX + slopeDxSlow, y2: config.slowHeight, type: 'slope' });
        curX += slopeDxSlow;
        curY = config.slowHeight;

        posts.push({ x: curX, y: curY, label: `${Math.round(curY * 100)}cm` });

        // ゆっくり区間 (0.50m)
        slowStartX = curX;
        segments.push({ x1: curX, y1: curY, x2: curX + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH, y2: curY, type: 'slow' });
        curX += PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH;
      }
      const courseEndX = curX;

      // 発射台 (0.30m)：水平に入ったレールが、先端で角度θまで反り上がるジャンプ台として描く。
      // 先端の位置（水平位置・高さ）は physics と同じにし、根元側を円弧で下げて描く（見た目だけ）
      const rad = (config.launchAngle * Math.PI) / 180;
      const launchDx = PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH * Math.cos(rad);
      const launchTipY = config.launchHeight;
      const rampRadius = rad > 0.001 ? launchDx / Math.sin(rad) : 0;
      const rampDrop = rad > 0.001 ? rampRadius * (1 - Math.cos(rad)) : 0;
      const rampStartY = launchTipY - rampDrop;

      // 発射台への坂（水平の長さは physics と同じ。終わりの高さだけジャンプ台の根元に合わせる）
      const launchSlopeStartX = curX;
      const launchSlopeStartY = curY;
      if (showLaunchPart && showStartPart) {
        const deltaHLaunch = curY - config.launchHeight;
        const slopeDxLaunch = 2.0 * Math.abs(deltaHLaunch) * Math.cos((30 * Math.PI) / 180);
        segments.push({ x1: curX, y1: curY, x2: curX + slopeDxLaunch, y2: rampStartY, type: 'slope' });
        curX += slopeDxLaunch;
      }
      curY = config.launchHeight;

      const launchPostX = curX;
      const launchTipX = curX + launchDx;

      // ジャンプ台のレールの高さ（x はジャンプ台の範囲内）
      const rampYAt = (x: number) => {
        if (rad <= 0.001) return launchTipY;
        const dx = Math.max(0, Math.min(launchDx, x - launchPostX));
        return rampStartY + rampRadius - Math.sqrt(Math.max(0, rampRadius * rampRadius - dx * dx));
      };

      if (showLaunchPart) {
        const rampSteps = 12;
        for (let i = 0; i < rampSteps; i++) {
          const xa = launchPostX + (launchDx * i) / rampSteps;
          const xb = launchPostX + (launchDx * (i + 1)) / rampSteps;
          segments.push({ x1: xa, y1: rampYAt(xa), x2: xb, y2: rampYAt(xb), type: 'launch' });
        }
      }

      // 標的缶位置（先端からの水平距離は、つるす高さで決まる）。缶はその右のスタンドから腕を出し、電磁石で吊るす
      const canDistance = getCanDistance(config.canHeight);
      const canRealX = launchTipX + canDistance;
      const canStandX = canRealX + 0.16;
      const canArmY = 1.6;

      // 等方スケール
      const padLeft = 36;
      const padRight = 36;
      const padTop = 26;
      const padBottom = 38;

      const plotWidth = width - padLeft - padRight;
      const plotHeight = height - padTop - padBottom;
      // 練習では部品が少ないぶん、横の範囲を狭めて大きく描く
      const maxRealX = showLaunchPart
        ? Math.max(focus ? 1.8 : 4.2, canRealX + 0.35)
        : Math.max(1.8, courseEndX + 0.3);
      const maxRealY = 1.65;
      const scale = Math.min(plotWidth / maxRealX, plotHeight / maxRealY);

      // 横に余白があるとき（練習の短いコースなど）は、図を中央に寄せる
      const offsetX = Math.max(0, (plotWidth - maxRealX * scale) / 2);
      const toScreenX = (rx: number) => padLeft + offsetX + rx * scale;
      const toScreenY = (ry: number) => height - padBottom - ry * scale;
      const floorY = toScreenY(0);

      scaleInfoRef.current = {
        scale,
        padLeft,
        padBottom,
        height,
        launchTipScreen: { x: toScreenX(launchTipX), y: toScreenY(launchTipY) },
      };

      // --- 背景：実験室の壁と床、ものさし ---
      const isDark = !staticView && document.documentElement.classList.contains('dark');
      const palette = { dark: isDark };
      drawLabScene(ctx, width, height, floorY, palette);

      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(29,43,83,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      [0.5, 1.0, 1.5].forEach((h) => {
        const sy = toScreenY(h);
        ctx.beginPath();
        ctx.moveTo(padLeft - 4, sy);
        ctx.lineTo(width - 6, sy);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      drawMeterStick(ctx, padLeft - 18, toScreenY, 1.6, palette);

      const simTotal = simulationResult?.totalTime ?? 0;
      const tLaunchSim = simulationResult?.tLaunch ?? -1;
      const fx = effectsRef.current;
      const launchedNow = tLaunchSim > 0 && tSec >= tLaunchSim;

      // --- スタンド ---
      const drawTag = (text: string, sxIn: number, sy: number) => {
        let sx = sxIn;
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        const w = ctx.measureText(text).width + 8;
        sx = Math.max(padLeft - 4 + w / 2, Math.min(width - 4 - w / 2, sx));
        ctx.fillStyle = isDark ? 'rgba(14,22,38,0.85)' : 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = isDark ? '#263657' : '#D6DEF0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx - w / 2, sy - 9, w, 13, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isDark ? '#EAEFFC' : '#1D2B53';
        ctx.textAlign = 'center';
        ctx.fillText(text, sx, sy + 1);
      };

      posts.forEach((p) => {
        drawMetalStand(ctx, toScreenX(p.x), toScreenY(p.y), floorY);
      });

      if (showLaunchPart) {
        // 発射台（ジャンプ台）のスタンド：根元と先端の近くの2か所で支える
        const rootX = launchPostX + launchDx * 0.12;
        const tipStandX = launchPostX + launchDx * 0.8;
        drawMetalStand(ctx, toScreenX(rootX), toScreenY(rampYAt(rootX)), floorY);
        drawMetalStand(ctx, toScreenX(tipStandX), toScreenY(rampYAt(tipStandX)), floorY);

        // 缶のスタンド・腕・電磁石（ボールが飛び出すまで電磁石が缶をつかんでいる）
        drawCanStand(ctx, toScreenX(canStandX), toScreenY(canArmY), toScreenX(canRealX), floorY, !launchedNow);
        ctx.fillStyle = isDark ? '#96A6C5' : '#5A6A85';
        ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('電磁石', toScreenX(canRealX) - 10, toScreenY(canArmY) + 9);

        // 発射台の先端から缶までの水平距離（床の上に寸法線）
        const sTip = toScreenX(launchTipX);
        const sMagX = toScreenX(canRealX);
        const dimY = floorY + 15;
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(60,35,10,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sTip, dimY - 4);
        ctx.lineTo(sTip, dimY + 4);
        ctx.moveTo(sMagX, dimY - 4);
        ctx.lineTo(sMagX, dimY + 4);
        ctx.moveTo(sTip, dimY);
        ctx.lineTo(sMagX, dimY);
        ctx.stroke();
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(60,35,10,0.9)';
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${canDistance.toFixed(2)} m`, (sTip + sMagX) / 2, dimY - 3);
      }

      // --- ゆっくり区間の計測区間（黄色い帯） ---
      if (showSlowPart) {
        const sSlowStartX = toScreenX(slowStartX);
        const sSlowEndX = toScreenX(slowStartX + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH);
        const sSlowY = toScreenY(config.slowHeight);
        // 計測区間の床に、黄色い区間の印を置く
        ctx.fillStyle = isDark ? 'rgba(255,201,60,0.55)' : 'rgba(234,170,0,0.6)';
        ctx.fillRect(sSlowStartX, sSlowY + 6, sSlowEndX - sSlowStartX, 3);
        ctx.fillRect(sSlowStartX, sSlowY + 2, 1.5, 8);
        ctx.fillRect(sSlowEndX - 1.5, sSlowY + 2, 1.5, 8);
      }

      // --- レール（金属） ---
      strokeMetalRail(
        ctx,
        () => {
          segments.forEach((seg) => {
            ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
            ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
          });
          loopItems.forEach((loop) => {
            const scx = toScreenX(loop.centerX);
            const scy = toScreenY(loop.centerY);
            ctx.moveTo(scx + loop.radius * scale, scy);
            ctx.arc(scx, scy, loop.radius * scale, 0, Math.PI * 2);
          });
        },
        palette
      );

      loopItems.forEach((loop) => {
        const scx = toScreenX(loop.centerX);
        const scy = toScreenY(loop.centerY);
        drawTag(loop.kind === 'large' ? '大ループ 直径50cm' : '小ループ 直径30cm', scx, scy - loop.radius * scale - 10);
      });

      // 支柱の高さの札
      posts.forEach((p) => {
        if (p.label) drawTag(p.label, toScreenX(p.x), toScreenY(p.y) - 12);
      });

      // --- ゆっくり区間の光ゲート（速度計） ---
      if (showSlowPart) {
        const midX = slowStartX + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH / 2;
        const slowEvent = fx.events.find((e) => e.kind === 'slow');
        const lit = !!slowEvent && Math.abs(tSec - slowEvent.t) < 0.12;
        drawPhotogate(ctx, toScreenX(midX), toScreenY(config.slowHeight), lit);
        if (slowEvent && tSec >= slowEvent.t && simulationResult?.slowSpeedKmh !== undefined) {
          drawTag(`時速 ${simulationResult.slowSpeedKmh.toFixed(1)} km`, toScreenX(midX), toScreenY(config.slowHeight) - 38);
        } else {
          drawTag('ゆっくり区間（速度計）', toScreenX(midX), toScreenY(config.slowHeight) - 38);
        }
      }

      // --- 発射の向き（角度の矢印）と照準線 ---
      const sTipX = toScreenX(launchTipX);
      const sTipY = toScreenY(launchTipY);
      const arrowLen = 28;
      const arrowEndX = sTipX + arrowLen * Math.cos(rad);
      const arrowEndY = sTipY - arrowLen * Math.sin(rad);

      if (showLaunchPart && !launchedNow) {
        ctx.strokeStyle = 'rgba(230,57,70,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sTipX, sTipY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#E63946';
        ctx.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${config.launchAngle}°`, arrowEndX + 6, arrowEndY + 2);
      }

      if (showSightLine && showLaunchPart) {
        const sCanAimX = toScreenX(canRealX);
        const aimY = config.launchHeight + canDistance * Math.tan(rad);
        ctx.strokeStyle = 'rgba(230, 57, 70, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sTipX, sTipY);
        ctx.lineTo(sCanAimX, toScreenY(aimY));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(230, 57, 70, 0.85)';
        ctx.beginPath();
        ctx.arc(sCanAimX, toScreenY(aimY), 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- 現在の位置 ---
      const pos = getPositionAtTime(Math.min(tSec, simTotal || tSec));
      const ballRadius = 6.5;
      const railGap = ballRadius + 2.5; // レールの上に乗っている球の中心までの距離（画面）

      // ボールの画面上の位置（t は時刻）。レールの上では、レールの外側（ループでは内側）に乗せる
      const ballScreenAt = (t: number): { x: number; y: number; v: number } => {
        if (simulationResult && t > simTotal && fx.ballAfter.length > 0) {
          const i = Math.min(fx.ballAfter.length - 1, Math.max(0, Math.round((t - simTotal) * AFTER_RATE)));
          const b = fx.ballAfter[i];
          return { x: toScreenX(b.x), y: Math.min(toScreenY(b.y), floorY - ballRadius), v: b.v };
        }
        let bp = getPositionAtTime(Math.min(t, simTotal || t)).ball;
        const airborne = tLaunchSim > 0 && t >= tLaunchSim;
        if (showLaunchPart && !airborne) {
          const bx = bp.x;
          if (bx >= launchPostX - 1e-6 && bx <= launchTipX + 1e-6) {
            bp = { ...bp, y: rampYAt(bx) };
          } else if (showStartPart && bx > launchSlopeStartX && bx < launchPostX) {
            const ratio = (bx - launchSlopeStartX) / (launchPostX - launchSlopeStartX);
            bp = { ...bp, y: launchSlopeStartY + (rampStartY - launchSlopeStartY) * ratio };
          }
        }
        let sx = toScreenX(bp.x);
        let sy = toScreenY(bp.y);
        const loopMatch = /^ループ(\d)(上昇|下降|戻り)/.exec(bp.section);
        if (loopMatch && loopItems[Number(loopMatch[1]) - 1]) {
          const lp = loopItems[Number(loopMatch[1]) - 1];
          const cxs = toScreenX(lp.centerX);
          const cys = toScreenY(lp.centerY);
          const d = Math.hypot(cxs - sx, cys - sy) || 1;
          sx += ((cxs - sx) / d) * railGap;
          sy += ((cys - sy) / d) * railGap;
        } else if (!/^ループ\d落下/.test(bp.section)) {
          // 飛び出した直後は、レールの上から空中の道すじへなめらかにつなぐ
          const k = airborne ? Math.max(0, 1 - (t - tLaunchSim) / 0.08) : 1;
          sy -= railGap * k;
        }
        return { x: sx, y: Math.min(sy, floorY - ballRadius), v: bp.v };
      };

      // 缶の位置（ボールが届くまでは物理の計算どおり。そのあとは演出）
      const canSpec = PHYSICS_CONSTANTS.CAN_SPECS[config.canSize];
      const canPixelW = Math.max(12, canSpec.diameter * scale);
      const canPixelH = Math.max(16, canSpec.height * scale);
      let canState = { x: canRealX, y: pos.canY, a: 0 };
      if (simulationResult && tSec > simTotal && fx.canAfter.length > 0) {
        const i = Math.min(fx.canAfter.length - 1, Math.max(0, Math.round((tSec - simTotal) * AFTER_RATE)));
        canState = fx.canAfter[i];
      }
      const sCanX = toScreenX(canState.x);
      const sCanY = Math.min(toScreenY(canState.y), floorY - canPixelH / 2);

      // --- 缶 ---
      if (showLaunchPart) {
        drawFloorShadow(ctx, sCanX, floorY, floorY - sCanY, canPixelW / 2 + 2);
        if (!launchedNow) {
          // 電磁石から缶までの糸
          ctx.strokeStyle = isDark ? '#96A6C5' : '#64748B';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(toScreenX(canRealX), toScreenY(canArmY) + 11);
          ctx.lineTo(sCanX, sCanY - canPixelH / 2);
          ctx.stroke();
        } else if (tSec - tLaunchSim < 0.35 && tSec <= simTotal) {
          drawTag('▼ 落ちはじめた！', sCanX, sCanY - canPixelH / 2 - 10);
        }
        drawCan(ctx, sCanX, sCanY, canPixelW, canPixelH, canState.a, canSpec.name);
        if (!launchedNow) {
          ctx.fillStyle = isDark ? '#96A6C5' : '#5A6A85';
          ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${Math.round(config.canHeight * 100)}cm`, sCanX + canPixelW / 2 + 4, sCanY + 3);
        }
      }

      // --- 空中の道すじ ---
      if (simulationResult && simulationResult.trajectory.length > 0 && tSec > 0) {
        const airPoints = simulationResult.trajectory.filter((p) => p.section.includes('空中') && p.time <= tSec);
        if (airPoints.length > 1) {
          ctx.strokeStyle = simulationResult.canHitSuccess ? 'rgba(31, 157, 116, 0.55)' : 'rgba(209, 73, 91, 0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(toScreenX(airPoints[0].x), toScreenY(airPoints[0].y));
          for (let i = 1; i < airPoints.length; i++) {
            ctx.lineTo(toScreenX(airPoints[i].x), toScreenY(airPoints[i].y));
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // --- ボール：影・速さで色が変わる軌跡・鉄球 ---
      const ballNow = ballScreenAt(tSec);
      drawFloorShadow(ctx, ballNow.x, floorY, floorY - ballNow.y, ballRadius);
      if (tSec > 0) {
        for (let k = 12; k >= 1; k--) {
          const tk = tSec - k * 0.025;
          if (tk < 0) continue;
          const bk = ballScreenAt(tk);
          ctx.fillStyle = speedColor(bk.v, 0.4 * (1 - k / 13));
          ctx.beginPath();
          ctx.arc(bk.x, bk.y, ballRadius * (1 - k / 16), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawSteelBall(ctx, ballNow.x, ballNow.y, ballRadius);
      const sBallX = ballNow.x;
      const sBallY = ballNow.y;

      // --- 点数の吹き出し・命中の火花 ---
      fx.events.forEach((e) => {
        const progress = (tSec - e.t) / 1.1;
        if (e.kind === 'hit') {
          drawSparks(ctx, sCanX, sCanY, (tSec - e.t) / 0.5);
          drawPopup(ctx, sCanX, toScreenY(e.y), 'カーン！', (tSec - e.t) / 0.9, '#D97706');
          drawPopup(ctx, sCanX + 30, toScreenY(e.y) + 4, e.text, progress, e.color);
        } else if (e.kind === 'loop' || (e.kind === 'slow' && e.text.startsWith('+'))) {
          drawPopup(ctx, toScreenX(e.x), toScreenY(e.y), e.text, progress, e.color);
        }
      });

      // --- 10. ドラッグ操作ハンドル (Handles) の構築 & 描画 ---
      if (onUpdateConfig) {
        const handles: HandleInfo[] = [];

        // 1) スタート台ハンドル
        if (showStartPart) handles.push({
          id: 'startHeight',
          x: toScreenX(0),
          y: toScreenY(config.startHeight),
          radius: 11,
          label: 'スタート台',
          valueStr: `${Math.round(config.startHeight * 100)}cm`,
          color: '#5AB0F0',
          cursor: 'ns-resize',
        });

        // 2) ループ1ハンドル
        if (config.loopType !== 'none' && loopItems[0]) {
          handles.push({
            id: 'loop1Bottom',
            x: toScreenX(loopItems[0].centerX),
            y: toScreenY(config.loop1Bottom),
            radius: 11,
            label: 'ループ1最下点',
            valueStr: `${Math.round(config.loop1Bottom * 100)}cm`,
            color: '#5AB0F0',
            cursor: 'ns-resize',
          });
        }

        // 3) ループ2ハンドル
        if ((config.loopType === 'small_large' || config.loopType === 'large_small') && loopItems[1]) {
          handles.push({
            id: 'loop2Bottom',
            x: toScreenX(loopItems[1].centerX),
            y: toScreenY(config.loop2Bottom),
            radius: 11,
            label: 'ループ2最下点',
            valueStr: `${Math.round(config.loop2Bottom * 100)}cm`,
            color: '#5AB0F0',
            cursor: 'ns-resize',
          });
        }

        // 4) ゆっくり区間ハンドル
        if (showSlowPart) handles.push({
          id: 'slowHeight',
          x: toScreenX(slowStartX),
          y: toScreenY(config.slowHeight),
          radius: 11,
          label: 'ゆっくり区間',
          valueStr: `${Math.round(config.slowHeight * 100)}cm`,
          color: '#FFC93C',
          cursor: 'ns-resize',
        });

        // 5) 発射台高さハンドル
        if (showLaunchPart) handles.push({
          id: 'launchHeight',
          x: toScreenX(launchPostX),
          y: toScreenY(config.launchHeight),
          radius: 11,
          label: '発射台高さ',
          valueStr: `${Math.round(config.launchHeight * 100)}cm`,
          color: '#E63946',
          cursor: 'ns-resize',
        });

        // 6) 発射台角度ハンドル
        if (showLaunchPart) handles.push({
          id: 'launchAngle',
          x: arrowEndX,
          y: arrowEndY,
          radius: 11,
          label: '発射角度',
          valueStr: `${config.launchAngle}°`,
          color: '#E63946',
          cursor: 'crosshair',
        });

        // 7) 標的缶ハンドル
        if (showLaunchPart) handles.push({
          id: 'canHeight',
          x: toScreenX(canStandX),
          y: toScreenY(config.canHeight),
          radius: 12,
          label: '缶の位置',
          valueStr: `${Math.round(config.canHeight * 100)}cm`,
          color: '#1F9D74',
          cursor: 'ns-resize',
        });

        handlesRef.current = handles;

        // 各ハンドルのリング & アイコン描画
        handles.forEach((h) => {
          const isHovered = hoveredHandle === h.id;
          const isDragging = activeDragHandleRef.current === h.id;

          // 外側ハロー / 発光
          if (isHovered || isDragging) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.radius + 6, 0, Math.PI * 2);
            ctx.fillStyle = `${h.color}33`;
            ctx.fill();
          }

          // 外枠リング
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          // 下の装置が透けて見えるよう、つまみは半透明にする
          ctx.fillStyle = isHovered || isDragging ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)';
          ctx.fill();
          ctx.lineWidth = isDragging ? 3 : 2;
          ctx.strokeStyle = h.color;
          ctx.stroke();

          // ハンドル中心グリップマーク
          if (h.id === 'launchAngle') {
            ctx.fillStyle = h.color;
            ctx.beginPath();
            ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // 上下矢印マーク
            ctx.fillStyle = h.color;
            ctx.beginPath();
            // 上矢印
            ctx.moveTo(h.x, h.y - 6);
            ctx.lineTo(h.x - 3.5, h.y - 2);
            ctx.lineTo(h.x + 3.5, h.y - 2);
            ctx.closePath();
            ctx.fill();
            // 下矢印
            ctx.beginPath();
            ctx.moveTo(h.x, h.y + 6);
            ctx.lineTo(h.x - 3.5, h.y + 2);
            ctx.lineTo(h.x + 3.5, h.y + 2);
            ctx.closePath();
            ctx.fill();
          }

          // ドラッグ中またはホバー中のツールチップ
          if (isDragging || isHovered) {
            const tipText = `${h.label}: ${h.valueStr}`;
            ctx.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
            const textWidth = ctx.measureText(tipText).width;
            const tipX = Math.max(10, Math.min(width - textWidth - 20, h.x - textWidth / 2 - 8));
            const tipY = Math.max(20, h.y - h.radius - 12);

            ctx.fillStyle = '#1D2B53';
            ctx.beginPath();
            ctx.roundRect(tipX, tipY - 14, textWidth + 16, 20, 6);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(tipText, tipX + 8, tipY);
          }
        });
      }

      // 終了判定エフェクト
      if (pos.isFinished && simulationResult) {
        if (!showLaunchPart && simulationResult.success) {
          ctx.fillStyle = '#1F9D74';
          ctx.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(focus === 'loop' ? '✅ ループを1周できた!' : '✅ ゆっくり区間を通過!', sBallX, Math.max(18, sBallY - 14));
        } else if (simulationResult.canHitSuccess) {
          ctx.fillStyle = '#1F9D74';
          ctx.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎯 命中!', sCanX, Math.max(18, sCanY - canPixelH / 2 - 16));
        } else if (simulationResult.failReason) {
          ctx.fillStyle = '#D1495B';
          ctx.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          const label =
            simulationResult.failReason === 'loop_fall'
              ? '⚠️ ループで落下!'
              : simulationResult.failReason === 'slow_stop'
              ? '⚠️ 途中で停止!'
              : simulationResult.failReason === 'slope_rollback'
              ? '⚠️ 坂を戻った!'
              : simulationResult.failReason === 'can_hit_floor'
              ? '⚠️ 缶が先に床へ落下!'
              : simulationResult.failReason === 'miss_over'
              ? '⚠️ 缶の上を通過!'
              : simulationResult.failReason === 'miss_under'
              ? '⚠️ 缶の下を通過!'
              : '⚠️ 左右に外れた!';
          ctx.fillText(label, sBallX, Math.max(18, sBallY - 14));
        }
      }

      ctx.restore();
    },
    [config, showSightLine, focus, staticView, showStartPart, showSlowPart, showLaunchPart, simulationResult, getPositionAtTime, hoveredHandle, onUpdateConfig]
  );

  // --- 効果音：時刻 a から b のあいだに起きたことの音を鳴らす ---
  const playSoundsBetween = useCallback(
    (a: number, b: number) => {
      if (!simulationResult || !sound.isSoundEnabled()) return;
      const crossed = (t: number) => t > a && t <= b;
      const fx = effectsRef.current;
      const tLaunch = simulationResult.tLaunch;
      const totalTime = simulationResult.totalTime;

      // 転がる音（レールの上にいるあいだ）
      const onRail = tLaunch > 0 ? b < tLaunch : b < totalTime;
      if (onRail) {
        sound.updateRolling(getPositionAtTime(b).ball.v);
      } else if (a < (tLaunch > 0 ? tLaunch : totalTime)) {
        sound.stopRolling();
      }

      simulationResult.trajectory.forEach((p, i) => {
        const prev = simulationResult.trajectory[i - 1];
        if (prev && /^ループ\d入口/.test(p.section) && !/^ループ\d入口/.test(prev.section) && crossed(p.time)) {
          sound.playClick();
        }
      });
      fx.events.forEach((e) => {
        if (!crossed(e.t)) return;
        if (e.kind === 'hit') sound.playHit();
        else if (e.kind === 'loop' || (e.kind === 'slow' && e.text.startsWith('+'))) sound.playScore();
      });
      if (tLaunch > 0 && crossed(tLaunch)) sound.playLaunch();
      if (fx.ballLandT > 0 && crossed(fx.ballLandT)) sound.playThud(0.25);
      if (fx.canLandT > 0 && crossed(fx.canLandT)) sound.playThud(0.4);
    },
    [simulationResult, getPositionAtTime]
  );

  // --- アニメーション再生ループ ---
  const startAnimationLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setAnimStatus('running');
    lastTimestampRef.current = performance.now();

    if (currentTimeSecRef.current <= 0) sound.startRolling();

    const loop = (now: number) => {
      if (!isPlayingRef.current) return;

      const deltaSec = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      const totalTime = simulationResult?.totalTime || 2.0;
      const prevT = currentTimeSecRef.current;
      currentTimeSecRef.current += deltaSec * playbackSpeedRef.current;
      playSoundsBetween(prevT, currentTimeSecRef.current);

      if (currentTimeSecRef.current >= endTime) {
        currentTimeSecRef.current = endTime;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setAnimStatus('finished');
        sound.stopRolling();

        renderCanvas(endTime);

        const finalPos = getPositionAtTime(totalTime);
        setCurrentSectionLabel(finalPos.ball.section);
        onCurrentPointChangeRef.current?.(finalPos.ball);
        onAnimationFinishRef.current?.();
        return;
      }

      renderCanvas(currentTimeSecRef.current);

      if (now - lastPointNotifyTimeRef.current > 40) {
        lastPointNotifyTimeRef.current = now;
        const curPos = getPositionAtTime(currentTimeSecRef.current);
        setCurrentSectionLabel(curPos.ball.section);
        onCurrentPointChangeRef.current?.(curPos.ball);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [simulationResult, renderCanvas, getPositionAtTime, endTime, playSoundsBetween]);

  const stopAnimation = useCallback(() => {
    sound.stopRolling();
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // 外部からの isAnimating 開始トリガー
  useEffect(() => {
    if (isAnimating) {
      currentTimeSecRef.current = 0;
      startAnimationLoop();
    }
  }, [isAnimating, startAnimationLoop]);

  // config または simulationResult 変更時
  useEffect(() => {
    if (!isPlayingRef.current) {
      currentTimeSecRef.current = 0;
      setAnimStatus('ready');
      renderCanvas(0);
      const initPos = getPositionAtTime(0);
      setCurrentSectionLabel('スタート待機中');
      onCurrentPointChangeRef.current?.(initPos.ball);
    }
  }, [config, simulationResult, renderCanvas, getPositionAtTime]);

  // ライト／ダークを切り替えたら描き直す（背景を Canvas で描いているため）
  useEffect(() => {
    const observer = new MutationObserver(() => renderCanvas(currentTimeSecRef.current));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [renderCanvas]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopAnimation();
    };
  }, [stopAnimation]);

  // --- タップ & マウスドラッグ イベントハンドラ ---
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onUpdateConfig || isPlayingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // ハンドルとの当たり判定 (タッチしやすいよう半径22pxで余裕を持たせる)
    for (const h of handlesRef.current) {
      const dist = Math.hypot(px - h.x, py - h.y);
      if (dist <= Math.max(22, h.radius + 8)) {
        activeDragHandleRef.current = h.id;
        setActiveDragHandle(h.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        renderCanvas(currentTimeSecRef.current);
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onUpdateConfig || isPlayingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const activeId = activeDragHandleRef.current;

    if (!activeId) {
      // ホバー判定
      let hovered: DragHandleType | null = null;
      for (const h of handlesRef.current) {
        if (Math.hypot(px - h.x, py - h.y) <= Math.max(20, h.radius + 6)) {
          hovered = h.id;
          break;
        }
      }
      if (hovered !== hoveredHandle) {
        setHoveredHandle(hovered);
        renderCanvas(currentTimeSecRef.current);
      }
      return;
    }

    // ドラッグ中の値計算
    const { scale, padBottom, height, launchTipScreen } = scaleInfoRef.current;
    const realY = Math.max(0, (height - padBottom - py) / scale);

    if (activeId === 'startHeight') {
      const cm = Math.round(realY * 100 / 10) * 10;
      const clamped = Math.max(10, Math.min(150, cm)) / 100;
      if (clamped !== config.startHeight) {
        onUpdateConfigRef.current?.({ ...config, startHeight: clamped });
      }
    } else if (activeId === 'loop1Bottom') {
      const maxCm = Math.max(10, Math.round(config.startHeight * 100) - 10);
      const cm = Math.round(realY * 100 / 10) * 10;
      const clamped = Math.max(10, Math.min(maxCm, cm)) / 100;
      if (clamped !== config.loop1Bottom) {
        onUpdateConfigRef.current?.({ ...config, loop1Bottom: clamped });
      }
    } else if (activeId === 'loop2Bottom') {
      const maxCm = Math.max(10, Math.round(config.startHeight * 100) - 10);
      const cm = Math.round(realY * 100 / 10) * 10;
      const clamped = Math.max(10, Math.min(maxCm, cm)) / 100;
      if (clamped !== config.loop2Bottom) {
        onUpdateConfigRef.current?.({ ...config, loop2Bottom: clamped });
      }
    } else if (activeId === 'slowHeight') {
      const cm = Math.round(realY * 100 / 5) * 5; // 5cm刻み
      const clamped = Math.max(10, Math.min(150, cm)) / 100;
      if (clamped !== config.slowHeight) {
        onUpdateConfigRef.current?.({ ...config, slowHeight: clamped });
      }
    } else if (activeId === 'launchHeight') {
      const cm = Math.round(realY * 100 / 10) * 10;
      const clamped = Math.max(10, Math.min(150, cm)) / 100;
      if (clamped !== config.launchHeight) {
        onUpdateConfigRef.current?.({ ...config, launchHeight: clamped });
      }
    } else if (activeId === 'launchAngle') {
      const dx = px - launchTipScreen.x;
      const dy = launchTipScreen.y - py; // 上向きが正
      let deg = Math.round((Math.atan2(dy, Math.max(0.1, dx)) * 180) / Math.PI);
      deg = Math.max(0, Math.min(60, deg));
      if (deg !== config.launchAngle) {
        onUpdateConfigRef.current?.({ ...config, launchAngle: deg });
      }
    } else if (activeId === 'canHeight') {
      // 許容高さ: 60, 80, 100, 120, 140 cm の中から最も近い高さにマグネット吸着
      const allowed = [0.60, 0.80, 1.00, 1.20, 1.40];
      let closest = allowed[0];
      let minDiff = Math.abs(allowed[0] - realY);
      for (const h of allowed) {
        const diff = Math.abs(h - realY);
        if (diff < minDiff) {
          minDiff = diff;
          closest = h;
        }
      }
      if (closest !== config.canHeight) {
        onUpdateConfigRef.current?.({ ...config, canHeight: closest });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeDragHandleRef.current) {
      activeDragHandleRef.current = null;
      setActiveDragHandle(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      renderCanvas(currentTimeSecRef.current);
    }
  };

  // 手動コントロールハンドラ
  const handleTogglePlay = () => {
    if (isPlayingRef.current) {
      stopAnimation();
    } else {
      if (animStatus === 'finished') {
        currentTimeSecRef.current = 0;
      }
      startAnimationLoop();
    }
  };

  const handleResetToStart = () => {
    stopAnimation();
    currentTimeSecRef.current = 0;
    setAnimStatus('ready');
    renderCanvas(0);
    const initPos = getPositionAtTime(0);
    setCurrentSectionLabel('スタート待機中');
    onCurrentPointChangeRef.current?.(initPos.ball);
  };

  return (
    <div className={`relative w-full overflow-hidden bg-white dark:bg-[#17223B] rounded-xl border border-[#D6DEF0] dark:border-[#263657] shadow-sm ${className}`}>
      {/* 直接操作の案内バッジ */}
      {onUpdateConfig && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/90 dark:bg-[#17223B]/90 backdrop-blur-xs border border-[#D6DEF0]/80 dark:border-[#263657]/80 text-[10px] text-sub font-bold shadow-xs pointer-events-none">
          <Move className="w-3 h-3 text-[#5AB0F0]" />
          <span>支柱・発射角・缶をタッチ＆ドラッグで直接動かせます</span>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-64 sm:h-76 md:h-84 block ${
          activeDragHandle ? 'cursor-grabbing' : hoveredHandle ? 'cursor-grab' : 'cursor-default'
        }`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Canvas 下部のアニメーション操作バー（図に重ねず、図の下に置く） */}
      <div className={`${staticView ? 'hidden' : 'flex'} flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-[#D6DEF0]/80 dark:border-[#263657]/80 text-xs`}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleTogglePlay}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#5AB0F0] hover:bg-[#4a9de0] text-white font-bold transition-colors shadow-xs cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>一時停止</span>
              </>
            ) : animStatus === 'finished' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>もう一度再生</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>再生</span>
              </>
            )}
          </button>

          <button
            onClick={handleResetToStart}
            className="p-1 text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC] rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="スタート位置に戻す"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* 再生速度切替（1倍 → 0.5倍 → 0.25倍のスロー） */}
          <button
            onClick={() => setPlaybackSpeed((prev) => (prev === 1.0 ? 0.5 : prev === 0.5 ? 0.25 : 1.0))}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold text-sub hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            title="再生速度"
          >
            {playbackSpeed}x
          </button>

          {/* 効果音（初期はオフ） */}
          <button
            onClick={() => {
              const next = !soundOn;
              sound.setSoundEnabled(next);
              setSoundOn(next);
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-sub hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            title={soundOn ? '効果音をオフにする' : '効果音をオンにする'}
            aria-label={soundOn ? '効果音をオフにする' : '効果音をオンにする'}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#5AB0F0]" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 状態ラベル */}
        <div className="text-[11px] font-medium text-sub flex items-center gap-1.5">
          {isPlaying ? (
            <span className="text-[#5AB0F0] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#5AB0F0] animate-ping" />
              試走中... ({currentSectionLabel})
            </span>
          ) : animStatus === 'finished' ? (
            !showLaunchPart && simulationResult?.success ? (
              <span className="text-[#1F9D74] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                試走完了：{focus === 'loop' ? 'ループを1周できた！' : 'ゆっくり区間を通過！'}
              </span>
            ) : simulationResult?.canHitSuccess ? (
              <span className="text-[#1F9D74] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 試走完了：缶に命中！
              </span>
            ) : (
              <span className="text-[#E63946] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 試走完了：{simulationResult?.failDescription || '外れ'}
              </span>
            )
          ) : (
            <span>待機中：『走らせる』を押して試走</span>
          )}
        </div>
      </div>
    </div>
  );
};
