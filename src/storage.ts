/**
 * LocalStorage 安全管理 & デフォルト状態
 */

import {
  CourseConfig,
  Practice1State,
  Practice2State,
  Practice3State,
  ReportState,
  TrialHistoryEntry,
} from './types';

const STORAGE_KEYS = {
  STAGE: 'ball_coaster_stage',
  PRACTICE_TAB: 'ball_coaster_practice_tab',
  CONFIG: 'ball_coaster_config',
  PRACTICE1: 'ball_coaster_p1',
  PRACTICE2: 'ball_coaster_p2',
  PRACTICE3: 'ball_coaster_p3',
  HISTORY: 'ball_coaster_history',
  REPORT: 'ball_coaster_report',
  THEME: 'ball_coaster_theme',
};

// デフォルトコース設定
export const DEFAULT_CONFIG: CourseConfig = {
  startHeight: 1.50, // 150 cm
  loopType: 'none',
  loop1Bottom: 1.00, // 100 cm
  loop2Bottom: 0.50, // 50 cm
  slowHeight: 1.45, // 145 cm
  launchHeight: 0.80, // 80 cm
  launchAngle: 31, // 31度
  canSize: 'small',
  canHeight: 1.40, // 140 cm
  motionType: 'rolling',
};

export const DEFAULT_PRACTICE1: Practice1State = {
  startHeight: 1.20,
  loopSize: 'small',
  loopBottom: 0.40,
  answer: '',
  hintsOpened: [false, false, false],
};

export const DEFAULT_PRACTICE2: Practice2State = {
  startHeight: 1.30,
  slowHeight: 1.15,
  answer: '',
  hintsOpened: [false, false, false],
};

export const DEFAULT_PRACTICE3: Practice3State = {
  launchHeight: 0.80,
  launchSpeed: 2.9,
  // 初めは缶へまっすぐ向けない角度にしておく（31°で缶の中心を向く）
  launchAngle: 20,
  canHeight: 1.40,
  showSightLine: false,
  answer: '',
  hintsOpened: [false, false, false],
};

export const DEFAULT_REPORT: ReportState = {
  initialPredictions: {
    expectedScore: '',
    strategy: '',
  },
  reflection: {
    q1: '',
    q2: '',
    q3: '',
  },
};

export function safeGetStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to read from localStorage: ${key}`, err);
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write to localStorage: ${key}`, err);
  }
}

export function clearAllStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear localStorage', err);
  }
}

export { STORAGE_KEYS };
