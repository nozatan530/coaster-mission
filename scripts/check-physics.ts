/**
 * 物理モデルの確認（テストの代わり）
 * docs/studio-prompt.md「計算の確認用」の3設計を、理想の1回（ばらつきなし）で計算し、
 * 仕様の値と合うかを確かめる。ずれがあれば終了コード 1。
 *
 * 実行: npm run check:physics
 */

import { calculateRailUsage, simulateRun } from '../src/physics';
import type { CourseConfig } from '../src/types';

// レールの長さは仕様が「約」なので、この幅まで許す (m)
const RAIL_TOLERANCE = 0.05;

interface Expected {
  rail: number;
  exceeded: boolean;
  // 規定外の設計は走らせられないので、得点は確かめない
  scores?: { loop: number; slow: number; can: number; total: number };
}

interface Case {
  name: string;
  config: CourseConfig;
  expected: Expected;
}

const base: CourseConfig = {
  startHeight: 1.5,
  loopType: 'none',
  loop1Bottom: 1.0,
  loop2Bottom: 1.0,
  slowHeight: 1.45,
  launchHeight: 0.8,
  // 140 cm の缶は 1.40 m 先。発射台 80 cm から缶の中心へ向ける角度は atan(0.6 / 1.4) ≒ 23°
  launchAngle: 23,
  canSize: 'small',
  canHeight: 1.4,
  motionType: 'rolling',
};

const cases: Case[] = [
  {
    name: 'A ループなし・ゆっくり145cm・発射台80cm 23°・小さい缶140cm',
    config: { ...base },
    expected: { rail: 2.5, exceeded: false, scores: { loop: 0, slow: 22, can: 80, total: 102 } },
  },
  {
    name: 'B 小ループ(100cm)・ゆっくり140cm・発射台60cm 30°・中の缶140cm',
    // 発射台 80 cm では速さが足りず、1.40 m 先の缶が先に床に落ちる。60 cm に下げて速さを稼ぐ
    config: { ...base, loopType: 'small', loop1Bottom: 1.0, slowHeight: 1.4, launchHeight: 0.6, launchAngle: 30, canSize: 'medium' },
    // ゆっくり区間の中央は 2.2514 km/h で、四捨五入の境目（2.25 km/h）に乗る。
    // 2.3 km/h → 27点が正しい（当初の試算 28点・合計108点は、境目の反対側に出た値）
    expected: { rail: 5.64, exceeded: false, scores: { loop: 10, slow: 27, can: 70, total: 107 } },
  },
  {
    name: 'C 大(50cm)→小(50cm)・ゆっくり130cm・小さい缶',
    config: { ...base, loopType: 'large_small', loop1Bottom: 0.5, loop2Bottom: 0.5, slowHeight: 1.3 },
    // レール 10 m なら組めるが、缶が床に落ちて 0 点（全部入りが得とは限らない例）
    expected: { rail: 8.6, exceeded: false, scores: { loop: 40, slow: 40, can: 0, total: 80 } },
  },
  {
    name: 'D 大(60cm)→小(80cm)・ゆっくり125cm・発射台60cm 26°・大きい缶120cm（ばらつきに強い設計）',
    config: {
      ...base,
      loopType: 'large_small',
      loop1Bottom: 0.6,
      loop2Bottom: 0.8,
      slowHeight: 1.25,
      launchHeight: 0.6,
      launchAngle: 26,
      canSize: 'large',
      canHeight: 1.2,
    },
    expected: { rail: 8.41, exceeded: false, scores: { loop: 40, slow: 11, can: 50, total: 101 } },
  },
  {
    name: 'E 大(10cm)→小(10cm)・ゆっくり145cm・発射台10cm（10 m を超える）',
    config: { ...base, loopType: 'large_small', loop1Bottom: 0.1, loop2Bottom: 0.1, slowHeight: 1.45, launchHeight: 0.1 },
    expected: { rail: 12.21, exceeded: true },
  },
];

let failures = 0;

function check(label: string, actual: number | boolean, expected: number | boolean, ok: boolean) {
  const mark = ok ? 'OK ' : 'NG ';
  if (!ok) failures++;
  console.log(`  ${mark} ${label}: ${String(actual)}（仕様 ${String(expected)}）`);
}

for (const c of cases) {
  console.log(c.name);
  const rail = calculateRailUsage(c.config);
  const railRounded = Math.round(rail.total * 100) / 100;
  check('レール (m)', railRounded, c.expected.rail, Math.abs(rail.total - c.expected.rail) <= RAIL_TOLERANCE);
  check('規定外', rail.isExceeded, c.expected.exceeded, rail.isExceeded === c.expected.exceeded);

  if (c.expected.scores) {
    const r = simulateRun(c.config, { isIdeal: true });
    const s = c.expected.scores;
    const kmh = r.slowSpeedKmh !== undefined ? `（${r.slowSpeedKmh.toFixed(2)} km/h）` : '';
    check('ループ', r.loopPoints, s.loop, r.loopPoints === s.loop);
    check(`ゆっくり区間${kmh}`, r.slowSpeedPoints, s.slow, r.slowSpeedPoints === s.slow);
    check('缶', r.canPoints, s.can, r.canPoints === s.can);
    check('合計', r.totalScore, s.total, r.totalScore === s.total);
    if (r.failReason) console.log(`  失敗: ${r.failReason} ${r.failDescription ?? ''}`);
  }
}

console.log(failures === 0 ? '\nすべて仕様どおり' : `\n仕様とずれ: ${failures} 件`);
process.exit(failures === 0 ? 0 : 1);
