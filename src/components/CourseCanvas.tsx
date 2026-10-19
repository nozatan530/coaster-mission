/**
 * 高性能コース Canvas 描画 & 物理アニメーションコンポーネント
 * タップ & マウスドラッグによる直感的な直接操作 (Direct Manipulation)
 * スタート高さ・ループ設計・ゆっくり区間・発射高さ・発射角度・缶の高さをドラッグで変更可能
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CourseConfig, PracticeFocus, SimulationResult, TrajectoryPoint } from '../types';
import { PHYSICS_CONSTANTS } from '../physics';
import { Play, Pause, RotateCcw, CheckCircle2, AlertTriangle, Move } from 'lucide-react';

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
  const playbackSpeedRef = useRef<1.0 | 0.5>(1.0);
  const lastPointNotifyTimeRef = useRef<number>(0);

  // ドラッグ操作の状態
  const activeDragHandleRef = useRef<DragHandleType | null>(null);
  const [activeDragHandle, setActiveDragHandle] = useState<DragHandleType | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<DragHandleType | null>(null);
  const handlesRef = useRef<HandleInfo[]>([]);

  // UI表示用のステート
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1.0 | 0.5>(1.0);
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
        posts.push({ x: curX, y: curY, label: `開始:${Math.round(curY * 100)}` });
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

        posts.push({ x: curX, y: curY, label: `L${idx + 1}:${Math.round(curY * 100)}` });

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

        posts.push({ x: curX, y: curY, label: `ゆ:${Math.round(curY * 100)}` });

        // ゆっくり区間 (0.50m)
        slowStartX = curX;
        segments.push({ x1: curX, y1: curY, x2: curX + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH, y2: curY, type: 'slow' });
        curX += PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH;
      }
      const courseEndX = curX;

      // 発射台への坂
      if (showLaunchPart && showStartPart) {
        const deltaHLaunch = curY - config.launchHeight;
        const slopeDxLaunch = 2.0 * Math.abs(deltaHLaunch) * Math.cos((30 * Math.PI) / 180);
        segments.push({ x1: curX, y1: curY, x2: curX + slopeDxLaunch, y2: config.launchHeight, type: 'slope' });
        curX += slopeDxLaunch;
        curY = config.launchHeight;
      }

      const launchPostX = curX;
      if (showLaunchPart) {
        posts.push({ x: curX, y: curY, label: `発:${Math.round(curY * 100)}` });
      }

      // 発射台 (0.30m 角度θ)
      const rad = (config.launchAngle * Math.PI) / 180;
      const launchDx = PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH * Math.cos(rad);
      const launchTipX = curX + launchDx;
      const launchTipY = config.launchHeight;
      if (showLaunchPart) {
        segments.push({ x1: curX, y1: curY, x2: launchTipX, y2: launchTipY, type: 'launch' });
      }

      // 標的缶位置 (先端から水平1.0m)
      const canRealX = launchTipX + PHYSICS_CONSTANTS.CAN_HORIZONTAL_DISTANCE;
      if (showLaunchPart) {
        posts.push({ x: canRealX, y: 1.55, label: `標的:1m` });
      }

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

      const toScreenX = (rx: number) => padLeft + rx * scale;
      const toScreenY = (ry: number) => height - padBottom - ry * scale;
      const floorY = toScreenY(0);

      scaleInfoRef.current = {
        scale,
        padLeft,
        padBottom,
        height,
        launchTipScreen: { x: toScreenX(launchTipX), y: toScreenY(launchTipY) },
      };

      // 目盛り線
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#E2E8F0';
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'right';

      [0, 0.50, 1.00, 1.50].forEach((h) => {
        const sy = toScreenY(h);
        ctx.beginPath();
        ctx.setLineDash([3, 4]);
        ctx.moveTo(padLeft - 6, sy);
        ctx.lineTo(toScreenX(maxRealX), sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(`${Math.round(h * 100)}cm`, padLeft - 8, sy + 3);
      });

      // 床ライン
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(padLeft - 10, floorY);
      ctx.lineTo(toScreenX(maxRealX) + 10, floorY);
      ctx.stroke();

      // 支柱
      posts.forEach((p) => {
        const sx = toScreenX(p.x);
        const syTop = toScreenY(p.y);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, floorY);
        ctx.lineTo(sx, syTop);
        ctx.stroke();

        ctx.fillStyle = '#64748B';
        ctx.fillRect(sx - 5, floorY - 3, 10, 3);

        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(sx, syTop, 3.5, 0, Math.PI * 2);
        ctx.fill();

        if (p.label) {
          ctx.fillStyle = '#1E293B';
          ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.label, sx, syTop - 7);
        }
      });

      // レール
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#5AB0F0';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      segments.forEach((seg) => {
        ctx.beginPath();
        ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
        ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
        ctx.stroke();
      });

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1D2B53';
      segments.forEach((seg) => {
        ctx.beginPath();
        ctx.moveTo(toScreenX(seg.x1), toScreenY(seg.y1));
        ctx.lineTo(toScreenX(seg.x2), toScreenY(seg.y2));
        ctx.stroke();
      });

      // ループ円
      loopItems.forEach((loop) => {
        const scx = toScreenX(loop.centerX);
        const scy = toScreenY(loop.centerY);
        const sRadius = loop.radius * scale;

        ctx.beginPath();
        ctx.arc(scx, scy, sRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#5AB0F0';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(scx, scy, sRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#1D2B53';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#64748B';
        ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          loop.kind === 'large' ? '大ループ(φ50cm)' : '小ループ(φ30cm)',
          scx,
          scy - sRadius - 5
        );
      });

      if (showSlowPart) {
        // ゆっくり区間
        const sSlowStartX = toScreenX(slowStartX);
        const sSlowEndX = toScreenX(slowStartX + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH);
        const sSlowY = toScreenY(config.slowHeight);

        ctx.strokeStyle = '#FFC93C';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sSlowStartX, sSlowY - 14, sSlowEndX - sSlowStartX, 22);
        ctx.setLineDash([]);

        ctx.fillStyle = '#D97706';
        ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ゆっくり計測区間 (0.50m)', (sSlowStartX + sSlowEndX) / 2, sSlowY - 18);
      }

      // 発射方向矢印
      const sTipX = toScreenX(launchTipX);
      const sTipY = toScreenY(launchTipY);
      const arrowLen = 28;
      const arrowEndX = sTipX + arrowLen * Math.cos(rad);
      const arrowEndY = sTipY - arrowLen * Math.sin(rad);

      if (showLaunchPart) {
        ctx.strokeStyle = '#E63946';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sTipX, sTipY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.stroke();

        ctx.fillStyle = '#E63946';
        ctx.beginPath();
        ctx.arc(arrowEndX, arrowEndY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${config.launchAngle}°`, arrowEndX + 4, arrowEndY + 2);
      }

      // 照準線
      if (showSightLine && showLaunchPart) {
        const sCanAimX = toScreenX(canRealX);
        const aimY = config.launchHeight + PHYSICS_CONSTANTS.CAN_HORIZONTAL_DISTANCE * Math.tan(rad);
        ctx.strokeStyle = 'rgba(230, 57, 70, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sTipX, sTipY);
        ctx.lineTo(sCanAimX, toScreenY(aimY));
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(230, 57, 70, 0.8)';
        ctx.beginPath();
        ctx.arc(sCanAimX, toScreenY(aimY), 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 現在位置
      const pos = getPositionAtTime(tSec);

      // 標的缶
      const sCanX = toScreenX(canRealX);
      const sCanY = toScreenY(pos.canY);
      const canSpec = PHYSICS_CONSTANTS.CAN_SPECS[config.canSize];
      const canPixelW = Math.max(12, canSpec.diameter * scale);
      const canPixelH = Math.max(16, canSpec.height * scale);

      if (showLaunchPart) {
        if (!pos.isLaunched) {
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sCanX, toScreenY(1.55));
          ctx.lineTo(sCanX, sCanY - canPixelH / 2);
          ctx.stroke();
        } else {
          // 発射台を飛び出した瞬間に電磁石/糸が解除され自由落下
          const tAir = simulationResult && simulationResult.tLaunch > 0 ? Math.max(0, tSec - simulationResult.tLaunch) : 0;
          if (tAir > 0 && tAir < 0.35 && !pos.isFinished) {
            ctx.fillStyle = '#E63946';
            ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('▼ 落下開始!', sCanX, sCanY - canPixelH / 2 - 6);
          }
        }

        ctx.fillStyle = '#E63946';
        ctx.strokeStyle = '#1D2B53';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sCanX - canPixelW / 2, sCanY - canPixelH / 2, canPixelW, canPixelH, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(canSpec.name, sCanX, sCanY + 3);

        ctx.fillStyle = '#64748B';
        ctx.font = '9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`缶高: ${Math.round(config.canHeight * 100)}cm`, sCanX + canPixelW / 2 + 4, sCanY);
      }

      // 弾道軌跡プレビュー
      if (simulationResult && simulationResult.trajectory.length > 0 && tSec > 0) {
        const airPoints = simulationResult.trajectory.filter((p) => p.section.includes('空中'));
        if (airPoints.length > 0) {
          ctx.strokeStyle = simulationResult.canHitSuccess
            ? 'rgba(31, 157, 116, 0.4)'
            : 'rgba(209, 73, 91, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(toScreenX(airPoints[0].x), toScreenY(airPoints[0].y));
          for (let i = 1; i < airPoints.length; i++) {
            ctx.lineTo(toScreenX(airPoints[i].x), toScreenY(airPoints[i].y));
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ボール
      const ballPt = pos.ball;
      const sBallX = toScreenX(ballPt.x);
      const sBallY = toScreenY(ballPt.y);
      const ballRadius = 6.5;

      const ballGrad = ctx.createRadialGradient(
        sBallX - 2,
        sBallY - 2,
        1,
        sBallX,
        sBallY,
        ballRadius
      );
      ballGrad.addColorStop(0, '#FFFFFF');
      ballGrad.addColorStop(0.3, '#94A3B8');
      ballGrad.addColorStop(0.8, '#475569');
      ballGrad.addColorStop(1, '#0F172A');

      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(sBallX, sBallY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      // --- 10. ドラッグ操作ハンドル (Handles) の構築 & 描画 ---
      if (onUpdateConfig) {
        const handles: HandleInfo[] = [];

        // 1) スタート台ハンドル
        if (showStartPart) handles.push({
          id: 'startHeight',
          x: toScreenX(0),
          y: toScreenY(config.startHeight),
          radius: 14,
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
            radius: 14,
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
            radius: 14,
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
          radius: 14,
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
          radius: 14,
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
          radius: 14,
          label: '発射角度',
          valueStr: `${config.launchAngle}°`,
          color: '#E63946',
          cursor: 'crosshair',
        });

        // 7) 標的缶ハンドル
        if (showLaunchPart) handles.push({
          id: 'canHeight',
          x: sCanX,
          y: toScreenY(config.canHeight),
          radius: 16,
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
          ctx.fillStyle = '#FFFFFF';
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
          ctx.fillText('🎯 命中!!', sCanX, sCanY - canPixelH / 2 - 14);

          ctx.strokeStyle = '#FFC93C';
          ctx.lineWidth = 2;
          for (let a = 0; a < 8; a++) {
            const ang = (a * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(sCanX + 10 * Math.cos(ang), sCanY + 10 * Math.sin(ang));
            ctx.lineTo(sCanX + 18 * Math.cos(ang), sCanY + 18 * Math.sin(ang));
            ctx.stroke();
          }
        } else if (simulationResult.failReason) {
          ctx.fillStyle = '#D1495B';
          ctx.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          const label =
            simulationResult.failReason === 'loop_fall'
              ? '⚠️ ループ頂上で落下!'
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
    [config, showSightLine, focus, showStartPart, showSlowPart, showLaunchPart, simulationResult, getPositionAtTime, hoveredHandle, onUpdateConfig]
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

    const loop = (now: number) => {
      if (!isPlayingRef.current) return;

      const deltaSec = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      const totalTime = simulationResult?.totalTime || 2.0;
      currentTimeSecRef.current += deltaSec * playbackSpeedRef.current;

      if (currentTimeSecRef.current >= totalTime) {
        currentTimeSecRef.current = totalTime;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setAnimStatus('finished');

        renderCanvas(totalTime);

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
  }, [simulationResult, renderCanvas, getPositionAtTime]);

  const stopAnimation = useCallback(() => {
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

      {/* Canvas 下部のアニメーション操作バー */}
      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-white/90 dark:bg-[#17223B]/90 backdrop-blur-xs rounded-lg border border-[#D6DEF0]/80 dark:border-[#263657]/80 text-xs shadow-xs">
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

          {/* 再生速度切替 */}
          <button
            onClick={() => setPlaybackSpeed((prev) => (prev === 1.0 ? 0.5 : 1.0))}
            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold text-sub hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            title="再生速度"
          >
            {playbackSpeed}x
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
