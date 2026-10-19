/**
 * Type definitions for ボールコースター・ミッション (Ball Coaster Mission)
 */

export type LoopType = 'none' | 'small' | 'large' | 'small_large' | 'large_small';

export type CanSize = 'small' | 'medium' | 'large';

export type MotionType = 'rolling' | 'sliding'; // 転がる球 (0.7mv^2) vs すべる物体 (0.5mv^2)

// 練習ステージで走らせる部品（その部品だけのコースにする）
export type PracticeFocus = 'loop' | 'slow' | 'launch';

export interface CourseConfig {
  startHeight: number; // 0.10 ~ 1.50m (10cm刻み)
  loopType: LoopType;
  loop1Bottom: number; // 0.10 ~ 1.50m
  loop2Bottom: number; // 0.10 ~ 1.50m (2つ目のループ用)
  slowHeight: number; // 0.10 ~ 1.50m (5cm刻み)
  launchHeight: number; // 0.10 ~ 1.50m (10cm刻み)
  launchAngle: number; // 0 ~ 60度 (1度刻み)
  canSize: CanSize;
  canHeight: number; // 0.60, 0.80, 1.00, 1.20, 1.40m
  motionType: MotionType;
}

export interface RailBreakdown {
  startFlat: number; // 0.30
  startToFirst: number; // 2 * |h1 - h0|
  loop1Rail: number;
  betweenLoops: number;
  loop2Rail: number;
  toSlow: number;
  slowFlat: number; // 0.50
  slowToLaunch: number;
  launchFlat: number; // 0.30
  total: number;
  remaining: number;
  isExceeded: boolean;
  excess: number;
}

export type FailReasonType =
  | 'loop_fall' // ループ頂上で速さ不足
  | 'slow_stop' // ゆっくり区間で停止
  | 'slope_rollback' // 坂を戻った
  | 'miss_over' // 缶の上を通過
  | 'miss_under' // 缶の下を通過
  | 'miss_lateral' // 左右に外れた
  | 'can_hit_floor'; // 缶が床に落ちた

export interface TrajectoryPoint {
  x: number;
  y: number;
  time: number;
  v: number;
  K: number;
  U: number;
  T: number;
  section: string;
}

export interface SimulationResult {
  isIdeal: boolean;
  success: boolean;
  failReason?: FailReasonType;
  failDescription?: string;
  failedAt?: string;
  stoppedAtX?: number;
  stoppedAtY?: number;

  // Scores
  loopPoints: number;
  smallLoopPassed: boolean;
  largeLoopPassed: boolean;
  slowSpeedKmh?: number;
  slowSpeedPoints: number;
  canPoints: number;
  canHitSuccess: boolean;
  totalScore: number;

  // Speeds & energies along the course
  speeds: {
    start: number;
    loop1Bottom?: number;
    loop1Top?: number;
    loop1TopCrit?: number;
    loop2Bottom?: number;
    loop2Top?: number;
    loop2TopCrit?: number;
    slowMidKmh?: number;
    launchTip: number;
  };

  projectileData?: {
    tHit: number;
    ballYAtHit: number;
    canYAtHit: number;
    deltaY: number;
    toleranceY: number;
    lateralDelta: number;
    toleranceLateral: number;
    canFloorY: number;
    aimYAtTarget: number;
    isHit: boolean;
    points: number;
  };

  trajectory: TrajectoryPoint[];
  canTrajectory: { time: number; y: number }[];
  totalTime: number;
  tLaunch: number;
}

export interface BatchTrialResult {
  trials: SimulationResult[];
  averageScore: number;
  idealScore: number;
  successRate: number; // 0 - 100
  failBreakdown: Record<FailReasonType, number>;
}

export interface TrialHistoryEntry {
  id: string;
  timestamp: number;
  trialNumber: number;
  configSummary: string;
  config: CourseConfig;
  idealScore: number;
  averageScore: number;
  successRate: number;
  notes: string;
}

export interface Practice1State {
  startHeight: number;
  loopSize: 'small' | 'large';
  loopBottom: number;
  answer: string;
  hintsOpened: [boolean, boolean, boolean];
}

export interface Practice2State {
  startHeight: number;
  slowHeight: number;
  answer: string;
  hintsOpened: [boolean, boolean, boolean];
}

export interface Practice3State {
  launchHeight: number;
  launchSpeed: number; // 発射台を飛び出す速さ (m/s)。練習ではこれを直接決める
  launchAngle: number;
  canHeight: number;
  showSightLine: boolean;
  answer: string;
  hintsOpened: [boolean, boolean, boolean];
}

export interface ReportState {
  initialPredictions: {
    expectedScore: string;
    strategy: string;
  };
  reflection: {
    q1: string; // エネルギーとレールの配分
    q2: string; // 照準とモンキーハンティングの理由
    q3: string; // 理想と平均の差とばらつき対策
  };
}
