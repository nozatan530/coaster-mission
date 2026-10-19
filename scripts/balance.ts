/**
 * バランス試算
 * concept.md「試算で確かめたバランス」の代表5設計を、ばらつきありで何回も走らせ、
 * 平均点・成功率を concept.md の表と比べる。あわせて、缶のつるす高さと大きさの選び方で
 * 平均点がどう変わるか（最上段 140 cm がいつも得になっていないか）を見る。
 *
 * 実行: npm run balance            （1設計 1,000 回）
 *       npm run balance -- 3000    （回数を変える）
 * 乱数は種を固定しているので、同じ回数なら毎回同じ結果になる。
 */

import { calculateRailUsage, simulateRun, PHYSICS_CONSTANTS } from '../src/physics';
import type { CanSize, CourseConfig } from '../src/types';

const RUNS = Number(process.argv[2]) || 1000;

// 種を固定した乱数（mulberry32）。physics.ts は Math.random を使うので差し替える
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 缶の中心へまっすぐ向ける角度（発射台の先端から水平に 1.0 m 先）
function aimAngle(launchHeight: number, canHeight: number) {
  const deg = Math.round((Math.atan((canHeight - launchHeight) / PHYSICS_CONSTANTS.CAN_HORIZONTAL_DISTANCE) * 180) / Math.PI);
  return Math.max(0, Math.min(60, deg));
}

const base: CourseConfig = {
  startHeight: 1.5,
  loopType: 'none',
  loop1Bottom: 1.0,
  loop2Bottom: 1.0,
  slowHeight: 1.45,
  launchHeight: 0.8,
  launchAngle: 31,
  canSize: 'small',
  canHeight: 1.4,
  motionType: 'rolling',
};

interface Design {
  name: string;
  config: CourseConfig;
  // concept.md の表の値（理想の点・平均点・成功率%）
  concept: { ideal: number; average: number; success: number; rail: number };
}

const designs: Design[] = [
  {
    name: 'ループなし・ゆっくり145・小さい缶140',
    config: { ...base },
    concept: { rail: 2.5, ideal: 102, average: 83, success: 76 },
  },
  {
    name: '大ループだけ・ゆっくり区間はあきらめる',
    config: { ...base, loopType: 'large', loop1Bottom: 0.6, slowHeight: 0.6, launchHeight: 0.7, launchAngle: 35 },
    concept: { rail: 4.9, ideal: 110, average: 91, success: 77 },
  },
  {
    name: '小ループだけ・ゆっくり140・中の缶140',
    config: { ...base, loopType: 'small', loop1Bottom: 1.0, slowHeight: 1.4, canSize: 'medium' },
    concept: { rail: 5.2, ideal: 108, average: 102, success: 91 },
  },
  {
    name: '大＋小ループ・ゆっくり区間はあきらめる・中の缶140',
    config: {
      ...base,
      loopType: 'large_small',
      loop1Bottom: 0.6,
      loop2Bottom: 0.6,
      slowHeight: 0.6,
      launchHeight: 0.6,
      launchAngle: 40,
      canSize: 'medium',
    },
    concept: { rail: 5.8, ideal: 110, average: 104, success: 91 },
  },
  {
    name: '全部入り（大＋小・ゆっくり130・小さい缶）※規定外',
    config: { ...base, loopType: 'large_small', loop1Bottom: 0.5, loop2Bottom: 0.5, slowHeight: 1.3 },
    concept: { rail: 8.6, ideal: 158, average: 93, success: 42 },
  },
];

function runMany(config: CourseConfig, runs: number, seed: number) {
  const original = Math.random;
  Math.random = seededRandom(seed);
  let sum = 0;
  let hits = 0;
  const fails: Record<string, number> = {};
  try {
    for (let i = 0; i < runs; i++) {
      const r = simulateRun(config, { isIdeal: false });
      sum += r.totalScore;
      if (r.canHitSuccess) hits++;
      else if (r.failReason) fails[r.failReason] = (fails[r.failReason] ?? 0) + 1;
    }
  } finally {
    Math.random = original;
  }
  return { average: sum / runs, success: (hits / runs) * 100, fails };
}

console.log(`# バランス試算（1設計 ${RUNS} 回、ばらつきあり）\n`);
console.log('| 設計 | レール | 理想の点 | 平均点 | 成功率 | 試算（レール／理想／平均／成功率） | 主な失敗 |');
console.log('|---|---|---|---|---|---|---|');
designs.forEach((d, i) => {
  const rail = calculateRailUsage(d.config);
  const ideal = simulateRun(d.config, { isIdeal: true }).totalScore;
  const m = runMany(d.config, RUNS, 1000 + i);
  const fails = Object.entries(m.fails)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${k} ${((v / RUNS) * 100).toFixed(0)}%`)
    .join('、');
  console.log(
    `| ${d.name} | ${rail.total.toFixed(2)} m${rail.isExceeded ? '（規定外）' : ''} | ${ideal} | ${m.average.toFixed(1)} | ${m.success.toFixed(0)}% | ${d.concept.rail} m／${d.concept.ideal}／${d.concept.average}／${d.concept.success}% | ${fails || '—'} |`
  );
});

// 缶のつるす高さ・大きさを変えたとき（発射の角度は、毎回缶の中心へまっすぐ向け直す）
console.log(`\n# 缶の選び方による平均点（缶の中心へまっすぐ向けた場合、1組 ${RUNS} 回）\n`);
const heights = [1.4, 1.2, 1.0, 0.8, 0.6];
const sizes: CanSize[] = ['small', 'medium', 'large'];
designs.slice(0, 4).forEach((d, i) => {
  console.log(`## ${d.name}\n`);
  console.log(`| 缶 | ${heights.map((h) => `${Math.round(h * 100)}cm`).join(' | ')} |`);
  console.log(`|---|${heights.map(() => '---').join('|')}|`);
  let best = { label: '', avg: -1 };
  sizes.forEach((size, si) => {
    const cells = heights.map((h, hi) => {
      const config = { ...d.config, canSize: size, canHeight: h, launchAngle: aimAngle(d.config.launchHeight, h) };
      const m = runMany(config, RUNS, 5000 + i * 100 + si * 10 + hi);
      const label = `${PHYSICS_CONSTANTS.CAN_SPECS[size].name}の缶・${Math.round(h * 100)}cm`;
      if (m.average > best.avg) best = { label, avg: m.average };
      return `${m.average.toFixed(1)}（${m.success.toFixed(0)}%）`;
    });
    console.log(`| ${PHYSICS_CONSTANTS.CAN_SPECS[size].name} | ${cells.join(' | ')} |`);
  });
  console.log(`\nいちばん平均点が高い組み合わせ: ${best.label}（${best.avg.toFixed(1)} 点）\n`);
});
