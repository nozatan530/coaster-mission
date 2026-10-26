/**
 * 物理エンジン・計算モデル (Physics Model for Ball Coaster Mission)
 * すべての定数はコード先頭の1か所にまとめて定義
 */

import {
  CanSize,
  CourseConfig,
  FailReasonType,
  LoopType,
  MotionType,
  PracticeFocus,
  RailBreakdown,
  SimulationResult,
  TrajectoryPoint,
} from './types';

// ==========================================
// 1. 定数定義 (Constants)
// ==========================================
export const PHYSICS_CONSTANTS = {
  // 重力加速度 (m/s^2)
  G: 9.8,

  // 使えるレール全長 (m)
  MAX_RAIL_LENGTH: 10.0,

  // 坂の傾き 30° -> レール長さ = 2.0 * |Δh| (sin 30° = 0.5)
  SLOPE_RAIL_FACTOR: 2.0,

  // 平らな部品のレール長さ (m)
  START_FLAT_LENGTH: 0.30,
  SLOW_FLAT_LENGTH: 0.50,
  LAUNCH_FLAT_LENGTH: 0.30,

  // ループの寸法 (m)
  LARGE_LOOP_RADIUS: 0.25, // 直径 50cm
  SMALL_LOOP_RADIUS: 0.15, // 直径 30cm
  LOOP_CONNECTOR_LENGTH: 0.20, // つなぎレール長 (m: 入口0.1m + 出口0.1m)

  // 摩擦係数 μ (レール 1m あたり 高さ 1.5cm 分のエネルギー熱損失)
  DEFAULT_MU: 0.015,

  // ループ突入時の壁衝突損失 (5% 損失)
  DEFAULT_LOOP_ENTRY_LOSS: 0.05,

  // 運動エネルギー係数 (E = factor * v^2)
  ROLLING_FACTOR: 0.7, // 転がる球: 0.7 * v^2 (1/2 mv^2 の 1.4倍)
  SLIDING_FACTOR: 0.5, // すべる物体: 0.5 * v^2

  // 発射台の先端から缶までの水平距離 (m)。高い缶ほど遠くに置く（最上段ばかりが得にならないように）
  // つるす高さ 60 cm → 0.80 m … 140 cm → 1.40 m（一直線に結ぶ）。docs/balance.md で決めた
  CAN_DISTANCES: {
    1.40: 1.40,
    1.20: 1.25,
    1.00: 1.10,
    0.80: 0.95,
    0.60: 0.80,
  } as Record<number, number>,

  // 許容誤差マージン (0.8 cm = 0.008 m)
  HIT_MARGIN_M: 0.008,

  // 缶の仕様
  CAN_SPECS: {
    small: { diameter: 0.06, height: 0.10, score: 30, name: '小' },
    medium: { diameter: 0.09, height: 0.12, score: 20, name: '中' },
    large: { diameter: 0.12, height: 0.16, score: 10, name: '大' },
  } as Record<CanSize, { diameter: number; height: number; score: number; name: string }>,

  // つるす高さの得点
  CAN_HEIGHT_SCORES: {
    1.40: 50,
    1.20: 40,
    1.00: 30,
    0.80: 20,
    0.60: 10,
  } as Record<number, number>,

  // ループ得点
  LOOP_SCORES: {
    large: 30,
    small: 10,
  },

  // 本番ばらつきパラメータ (Variability)
  VARIABILITY: {
    muStd: 0.12, // μ を ×(1 ＋ 正規分布 標準偏差0.12)
    loopLossMin: 0.5, // ループ損失係数 一様分布 0.5 ~ 1.5 倍
    loopLossMax: 1.5,
    launchAngleStdDeg: 1.2, // 発射角 ± 正規分布 標準偏差1.2°
    // 左右のずれ：正規分布。標準偏差は缶までの距離に比例し、1 m あたり 2.0 cm（向きの誤差なので遠いほど大きい）
    lateralStdPerM: 0.02,
  },
};

// 缶までの水平距離 (m)。表にない高さは、60 cm → 0.80 m と 140 cm → 1.40 m を結ぶ直線で決める
export function getCanDistance(canHeight: number): number {
  const key = Math.round(canHeight * 100) / 100;
  return PHYSICS_CONSTANTS.CAN_DISTANCES[key] ?? 0.8 + 0.75 * (canHeight - 0.6);
}

// ループのレール長
export function getLoopRailLength(radius: number): number {
  return 2 * Math.PI * radius + PHYSICS_CONSTANTS.LOOP_CONNECTOR_LENGTH;
}

export const LARGE_LOOP_RAIL_LENGTH = getLoopRailLength(PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS);
export const SMALL_LOOP_RAIL_LENGTH = getLoopRailLength(PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS);

// ==========================================
// 2. 正規分布・乱数生成 (Box-Muller)
// ==========================================
function randomGaussian(mean = 0, std = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
}

function randomUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ==========================================
// 3. レール使用量の計算 (Rail Calculation)
// ==========================================
export function calculateRailUsage(config: CourseConfig): RailBreakdown {
  const {
    startHeight,
    loopType,
    loop1Bottom,
    loop2Bottom,
    slowHeight,
    launchHeight,
  } = config;

  const startFlat = PHYSICS_CONSTANTS.START_FLAT_LENGTH; // 0.30
  const slowFlat = PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH; // 0.50
  const launchFlat = PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH; // 0.30

  let startToFirst = 0;
  let loop1Rail = 0;
  let betweenLoops = 0;
  let loop2Rail = 0;
  let toSlow = 0;

  if (loopType === 'none') {
    startToFirst = 2 * Math.abs(startHeight - slowHeight);
    toSlow = 0;
  } else if (loopType === 'small') {
    startToFirst = 2 * Math.abs(startHeight - loop1Bottom);
    loop1Rail = SMALL_LOOP_RAIL_LENGTH;
    toSlow = 2 * Math.abs(loop1Bottom - slowHeight);
  } else if (loopType === 'large') {
    startToFirst = 2 * Math.abs(startHeight - loop1Bottom);
    loop1Rail = LARGE_LOOP_RAIL_LENGTH;
    toSlow = 2 * Math.abs(loop1Bottom - slowHeight);
  } else if (loopType === 'small_large') {
    startToFirst = 2 * Math.abs(startHeight - loop1Bottom);
    loop1Rail = SMALL_LOOP_RAIL_LENGTH;
    betweenLoops = 2 * Math.abs(loop1Bottom - loop2Bottom);
    loop2Rail = LARGE_LOOP_RAIL_LENGTH;
    toSlow = 2 * Math.abs(loop2Bottom - slowHeight);
  } else if (loopType === 'large_small') {
    startToFirst = 2 * Math.abs(startHeight - loop1Bottom);
    loop1Rail = LARGE_LOOP_RAIL_LENGTH;
    betweenLoops = 2 * Math.abs(loop1Bottom - loop2Bottom);
    loop2Rail = SMALL_LOOP_RAIL_LENGTH;
    toSlow = 2 * Math.abs(loop2Bottom - slowHeight);
  }

  const slowToLaunch = 2 * Math.abs(slowHeight - launchHeight);

  const total =
    startFlat +
    startToFirst +
    loop1Rail +
    betweenLoops +
    loop2Rail +
    toSlow +
    slowFlat +
    slowToLaunch +
    launchFlat;

  const remaining = Math.round((PHYSICS_CONSTANTS.MAX_RAIL_LENGTH - total) * 1000) / 1000;
  const isExceeded = remaining < -0.0001;
  const excess = isExceeded ? Math.abs(remaining) : 0;

  return {
    startFlat,
    startToFirst,
    loop1Rail,
    betweenLoops,
    loop2Rail,
    toSlow,
    slowFlat,
    slowToLaunch,
    launchFlat,
    total: Math.round(total * 1000) / 1000,
    remaining,
    isExceeded,
    excess,
  };
}

// ==========================================
// 4. ゆっくり区間の得点計算
// ==========================================
export function calculateSlowPoints(speedKmh: number): number {
  if (speedKmh >= 5.0) return 0;
  // 5.0 km/h から 0.1 km/h 遅くなるごとに +1点 (例: 4.7 km/h -> 3点)
  const roundedSpeed = Math.round(speedKmh * 10) / 10;
  const diff = 5.0 - roundedSpeed;
  if (diff <= 0) return 0;
  return Math.round(diff * 10);
}

// ==========================================
// 5. 単一試走シミュレーション (Simulation)
// ==========================================
export interface SimulationOptions {
  isIdeal?: boolean;
  forcedMu?: number;
  forcedAngleDelta?: number;
  forcedLateralDelta?: number;
  // 練習ステージ用：その部品だけを走らせる
  //   loop   … スタート台 → 坂 → ループ を出たところで終わり
  //   slow   … スタート台 → 坂 → ゆっくり区間 を出たところで終わり
  //   launch … 発射台から始め、launchSpeed（発射台を飛び出す速さ m/s）で飛ばす
  practice?: PracticeFocus;
  launchSpeed?: number;
}

export function simulateRun(
  config: CourseConfig,
  options: SimulationOptions = {}
): SimulationResult {
  const isIdeal = options.isIdeal ?? true;
  const practice = options.practice;
  const {
    startHeight,
    loopType,
    loop1Bottom,
    loop2Bottom,
    slowHeight,
    launchHeight,
    launchAngle,
    canSize,
    canHeight,
    motionType,
  } = config;

  const factor =
    motionType === 'sliding'
      ? PHYSICS_CONSTANTS.SLIDING_FACTOR
      : PHYSICS_CONSTANTS.ROLLING_FACTOR;

  // ばらつきの適用
  let mu = PHYSICS_CONSTANTS.DEFAULT_MU;
  let loopLossMultiplier = 1.0;
  let actualAngle = launchAngle;
  let lateralOffset = 0;

  if (!isIdeal) {
    if (options.forcedMu !== undefined) {
      mu = options.forcedMu;
    } else {
      const muFluct = randomGaussian(0, PHYSICS_CONSTANTS.VARIABILITY.muStd);
      mu = Math.max(0.001, PHYSICS_CONSTANTS.DEFAULT_MU * (1 + muFluct));
    }

    loopLossMultiplier = randomUniform(
      PHYSICS_CONSTANTS.VARIABILITY.loopLossMin,
      PHYSICS_CONSTANTS.VARIABILITY.loopLossMax
    );

    if (options.forcedAngleDelta !== undefined) {
      actualAngle = launchAngle + options.forcedAngleDelta;
    } else {
      const angleDelta = randomGaussian(0, PHYSICS_CONSTANTS.VARIABILITY.launchAngleStdDeg);
      actualAngle = Math.max(0, Math.min(60, launchAngle + angleDelta));
    }

    if (options.forcedLateralDelta !== undefined) {
      lateralOffset = options.forcedLateralDelta;
    } else {
      lateralOffset = randomGaussian(0, PHYSICS_CONSTANTS.VARIABILITY.lateralStdPerM * getCanDistance(canHeight));
    }
  }

  const loopLossRate = PHYSICS_CONSTANTS.DEFAULT_LOOP_ENTRY_LOSS * loopLossMultiplier;

  // 初期状態
  let E = 0; // 運動エネルギー/m (J/kg)
  let T = 0; // 熱など損失/m (J/kg)
  let currentHeight = startHeight;
  let currentTime = 0;
  let currentX = 0;

  const trajectory: TrajectoryPoint[] = [];

  // kOverride：空中で回転のエネルギーが残るときなど、K を直接決める
  function addPoint(x: number, y: number, v: number, section: string, dt = 0, kOverride?: number) {
    currentTime += dt;
    const K = kOverride ?? factor * v * v;
    const U = PHYSICS_CONSTANTS.G * y;
    trajectory.push({
      x,
      y,
      time: currentTime,
      v,
      K,
      U,
      T,
      section,
    });
  }

  // 発射練習：発射台の根元から始める。摩擦のぶんを足して、先端を飛び出す速さが launchSpeed になるようにする
  if (practice === 'launch') {
    const v = options.launchSpeed ?? 0;
    currentHeight = launchHeight;
    E = factor * v * v + PHYSICS_CONSTANTS.G * mu * PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH;
    addPoint(0, currentHeight, Math.sqrt(E / factor), '発射台');
  }

  // 1. スタート台 (0.30m)
  if (practice !== 'launch') {
    addPoint(0, currentHeight, 0, 'スタート台');
    // スタート台先端
    currentX += PHYSICS_CONSTANTS.START_FLAT_LENGTH;
    addPoint(currentX, currentHeight, 0, 'スタート台先端');
  }

  // 得点トラッキング
  let loopPoints = 0;
  let smallLoopPassed = false;
  let largeLoopPassed = false;
  let slowSpeedKmh: number | undefined = undefined;
  let slowSpeedPoints = 0;
  let canPoints = 0;
  let canHitSuccess = false;
  let tLaunch = -1;
  const canTrajectory: { time: number; y: number }[] = [{ time: 0, y: canHeight }];

  const speedsRecord: SimulationResult['speeds'] = {
    start: 0,
    launchTip: 0,
  };

  // ループ情報の構築
  interface LoopItem {
    kind: 'small' | 'large';
    radius: number;
    bottom: number;
    rail: number;
  }
  const loops: LoopItem[] = [];
  if (loopType === 'small') {
    loops.push({
      kind: 'small',
      radius: PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS,
      bottom: loop1Bottom,
      rail: SMALL_LOOP_RAIL_LENGTH,
    });
  } else if (loopType === 'large') {
    loops.push({
      kind: 'large',
      radius: PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS,
      bottom: loop1Bottom,
      rail: LARGE_LOOP_RAIL_LENGTH,
    });
  } else if (loopType === 'small_large') {
    loops.push({
      kind: 'small',
      radius: PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS,
      bottom: loop1Bottom,
      rail: SMALL_LOOP_RAIL_LENGTH,
    });
    loops.push({
      kind: 'large',
      radius: PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS,
      bottom: loop2Bottom,
      rail: LARGE_LOOP_RAIL_LENGTH,
    });
  } else if (loopType === 'large_small') {
    loops.push({
      kind: 'large',
      radius: PHYSICS_CONSTANTS.LARGE_LOOP_RADIUS,
      bottom: loop1Bottom,
      rail: LARGE_LOOP_RAIL_LENGTH,
    });
    loops.push({
      kind: 'small',
      radius: PHYSICS_CONSTANTS.SMALL_LOOP_RADIUS,
      bottom: loop2Bottom,
      rail: SMALL_LOOP_RAIL_LENGTH,
    });
  }

  // 発射練習ではループを通らない
  if (practice === 'launch') loops.length = 0;

  // ヘルパー：坂道（または平地）を進める
  function traverseRamp(targetHeight: number, label: string): { ok: boolean; reason?: FailReasonType } {
    const deltaH = currentHeight - targetHeight; // 正なら下り坂、負なら上り坂
    const slopeLength = 2.0 * Math.abs(deltaH);
    const g = PHYSICS_CONSTANTS.G;

    if (slopeLength < 0.001) {
      currentHeight = targetHeight;
      return { ok: true };
    }

    const steps = Math.max(6, Math.ceil(slopeLength * 16));
    const stepLength = slopeLength / steps;
    const stepDeltaH = deltaH / steps;
    const horizontalStep = (slopeLength * Math.cos((30 * Math.PI) / 180)) / steps;

    for (let i = 1; i <= steps; i++) {
      const potentialChange = g * stepDeltaH;
      const frictionLoss = g * mu * stepLength;

      const nextE = E + potentialChange - frictionLoss;
      T += frictionLoss;

      if (nextE <= 0) {
        E = 0;
        const v = 0;
        currentHeight -= stepDeltaH * 0.5;
        currentX += horizontalStep * 0.5;
        addPoint(currentX, currentHeight, v, label + '（停止）', 0.05);

        if (deltaH < 0) {
          return { ok: false, reason: 'slope_rollback' };
        } else {
          return { ok: false, reason: 'slow_stop' };
        }
      }

      E = nextE;
      currentHeight -= stepDeltaH;
      currentX += horizontalStep;
      const v = Math.sqrt(E / factor);
      const avgV = Math.max(0.1, v);
      const dt = stepLength / avgV;
      addPoint(currentX, currentHeight, v, label, dt);
    }

    currentHeight = targetHeight;
    return { ok: true };
  }

  // --- ループ区間の処理 ---
  for (let idx = 0; idx < loops.length; idx++) {
    const loop = loops[idx];
    const loopNum = idx + 1;

    // 1) 坂を下ってループ最下点へ
    const rampRes = traverseRamp(loop.bottom, `ループ${loopNum}への坂`);
    if (!rampRes.ok) {
      return makeResult({
        failReason: rampRes.reason,
        failDescription:
          rampRes.reason === 'slope_rollback'
            ? '坂を登りきれずに戻ってしまいました'
            : '途中で停止してしまいました',
        failedAt: `ループ${loopNum}への坂`,
      });
    }

    // 2) ループ入口つなぎレール (0.10m 平坦)
    const leadInLength = 0.10;
    const leadInLoss = PHYSICS_CONSTANTS.G * mu * leadInLength;
    if (E - leadInLoss <= 0) {
      E = 0;
      addPoint(currentX + 0.05, currentHeight, 0, `ループ${loopNum}入口（停止）`, 0.05);
      return makeResult({
        failReason: 'slow_stop',
        failDescription: `ループ${loopNum}の手前で停止してしまいました`,
        failedAt: `ループ${loopNum}入口`,
      });
    }
    E -= leadInLoss;
    T += leadInLoss;
    currentX += leadInLength;
    const vBeforeLoop = Math.sqrt(E / factor);
    addPoint(currentX, currentHeight, vBeforeLoop, `ループ${loopNum}入口`, leadInLength / Math.max(0.1, vBeforeLoop));

    // ループ底速度記録
    if (idx === 0) speedsRecord.loop1Bottom = vBeforeLoop;
    else speedsRecord.loop2Bottom = vBeforeLoop;

    // 3) 壁衝突損失 (5% 損失)
    const collisionLoss = E * loopLossRate;
    E -= collisionLoss;
    T += collisionLoss;

    // 4) ループ前半（最下点 -> 頂上）：半径 r, 円弧 π r
    const G = PHYSICS_CONSTANTS.G;
    const r = loop.radius;
    const halfArc = Math.PI * r;
    const climbHeight = 2 * r;
    const lossHalf = G * mu * halfArc;

    const eTop = E - G * climbHeight - lossHalf;

    const vTopSq = eTop > 0 ? eTop / factor : 0;
    const vTop = Math.sqrt(Math.max(0, vTopSq));
    const critSq = G * r; // v^2 >= g * r

    if (idx === 0) {
      speedsRecord.loop1Top = vTop;
      speedsRecord.loop1TopCrit = Math.sqrt(critSq);
    } else {
      speedsRecord.loop2Top = vTop;
      speedsRecord.loop2TopCrit = Math.sqrt(critSq);
    }

    // ループ頂上の通過判定：v^2 >= g * r（得点の判定はこの条件だけで決める）
    const passesTop = !(vTopSq < critSq || eTop <= 0);

    // 円の中心は (currentX, loop.bottom + r)。phi は最下点から回った角度
    const cx = currentX;
    const cy = loop.bottom + r;
    const pointAt = (phi: number) => ({
      x: cx + r * Math.sin(phi),
      y: cy - r * Math.cos(phi),
    });
    const eBottom = E;
    const tBottom = T;
    // 最下点から角度 phi まで回ったときの運動エネルギー/m と、そこまでの摩擦の熱
    const energyAt = (phi: number) => eBottom - G * r * (1 - Math.cos(phi)) - G * mu * r * phi;

    // 通過するときは粗く、落ちるときは離れる点を見つけるため細かく刻む
    const climbSteps = passesTop ? 8 : 60;
    let lastPhi = 0;
    for (let s = 1; s <= climbSteps; s++) {
      const phi = (Math.PI * s) / climbSteps;
      const eHere = energyAt(phi);
      if (!passesTop) {
        // 途中で止まる（速さが 0）か、レールから離れる（垂直抗力が 0：v²/r + g cosφ < 0）
        if (eHere <= 0 || eHere / factor / r + G * Math.cos(phi) < 0) break;
      }
      T = tBottom + G * mu * r * phi;
      E = eHere;
      const p = pointAt(phi);
      const v = Math.sqrt(Math.max(0, eHere) / factor);
      addPoint(p.x, p.y, v, `ループ${loopNum}上昇`, (halfArc / climbSteps) / Math.max(0.2, v));
      lastPhi = phi;
    }

    if (!passesTop) {
      const pLast = pointAt(lastPhi);
      const vLast = Math.sqrt(Math.max(0, E) / factor);

      if (lastPhi <= Math.PI / 2 || vLast < 0.05) {
        // 半分の高さまで登れずに止まり、坂を戻る（見た目用）
        const backSteps = Math.max(2, Math.round((lastPhi / Math.PI) * 30));
        for (let s = 1; s <= backSteps; s++) {
          const phi = lastPhi * (1 - s / backSteps);
          const back = lastPhi - phi;
          const eBack = Math.max(0, E + G * r * (Math.cos(phi) - Math.cos(lastPhi)) - G * mu * r * back);
          const tBack = T + G * mu * r * back;
          const p = pointAt(phi);
          const v = Math.sqrt(eBack / factor);
          const prevT = T;
          T = tBack;
          addPoint(p.x, p.y, v, `ループ${loopNum}戻り`, (r * (lastPhi / backSteps)) / Math.max(0.2, v));
          T = prevT;
        }
        T = T + G * mu * r * lastPhi;
        return makeResult({
          failReason: 'loop_fall',
          failDescription: `ループ${loopNum}を半分の高さ（${Math.round((loop.bottom + r) * 100)} cm）まで登れずに止まり、戻ってしまいました（頂上を回るには、頂上で ${Math.sqrt(critSq).toFixed(2)} m/s 以上の速さが必要）`,
          failedAt: `ループ${loopNum}`,
        });
      }

      // レールから離れて、ループの内側を落ちる（見た目用。回転のエネルギーはそのまま残る）
      const angle = lastPhi;
      let fx = pLast.x;
      let fy = pLast.y;
      let fvx = vLast * Math.cos(angle);
      let fvy = vLast * Math.sin(angle);
      const eRot = (factor - 0.5) * vLast * vLast;
      const totalAtLeave = E + G * pLast.y + T;
      const dtFall = 0.01;
      for (let s = 1; s <= 150; s++) {
        fvy -= G * dtFall;
        fx += fvx * dtFall;
        fy += fvy * dtFall;
        const speed = Math.hypot(fvx, fvy);
        const dist = Math.hypot(fx - cx, fy - cy);
        if ((s * dtFall > 0.03 && dist >= r) || fy <= loop.bottom) {
          // レールにぶつかる
          const k = r / Math.max(dist, 1e-6);
          fx = cx + (fx - cx) * Math.min(1, k);
          fy = Math.max(loop.bottom, cy + (fy - cy) * Math.min(1, k));
          addPoint(fx, fy, speed, `ループ${loopNum}落下`, dtFall, eRot + 0.5 * speed * speed);
          break;
        }
        addPoint(fx, fy, speed, `ループ${loopNum}落下`, dtFall, eRot + 0.5 * speed * speed);
      }
      // ぶつかったあと、ループの底に落ち着く（衝突で失ったぶんは熱など T に入れる）
      T = totalAtLeave - G * loop.bottom;
      addPoint(cx, loop.bottom, 0, `ループ${loopNum}落下`, 0.3);
      return makeResult({
        failReason: 'loop_fall',
        failDescription: `ループ${loopNum}の途中（高さ ${Math.round(pLast.y * 100)} cm）でレールから離れて落ちました（頂上を回るには、頂上で ${Math.sqrt(critSq).toFixed(2)} m/s 以上の速さが必要）`,
        failedAt: `ループ${loopNum}`,
      });
    }

    // 5) ループ後半（頂上 -> 最下点）
    const tTop = T;
    const descendSteps = 8;
    for (let s = 1; s <= descendSteps; s++) {
      const psi = (Math.PI * s) / descendSteps; // 頂上から回った角度
      const eHere = eTop + G * r * (1 - Math.cos(psi)) - G * mu * r * psi;
      T = tTop + G * mu * r * psi;
      E = eHere;
      const p = pointAt(Math.PI + psi);
      const v = Math.sqrt(Math.max(0, eHere) / factor);
      addPoint(p.x, p.y, v, `ループ${loopNum}下降`, (halfArc / descendSteps) / Math.max(0.2, v));
    }

    // 6) ループ出口つなぎレール (0.10m 平坦)
    const leadOutLength = 0.10;
    const leadOutLoss = PHYSICS_CONSTANTS.G * mu * leadOutLength;
    if (E - leadOutLoss <= 0) {
      E = 0;
      addPoint(currentX + 0.05, currentHeight, 0, `ループ${loopNum}出口（停止）`, 0.05);
      return makeResult({
        failReason: 'slow_stop',
        failDescription: `ループ${loopNum}の出口で停止してしまいました`,
        failedAt: `ループ${loopNum}出口`,
      });
    }
    E -= leadOutLoss;
    T += leadOutLoss;
    currentX += leadOutLength;
    currentHeight = loop.bottom;
    const vAfterLoop = Math.sqrt(E / factor);
    addPoint(currentX, currentHeight, vAfterLoop, `ループ${loopNum}通過`, leadOutLength / Math.max(0.1, vAfterLoop));

    if (loop.kind === 'small') {
      smallLoopPassed = true;
      loopPoints += PHYSICS_CONSTANTS.LOOP_SCORES.small;
    } else {
      largeLoopPassed = true;
      loopPoints += PHYSICS_CONSTANTS.LOOP_SCORES.large;
    }
  }

  // ループ練習：ループを出て少し進んだところで終わり
  if (practice === 'loop') {
    const exitLength = 0.3;
    const exitLoss = PHYSICS_CONSTANTS.G * mu * exitLength;
    E = Math.max(0, E - exitLoss);
    T += exitLoss;
    currentX += exitLength;
    const vExit = Math.sqrt(E / factor);
    addPoint(currentX, currentHeight, vExit, 'ループ通過後', exitLength / Math.max(0.1, vExit));
    return makeResult({ success: true });
  }

  if (practice !== 'launch') {
    // --- ゆっくり区間への坂 ---
    const toSlowRes = traverseRamp(slowHeight, 'ゆっくり区間への坂');
    if (!toSlowRes.ok) {
      return makeResult({
        failReason: toSlowRes.reason,
        failDescription:
          toSlowRes.reason === 'slope_rollback'
            ? 'ゆっくり区間への上り坂を登りきれずに戻ってしまいました'
            : 'ゆっくり区間の手前で停止してしまいました',
        failedAt: 'ゆっくり区間手前の坂',
      });
    }

    // --- ゆっくり区間 (0.50m) ---
    const slowHalfRail = PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH / 2; // 0.25m
    const slowLossHalf = PHYSICS_CONSTANTS.G * mu * slowHalfRail;

    if (E - slowLossHalf <= 0) {
      E = 0;
      addPoint(currentX + 0.1, currentHeight, 0, 'ゆっくり区間（停止）', 0.1);
      return makeResult({
        failReason: 'slow_stop',
        failDescription: 'ゆっくり区間で止まってしまいました（速度が0になりました）',
        failedAt: 'ゆっくり区間前半',
      });
    }

    E -= slowLossHalf;
    T += slowLossHalf;
    currentX += slowHalfRail;

    // 中央での速度測定 (km/h)
    const vMid = Math.sqrt(E / factor);
    slowSpeedKmh = vMid * 3.6;
    speedsRecord.slowMidKmh = slowSpeedKmh;
    slowSpeedPoints = calculateSlowPoints(slowSpeedKmh);

    addPoint(currentX, currentHeight, vMid, 'ゆっくり区間中央 (計測点)', slowHalfRail / Math.max(0.1, vMid));

    // ゆっくり区間の後半 (0.25m)
    if (E - slowLossHalf <= 0) {
      E = 0;
      addPoint(currentX + 0.1, currentHeight, 0, 'ゆっくり区間後半（停止）', 0.1);
      return makeResult({
        failReason: 'slow_stop',
        failDescription: 'ゆっくり区間の後半で止まってしまいました',
        failedAt: 'ゆっくり区間後半',
      });
    }

    E -= slowLossHalf;
    T += slowLossHalf;
    currentX += slowHalfRail;
    addPoint(currentX, currentHeight, Math.sqrt(E / factor), 'ゆっくり区間出口', slowHalfRail / Math.max(0.1, vMid));

    // ゆっくり区間練習：区間を出たところで終わり
    if (practice === 'slow') {
      return makeResult({ success: true });
    }

    // --- 発射台への坂 ---
    const toLaunchRes = traverseRamp(launchHeight, '発射台への坂');
    if (!toLaunchRes.ok) {
      return makeResult({
        failReason: toLaunchRes.reason,
        failDescription:
          toLaunchRes.reason === 'slope_rollback'
            ? '発射台への坂を登りきれずに戻ってしまいました'
            : '発射台の手前で停止してしまいました',
        failedAt: '発射台手前の坂',
      });
    }
  }

  // --- 発射台 (0.30m 角度θで直進) ---
  const launchLength = PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH;
  const rad = (actualAngle * Math.PI) / 180;
  const launchDx = launchLength * Math.cos(rad);
  const launchStartX = currentX;
  const launchTipX = launchStartX + launchDx;
  const launchTipY = launchHeight;

  // 発射台上の転がり（4分割して時間を正確に追跡）
  const launchSteps = 4;
  const stepRail = launchLength / launchSteps;
  const stepLoss = PHYSICS_CONSTANTS.G * mu * stepRail;

  let stoppedOnLaunch = false;
  for (let s = 1; s <= launchSteps; s++) {
    if (E - stepLoss <= 0) {
      E = 0;
      addPoint(launchStartX + (launchDx * (s - 0.5)) / launchSteps, launchHeight, 0, '発射台（停止）', 0.05);
      stoppedOnLaunch = true;
      break;
    }
    E -= stepLoss;
    T += stepLoss;
    const curV = Math.sqrt(E / factor);
    const dt = stepRail / Math.max(0.1, curV);
    const curX = launchStartX + (launchDx * s) / launchSteps;
    if (s < launchSteps) {
      addPoint(curX, launchHeight, curV, '発射台', dt);
    } else {
      currentTime += dt;
      currentX = launchTipX;
      currentHeight = launchTipY;
      const vLaunch = curV;
      speedsRecord.launchTip = vLaunch;
      tLaunch = currentTime; // 発射台先端を飛び出した瞬間の時刻！
      trajectory.push({
        x: launchTipX,
        y: launchTipY,
        time: tLaunch,
        v: vLaunch,
        K: factor * vLaunch * vLaunch,
        U: PHYSICS_CONSTANTS.G * launchTipY,
        T,
        section: '発射台先端（発射！）',
      });
    }
  }

  if (stoppedOnLaunch) {
    return makeResult({
      failReason: 'slow_stop',
      failDescription: '発射台の上で止まってしまい、発射できませんでした',
      failedAt: '発射台',
    });
  }

  const vLaunch = speedsRecord.launchTip;

  // --- 斜方投射 & 缶の自由落下 (Projectile & Can Motion) ---
  const v0x = vLaunch * Math.cos(rad);
  const v0y = vLaunch * Math.sin(rad);

  if (v0x <= 0.01) {
    return makeResult({
      failReason: 'miss_under',
      failDescription: '水平方向の速度が足りず、缶まで届きませんでした',
      failedAt: '空中',
    });
  }

  // 缶の位置（水平距離）に届く時刻 (滞空時間)
  const canDistance = getCanDistance(canHeight);
  const tAirHit = canDistance / v0x;

  // 缶の仕様
  const canSpec = PHYSICS_CONSTANTS.CAN_SPECS[canSize];
  const toleranceY = canSpec.height / 2 + PHYSICS_CONSTANTS.HIT_MARGIN_M;
  const toleranceLateral = canSpec.diameter / 2 + PHYSICS_CONSTANTS.HIT_MARGIN_M;

  // 缶の落下軌跡記録用：tLaunch で自由落下開始
  canTrajectory.length = 0;
  canTrajectory.push({ time: 0, y: canHeight });
  if (tLaunch > 0) {
    canTrajectory.push({ time: tLaunch, y: canHeight });
  }

  const flightSteps = 30;
  const dtFlight = tAirHit / flightSteps;
  let canHitFloorBeforeBall = false;

  for (let step = 1; step <= flightSteps; step++) {
    const tAir = step * dtFlight;
    const tAbsolute = tLaunch + tAir;

    const bx = launchTipX + v0x * tAir;
    const by = launchTipY + v0y * tAir - 0.5 * PHYSICS_CONSTANTS.G * tAir * tAir;
    const currentSpeed = Math.sqrt(v0x * v0x + Math.pow(v0y - PHYSICS_CONSTANTS.G * tAir, 2));

    // 缶の高さ (tLaunch から自由落下開始)
    const cy = canHeight - 0.5 * PHYSICS_CONSTANTS.G * tAir * tAir;
    const canBottom = cy - canSpec.height / 2;

    if (canBottom <= 0 && !canHitFloorBeforeBall && step < flightSteps) {
      canHitFloorBeforeBall = true;
    }

    canTrajectory.push({
      time: tAbsolute,
      y: Math.max(0, cy),
    });

    currentTime = tAbsolute;
    trajectory.push({
      x: bx,
      y: by,
      time: currentTime,
      v: currentSpeed,
      K: 0.5 * currentSpeed * currentSpeed,
      U: PHYSICS_CONSTANTS.G * by,
      T,
      section: '空中（斜方投射）',
    });
  }

  // 到達時刻での高さ判定
  const ballYAtHit = launchTipY + v0y * tAirHit - 0.5 * PHYSICS_CONSTANTS.G * tAirHit * tAirHit;
  const canYAtHit = canHeight - 0.5 * PHYSICS_CONSTANTS.G * tAirHit * tAirHit;
  const canBottomAtHit = canYAtHit - canSpec.height / 2;
  const deltaY = ballYAtHit - canYAtHit;
  const aimYAtTarget = launchTipY + canDistance * Math.tan(rad);

  const projectileData = {
    tHit: tLaunch + tAirHit,
    ballYAtHit,
    canYAtHit,
    deltaY,
    toleranceY,
    lateralDelta: lateralOffset,
    toleranceLateral,
    canFloorY: canBottomAtHit,
    aimYAtTarget,
    isHit: false,
    points: 0,
  };

  // 1) 缶が先に床に着いたか？
  if (canBottomAtHit <= 0 || canHitFloorBeforeBall) {
    return makeResult({
      failReason: 'can_hit_floor',
      failDescription: 'ボールが届く前に缶が床に落ちてしまいました（発射速度をもっと速くするか、缶を高くしてください）',
      failedAt: '標的缶',
      projectileData,
    });
  }

  // 2) 上下方向の命中判定
  if (Math.abs(deltaY) > toleranceY) {
    if (deltaY > 0) {
      return makeResult({
        failReason: 'miss_over',
        failDescription: `缶の上を通過してしまいました（高さズレ: +${(deltaY * 100).toFixed(1)} cm / 許容: ±${(toleranceY * 100).toFixed(1)} cm）`,
        failedAt: '標的缶',
        projectileData,
      });
    } else {
      return makeResult({
        failReason: 'miss_under',
        failDescription: `缶の下を通過してしまいました（高さズレ: ${(deltaY * 100).toFixed(1)} cm / 許容: ±${(toleranceY * 100).toFixed(1)} cm）`,
        failedAt: '標的缶',
        projectileData,
      });
    }
  }

  // 3) 左右のブレ判定 (本番ばらつき)
  if (Math.abs(lateralOffset) > toleranceLateral) {
    return makeResult({
      failReason: 'miss_lateral',
      failDescription: `左右に外れてしまいました（横ズレ: ${(lateralOffset * 100).toFixed(1)} cm / 許容: ±${(toleranceLateral * 100).toFixed(1)} cm）`,
      failedAt: '標的缶',
      projectileData,
    });
  }

  // 4) 命中成功！
  canHitSuccess = true;
  projectileData.isHit = true;
  const sizeScore = canSpec.score;
  const heightScore = PHYSICS_CONSTANTS.CAN_HEIGHT_SCORES[canHeight] || 0;
  canPoints = sizeScore + heightScore;
  projectileData.points = canPoints;

  return makeResult({
    success: true,
    projectileData,
    canHitSuccess: true,
  });

  // ヘルパー：結果オブジェクト構築
  function makeResult(extra: Partial<SimulationResult>): SimulationResult {
    const totalScore = loopPoints + slowSpeedPoints + canPoints;
    return {
      isIdeal,
      success: extra.success ?? false,
      failReason: extra.failReason,
      failDescription: extra.failDescription,
      failedAt: extra.failedAt,
      loopPoints,
      smallLoopPassed,
      largeLoopPassed,
      slowSpeedKmh,
      slowSpeedPoints,
      canPoints,
      canHitSuccess,
      totalScore,
      speeds: speedsRecord,
      projectileData: extra.projectileData,
      trajectory,
      canTrajectory,
      totalTime: currentTime,
      tLaunch,
      ...extra,
    };
  }
}

// ==========================================
// 6. 10回連続シミュレーション (10 Runs Batch)
// ==========================================
export function simulateTenRuns(config: CourseConfig): {
  idealResult: SimulationResult;
  batchTrials: SimulationResult[];
  averageScore: number;
  successRate: number;
  failBreakdown: Record<FailReasonType, number>;
} {
  const idealResult = simulateRun(config, { isIdeal: true });

  const batchTrials: SimulationResult[] = [];
  const failBreakdown: Record<FailReasonType, number> = {
    loop_fall: 0,
    slow_stop: 0,
    slope_rollback: 0,
    miss_over: 0,
    miss_under: 0,
    miss_lateral: 0,
    can_hit_floor: 0,
  };

  let totalScoreSum = 0;
  let successCount = 0;

  for (let i = 0; i < 10; i++) {
    const trial = simulateRun(config, { isIdeal: false });
    batchTrials.push(trial);
    totalScoreSum += trial.totalScore;
    if (trial.canHitSuccess) {
      successCount++;
    } else if (trial.failReason) {
      failBreakdown[trial.failReason] = (failBreakdown[trial.failReason] || 0) + 1;
    }
  }

  const averageScore = Math.round((totalScoreSum / 10) * 10) / 10;
  const successRate = Math.round((successCount / 10) * 100);

  return {
    idealResult,
    batchTrials,
    averageScore,
    successRate,
    failBreakdown,
  };
}

// 日本語の失敗理由ラベル
export const FAIL_REASON_LABELS: Record<FailReasonType, string> = {
  loop_fall: 'ループ頂上で速さ不足',
  slow_stop: 'ゆっくり区間で停止',
  slope_rollback: '坂を戻った',
  miss_over: '缶の上を通過',
  miss_under: '缶の下を通過',
  miss_lateral: '左右に外れた',
  can_hit_floor: '缶が床に落ちた',
};
