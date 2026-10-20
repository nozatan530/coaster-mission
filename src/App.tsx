/**
 * ボールコースター・ミッション (Ball Coaster Mission)
 * メインアプリケーションコンポーネント
 */

import React, { useState, useEffect } from 'react';
import { Header, StageId } from './components/Header';
import { Stage0Start } from './components/Stage0Start';
import { StagePractice } from './components/StagePractice';
import { StageDesign } from './components/StageDesign';
import { StageHistory } from './components/StageHistory';
import { StageReport } from './components/StageReport';
import {
  CourseConfig,
  Practice1State,
  Practice2State,
  Practice3State,
  ReportState,
  TrialHistoryEntry,
} from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_PRACTICE1,
  DEFAULT_PRACTICE2,
  DEFAULT_PRACTICE3,
  DEFAULT_REPORT,
  safeGetStorage,
  safeSetStorage,
  clearAllStorage,
  STORAGE_KEYS,
  isStorageAvailable,
} from './storage';

export default function App() {
  // 記録を保存できない端末では、閉じると消えることを知らせる
  const [storageAvailable] = useState(() => isStorageAvailable());

  // --- テーマ設定 (ダーク / ライト) ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = safeGetStorage<string>(STORAGE_KEYS.THEME, '');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      safeSetStorage(STORAGE_KEYS.THEME, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeSetStorage(STORAGE_KEYS.THEME, 'light');
    }
  }, [isDarkMode]);

  // --- アプリケーション状態 ---
  const [currentStage, setCurrentStage] = useState<StageId>(() =>
    safeGetStorage<StageId>(STORAGE_KEYS.STAGE, 'start')
  );

  const [config, setConfig] = useState<CourseConfig>(() =>
    safeGetStorage<CourseConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG)
  );

  const [reportState, setReportState] = useState<ReportState>(() =>
    safeGetStorage<ReportState>(STORAGE_KEYS.REPORT, DEFAULT_REPORT)
  );

  const [p1State, setP1State] = useState<Practice1State>(() =>
    safeGetStorage<Practice1State>(STORAGE_KEYS.PRACTICE1, DEFAULT_PRACTICE1)
  );

  const [p2State, setP2State] = useState<Practice2State>(() =>
    safeGetStorage<Practice2State>(STORAGE_KEYS.PRACTICE2, DEFAULT_PRACTICE2)
  );

  const [p3State, setP3State] = useState<Practice3State>(() =>
    safeGetStorage<Practice3State>(STORAGE_KEYS.PRACTICE3, DEFAULT_PRACTICE3)
  );

  const [historyEntries, setHistoryEntries] = useState<TrialHistoryEntry[]>(() =>
    safeGetStorage<TrialHistoryEntry[]>(STORAGE_KEYS.HISTORY, [])
  );

  // 永続化同期
  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.STAGE, currentStage);
    // 画面を切り替えたら、新しい画面の一番上から見せる
    window.scrollTo({ top: 0 });
  }, [currentStage]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.CONFIG, config);
  }, [config]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.REPORT, reportState);
  }, [reportState]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.PRACTICE1, p1State);
  }, [p1State]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.PRACTICE2, p2State);
  }, [p2State]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.PRACTICE3, p3State);
  }, [p3State]);

  useEffect(() => {
    safeSetStorage(STORAGE_KEYS.HISTORY, historyEntries);
  }, [historyEntries]);

  // 初期予想が入力されているか判定
  const canProceedToPractice =
    Boolean(reportState.initialPredictions.expectedScore.trim()) &&
    Boolean(reportState.initialPredictions.strategy.trim());

  // リセット
  const handleResetAll = () => {
    clearAllStorage();
    setConfig(DEFAULT_CONFIG);
    setReportState(DEFAULT_REPORT);
    setP1State(DEFAULT_PRACTICE1);
    setP2State(DEFAULT_PRACTICE2);
    setP3State(DEFAULT_PRACTICE3);
    setHistoryEntries([]);
    setCurrentStage('start');
  };

  // 試走ログ追加
  const handleAddHistory = (
    entry: Omit<TrialHistoryEntry, 'id' | 'timestamp' | 'trialNumber'>
  ) => {
    const newEntry: TrialHistoryEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      trialNumber: historyEntries.length + 1,
    };
    setHistoryEntries((prev) => [newEntry, ...prev]);
  };

  // 試走メモ更新
  const handleUpdateNote = (id: string, notes: string) => {
    setHistoryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, notes } : e))
    );
  };

  // 試走ログ削除
  const handleDeleteEntry = (id: string) => {
    setHistoryEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // ログから設計を復元
  // 設計の更新はここを通す。スタートを下げたとき、ループの最下点がスタートより高いまま残らないようにする
  const handleUpdateConfig = (next: CourseConfig) => {
    const maxBottom = Math.max(0.1, Math.round((next.startHeight - 0.1) * 100) / 100);
    setConfig({
      ...next,
      loop1Bottom: Math.min(next.loop1Bottom, maxBottom),
      loop2Bottom: Math.min(next.loop2Bottom, maxBottom),
    });
  };

  const handleLoadConfig = (savedConfig: CourseConfig) => {
    setConfig({ ...savedConfig });
    setCurrentStage('design');
  };

  return (
    <div className="min-h-screen flex flex-col bg-theme text-ink">
      <Header
        currentStage={currentStage}
        onSelectStage={setCurrentStage}
        onResetAll={handleResetAll}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
        canProceedToPractice={canProceedToPractice}
      />

      {!storageAvailable && (
        <div role="alert" className="no-print bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/40">
          <p className="max-w-6xl mx-auto px-4 py-2 text-xs font-bold text-[#B45309] dark:text-[#FFC93C]">
            この端末（ブラウザ）では記録を保存できません。ページを閉じたり読み込み直したりすると、入力や試走の記録が消えます。
            続けて使う場合は、最後にレポートを印刷・コピーしてから閉じてね。
          </p>
        </div>
      )}

      <main className="flex-1 pb-16">
        {currentStage === 'start' && (
          <Stage0Start
            reportState={reportState}
            onUpdateReport={(u) => setReportState((prev) => ({ ...prev, ...u }))}
            onProceed={() => setCurrentStage('practice')}
          />
        )}

        {currentStage === 'practice' && (
          <StagePractice
            p1State={p1State}
            p2State={p2State}
            p3State={p3State}
            onUpdateP1={(u) => setP1State((prev) => ({ ...prev, ...u }))}
            onUpdateP2={(u) => setP2State((prev) => ({ ...prev, ...u }))}
            onUpdateP3={(u) => setP3State((prev) => ({ ...prev, ...u }))}
            onProceedToDesign={() => setCurrentStage('design')}
          />
        )}

        {currentStage === 'design' && (
          <StageDesign
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onAddHistory={handleAddHistory}
            historyEntries={historyEntries}
          />
        )}

        {currentStage === 'history' && (
          <StageHistory
            historyEntries={historyEntries}
            onUpdateNote={handleUpdateNote}
            onDeleteEntry={handleDeleteEntry}
            onLoadConfig={handleLoadConfig}
          />
        )}

        {currentStage === 'report' && (
          <StageReport
            config={config}
            reportState={reportState}
            p1State={p1State}
            p2State={p2State}
            p3State={p3State}
            historyEntries={historyEntries}
            onUpdateReport={(u) => setReportState((prev) => ({ ...prev, ...u }))}
            onUpdateP1={(u) => setP1State((prev) => ({ ...prev, ...u }))}
            onUpdateP2={(u) => setP2State((prev) => ({ ...prev, ...u }))}
            onUpdateP3={(u) => setP3State((prev) => ({ ...prev, ...u }))}
            onUpdateNote={handleUpdateNote}
          />
        )}
      </main>

      <footer className="no-print border-t border-theme py-4 text-center text-xs text-sub bg-card-theme/60">
        <p className="max-w-4xl mx-auto px-4">
          ボールコースター・ミッション · 高校「物理基礎」エネルギー保存と斜方投射シミュレーション
        </p>
      </footer>
    </div>
  );
}
