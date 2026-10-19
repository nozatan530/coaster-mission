/**
 * コースのイメージ図（横から見た図・静止画）
 * スタート画面のルール説明と「こんな設計だと何点？」の例で使う。
 * 設計の数値から形を描くので、例の数値を変えれば図もそのまま変わる。
 */

import React, { useMemo } from 'react';
import { CourseConfig } from '../types';
import { PHYSICS_CONSTANTS, simulateRun } from '../physics';

interface CourseIllustrationProps {
  config: CourseConfig;
  showLabels?: boolean;
  // false にすると、飛ぶ道すじと缶の落ちる位置を描かない（走らせる前に結果がわからないように）
  showFlight?: boolean;
  className?: string;
}

// 図の倍率（1 m あたりの単位）。たて方向は見やすさのため強調する
const SCALE = 100;
const VERTICAL_EXAGGERATION = 1.5;
const SQRT3 = Math.sqrt(3); // 30°の坂：高さ Δh に対して水平に √3·Δh 進む

interface Segment {
  kind: 'flat' | 'slope';
  x1: number;
  h1: number;
  x2: number;
  h2: number;
}

export const CourseIllustration: React.FC<CourseIllustrationProps> = ({
  config,
  showLabels = true,
  showFlight = true,
  className = '',
}) => {
  const layout = useMemo(() => {
    const segments: Segment[] = [];
    const loops: { cx: number; bottom: number; r: number; kind: 'small' | 'large' }[] = [];
    const labels: { x: number; h: number; text: string; anchor?: 'start' | 'middle' }[] = [];
    const slopeMids: { x: number; h: number }[] = [];

    let x = 0;
    let h = config.startHeight;

    const flat = (length: number) => {
      segments.push({ kind: 'flat', x1: x, h1: h, x2: x + length, h2: h });
      x += length;
    };
    const slopeTo = (target: number) => {
      const dx = Math.abs(h - target) * SQRT3;
      if (dx < 0.001) return;
      segments.push({ kind: 'slope', x1: x, h1: h, x2: x + dx, h2: target });
      slopeMids.push({ x: x + dx / 2, h: (h + target) / 2 });
      x += dx;
      h = target;
    };

    // スタート台
    labels.push({ x, h, text: 'スタート台', anchor: 'start' });
    const ballX = x + 0.06;
    flat(PHYSICS_CONSTANTS.START_FLAT_LENGTH);

    // ループ
    const loopKinds: ('small' | 'large')[] =
      config.loopType === 'small'
        ? ['small']
        : config.loopType === 'large'
          ? ['large']
          : config.loopType === 'small_large'
            ? ['small', 'large']
            : config.loopType === 'large_small'
              ? ['large', 'small']
              : [];
    loopKinds.forEach((kind, i) => {
      const bottom = i === 0 ? config.loop1Bottom : config.loop2Bottom;
      const r =
        kind === 'large' ? PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS : PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS;
      slopeTo(bottom);
      // 図では輪が坂に重ならないよう、つなぎ部分を輪の幅より少し広く描く
      const drawLength = 2 * r + 0.1;
      loops.push({ cx: x + drawLength / 2, bottom, r, kind });
      labels.push({ x: x + drawLength / 2, h: bottom + 2 * r, text: kind === 'large' ? '大ループ' : '小ループ' });
      flat(drawLength);
    });

    // ゆっくり区間
    slopeTo(config.slowHeight);
    labels.push({ x: x + PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH / 2, h, text: 'ゆっくり区間' });
    flat(PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH);

    // 発射台
    slopeTo(config.launchHeight);
    labels.push({ x: x + PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH / 2, h, text: '発射台' });
    flat(PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH);
    const launchX = x;
    const launchH = h;

    // 缶（発射台の先端から水平に 1.0 m 先）
    const canX = launchX + PHYSICS_CONSTANTS.CAN_HORIZONTAL_DISTANCE;
    const can = PHYSICS_CONSTANTS.CAN_SPECS[config.canSize];

    // 飛んでいく道すじ（理想の1回の発射の速さから描く）
    const result = simulateRun(config, { isIdeal: true });
    const arc: { x: number; h: number }[] = [];
    if (showFlight && result.speeds.launchTip > 0 && result.tLaunch >= 0) {
      const v = result.speeds.launchTip;
      const th = (config.launchAngle * Math.PI) / 180;
      const g = PHYSICS_CONSTANTS.G;
      for (let i = 0; i <= 24; i++) {
        const dx = (PHYSICS_CONSTANTS.CAN_HORIZONTAL_DISTANCE * i) / 24;
        const t = dx / (v * Math.cos(th));
        const y = launchH + v * Math.sin(th) * t - 0.5 * g * t * t;
        if (y < 0) break;
        arc.push({ x: launchX + dx, h: y });
      }
    }

    // 当たったときは、缶が落ちて出会う位置（缶の中心の高さ）も描く
    const canHitH =
      showFlight && result.projectileData?.isHit && result.projectileData.canYAtHit > 0
        ? result.projectileData.canYAtHit
        : null;

    const maxH = Math.max(config.startHeight, config.canHeight + can.height / 2, ...loops.map((l) => l.bottom + 2 * l.r));
    return {
      canHitH,
      segments,
      loops,
      labels,
      slopeMids,
      ballX,
      launchX,
      canX,
      can,
      arc,
      width: canX + 0.25,
      maxH: maxH + (showLabels ? 0.3 : 0.12),
    };
  }, [config, showLabels, showFlight]);

  const pad = 20;
  const W = layout.width * SCALE + pad * 2;
  const H = layout.maxH * SCALE * VERTICAL_EXAGGERATION + pad + (showLabels ? 30 : 8);
  const groundY = H - (showLabels ? 30 : 8);
  const px = (x: number) => pad + x * SCALE;
  const py = (h: number) => groundY - h * SCALE * VERTICAL_EXAGGERATION;
  const fontSize = 18;

  const firstSlope = layout.segments.find((s) => s.kind === 'slope');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-auto ${className}`}
      role="img"
      aria-label="横から見たコースのイメージ図"
    >
      {/* 床 */}
      <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="var(--color-line)" strokeWidth={2} />

      {/* 支柱（平らな部品の下） */}
      {layout.segments
        .filter((s) => s.kind === 'flat')
        .map((s, i) => (
          <line
            key={`pole-${i}`}
            x1={px((s.x1 + s.x2) / 2)}
            y1={py(s.h1)}
            x2={px((s.x1 + s.x2) / 2)}
            y2={groundY}
            stroke="var(--color-line)"
            strokeWidth={3}
          />
        ))}

      {/* 坂（色を変えて目立たせる） */}
      {layout.segments
        .filter((s) => s.kind === 'slope')
        .map((s, i) => (
          <line
            key={`slope-${i}`}
            x1={px(s.x1)}
            y1={py(s.h1)}
            x2={px(s.x2)}
            y2={py(s.h2)}
            stroke="var(--color-sky)"
            strokeWidth={6}
            strokeLinecap="round"
          />
        ))}

      {/* 平らな部品 */}
      {layout.segments
        .filter((s) => s.kind === 'flat')
        .map((s, i) => (
          <line
            key={`flat-${i}`}
            x1={px(s.x1)}
            y1={py(s.h1)}
            x2={px(s.x2)}
            y2={py(s.h2)}
            stroke="var(--color-ink)"
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}

      {/* ループ */}
      {layout.loops.map((l, i) => (
        <ellipse
          key={`loop-${i}`}
          cx={px(l.cx)}
          cy={py(l.bottom + l.r)}
          rx={l.r * SCALE}
          ry={l.r * SCALE * VERTICAL_EXAGGERATION}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={4}
        />
      ))}

      {/* 飛んでいく道すじ */}
      {layout.arc.length > 1 && (
        <polyline
          points={layout.arc.map((p) => `${px(p.x)},${py(p.h)}`).join(' ')}
          fill="none"
          stroke="var(--color-subtext)"
          strokeWidth={2.5}
          strokeDasharray="6 6"
        />
      )}

      {/* 缶をつるす支柱と缶 */}
      <line
        x1={px(layout.canX) + 18}
        y1={groundY}
        x2={px(layout.canX) + 18}
        y2={py(config.canHeight + layout.can.height / 2 + 0.08)}
        stroke="var(--color-line)"
        strokeWidth={3}
      />
      <line
        x1={px(layout.canX) + 18}
        y1={py(config.canHeight + layout.can.height / 2 + 0.08)}
        x2={px(layout.canX)}
        y2={py(config.canHeight + layout.can.height / 2 + 0.08)}
        stroke="var(--color-line)"
        strokeWidth={3}
      />
      <line
        x1={px(layout.canX)}
        y1={py(config.canHeight + layout.can.height / 2 + 0.08)}
        x2={px(layout.canX)}
        y2={py(config.canHeight + layout.can.height / 2)}
        stroke="var(--color-subtext)"
        strokeWidth={1.5}
      />
      {/* 缶：最初の位置。当たる場合は点線の枠にし、落ちて出会う位置を塗りつぶしで描く */}
      <rect
        x={px(layout.canX) - (layout.can.diameter * SCALE) / 2 - 2}
        y={py(config.canHeight + layout.can.height / 2)}
        width={layout.can.diameter * SCALE + 4}
        height={layout.can.height * SCALE * VERTICAL_EXAGGERATION}
        rx={2}
        fill={layout.canHitH === null ? 'var(--color-red)' : 'none'}
        stroke="var(--color-red)"
        strokeWidth={layout.canHitH === null ? 0 : 2}
        strokeDasharray="4 3"
      />
      {layout.canHitH !== null && (
        <>
          <line
            x1={px(layout.canX)}
            y1={py(config.canHeight - layout.can.height / 2) + 4}
            x2={px(layout.canX)}
            y2={py(layout.canHitH + layout.can.height / 2) - 10}
            stroke="var(--color-red)"
            strokeWidth={2}
          />
          <polygon
            points={`${px(layout.canX) - 6},${py(layout.canHitH + layout.can.height / 2) - 12} ${px(layout.canX) + 6},${py(layout.canHitH + layout.can.height / 2) - 12} ${px(layout.canX)},${py(layout.canHitH + layout.can.height / 2) - 3}`}
            fill="var(--color-red)"
          />
          <rect
            x={px(layout.canX) - (layout.can.diameter * SCALE) / 2 - 2}
            y={py(layout.canHitH + layout.can.height / 2)}
            width={layout.can.diameter * SCALE + 4}
            height={layout.can.height * SCALE * VERTICAL_EXAGGERATION}
            rx={2}
            fill="var(--color-red)"
          />
        </>
      )}

      {/* ボール */}
      <circle cx={px(layout.ballX)} cy={py(config.startHeight) - 7} r={6} fill="var(--color-subtext)" />

      {showLabels && (
        <g fontSize={fontSize} fontWeight={700} fill="var(--color-ink)" textAnchor="middle">
          {layout.labels.map((l, i) => (
            <text key={`label-${i}`} x={px(l.x)} y={py(l.h) - 12} textAnchor={l.anchor ?? 'middle'}>
              {l.text}
            </text>
          ))}
          {layout.slopeMids.map((m, i) => (
            <text
              key={`slope-label-${i}`}
              x={px(m.x) + 14}
              y={py(m.h) + 4}
              fill="var(--color-sky)"
              textAnchor="start"
            >
              坂
            </text>
          ))}
          {firstSlope && (
            <text
              x={px(firstSlope.x1) + 6}
              y={py(firstSlope.h1) + 38}
              fontSize={15}
              fill="var(--color-sky)"
              textAnchor="start"
            >
              30°
            </text>
          )}
          <text x={px(layout.canX)} y={py(config.canHeight + layout.can.height / 2 + 0.08) - 10}>
            缶
          </text>
          {layout.canHitH !== null && (
            <text
              x={px(layout.canX) - 14}
              y={(py(config.canHeight) + py(layout.canHitH)) / 2 + 5}
              fontSize={15}
              fill="var(--color-red)"
              textAnchor="end"
            >
              落ちる
            </text>
          )}
          <text
            x={(px(layout.launchX) + px(layout.canX)) / 2}
            y={groundY + 22}
            fontSize={15}
            fontWeight={500}
            fill="var(--color-subtext)"
          >
            ← 1.0 m →
          </text>
        </g>
      )}
    </svg>
  );
};
