/**
 * コースコード：設計を短い文字列にして、レポートや QR コードから同じコースを再現する
 *
 * 形式（大文字・小文字は区別しない。区切りは「-」）
 *   S150-B70-M70-Y130-H80-A10-CS100
 *   S … スタート台の高さ (cm)
 *   B … 大ループの最下点 (cm)   M … 小ループの最下点 (cm)   書いた順にループが並ぶ。なければ書かない
 *   Y … ゆっくり区間の高さ (cm)
 *   H … 発射台の高さ (cm)       A … 発射角度 (°)
 *   C … 缶の大きさ (S 小 / M 中 / L 大) と、つるす高さ (cm)
 *   X … 「すべる物体」で計算するとき（ふだんは書かない）
 */

import qrcode from 'qrcode-generator';
import { CanSize, CourseConfig, LoopType } from './types';
import { DEFAULT_CONFIG } from './storage';

export const COURSE_PARAM = 'course';

const CAN_LETTER: Record<CanSize, string> = { small: 'S', medium: 'M', large: 'L' };
const CAN_HEIGHTS = [60, 80, 100, 120, 140];

const cm = (m: number) => Math.round(m * 100);

export function encodeCourse(config: CourseConfig): string {
  const parts = [`S${cm(config.startHeight)}`];
  const loopTokens: Record<LoopType, string[]> = {
    none: [],
    small: [`M${cm(config.loop1Bottom)}`],
    large: [`B${cm(config.loop1Bottom)}`],
    small_large: [`M${cm(config.loop1Bottom)}`, `B${cm(config.loop2Bottom)}`],
    large_small: [`B${cm(config.loop1Bottom)}`, `M${cm(config.loop2Bottom)}`],
  };
  parts.push(...loopTokens[config.loopType]);
  parts.push(
    `Y${cm(config.slowHeight)}`,
    `H${cm(config.launchHeight)}`,
    `A${config.launchAngle}`,
    `C${CAN_LETTER[config.canSize]}${cm(config.canHeight)}`
  );
  if (config.motionType === 'sliding') parts.push('X');
  return parts.join('-');
}

export type DecodeResult = { ok: true; config: CourseConfig } | { ok: false; error: string };

// 高さ (cm) を、範囲と刻みに合っているか確かめて m にする
function heightFrom(value: number, label: string, step: number, max = 150): number | string {
  if (!Number.isInteger(value) || value < 10 || value > max || value % step !== 0) {
    return `${label}は 10〜${max} cm の ${step} cm 刻みで書いてね（いまは ${value}）`;
  }
  return value / 100;
}

export function decodeCourse(raw: string): DecodeResult {
  const tokens = raw
    .trim()
    .toUpperCase()
    .replace(/[－ー―‐]/g, '-')
    .replace(/[Ａ-Ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .split(/[-\s]+/)
    .filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: 'コースコードが空です' };

  const config: CourseConfig = { ...DEFAULT_CONFIG, motionType: 'rolling' };
  const loops: { kind: 'B' | 'M'; bottom: number }[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token === 'X') {
      config.motionType = 'sliding';
      continue;
    }
    const m = token.match(/^([SBMYHAC])([SML]?)(\d+)$/);
    if (!m) return { ok: false, error: `「${token}」が読めません` };
    const [, key, sub, digits] = m;
    const value = Number(digits);
    if (sub && key !== 'C') return { ok: false, error: `「${token}」が読めません` };
    if (key !== 'B' && key !== 'M') {
      if (seen.has(key)) return { ok: false, error: `「${key}」が2回あります` };
      seen.add(key);
    }

    let h: number | string;
    switch (key) {
      case 'S':
        h = heightFrom(value, 'スタート台', 10);
        if (typeof h === 'string') return { ok: false, error: h };
        config.startHeight = h;
        break;
      case 'B':
      case 'M':
        h = heightFrom(value, key === 'B' ? '大ループの最下点' : '小ループの最下点', 10, 140);
        if (typeof h === 'string') return { ok: false, error: h };
        if (loops.some((l) => l.kind === key)) {
          return { ok: false, error: `${key === 'B' ? '大' : '小'}ループは1つまでです` };
        }
        loops.push({ kind: key, bottom: h });
        break;
      case 'Y':
        h = heightFrom(value, 'ゆっくり区間', 5);
        if (typeof h === 'string') return { ok: false, error: h };
        config.slowHeight = h;
        break;
      case 'H':
        h = heightFrom(value, '発射台', 10);
        if (typeof h === 'string') return { ok: false, error: h };
        config.launchHeight = h;
        break;
      case 'A':
        if (value > 60) return { ok: false, error: `発射角度は 0〜60° で書いてね（いまは ${value}）` };
        config.launchAngle = value;
        break;
      case 'C': {
        const size = (Object.keys(CAN_LETTER) as CanSize[]).find((k) => CAN_LETTER[k] === sub);
        if (!size) return { ok: false, error: `缶の大きさは S・M・L のどれかで書いてね（「${token}」）` };
        if (!CAN_HEIGHTS.includes(value)) {
          return { ok: false, error: `缶の高さは 60・80・100・120・140 cm のどれかです（いまは ${value}）` };
        }
        config.canSize = size;
        config.canHeight = value / 100;
        break;
      }
    }
  }

  for (const key of ['S', 'Y', 'H', 'A', 'C']) {
    if (!seen.has(key)) return { ok: false, error: `「${key}」がありません` };
  }

  if (loops.some((l) => l.bottom >= config.startHeight)) {
    return { ok: false, error: 'ループの最下点は、スタート台より低くしてね' };
  }
  const order = loops.map((l) => l.kind).join('');
  config.loopType = ({ '': 'none', M: 'small', B: 'large', MB: 'small_large', BM: 'large_small' } as Record<string, LoopType>)[order];
  if (loops[0]) config.loop1Bottom = loops[0].bottom;
  if (loops[1]) config.loop2Bottom = loops[1].bottom;

  return { ok: true, config };
}

// このアプリを開いて、コースを読み込むリンク
export function courseUrl(config: CourseConfig): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?${COURSE_PARAM}=${encodeCourse(config)}`;
}

// QR コードのマス目（true が黒）
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
