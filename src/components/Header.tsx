/**
 * ヘッダー & ナビゲーションバー
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  PlayCircle,
  FileText,
  RotateCcw,
  Sun,
  Moon,
  ListOrdered,
  BookOpen,
  Lock,
} from 'lucide-react';

export type StageId = 'start' | 'practice' | 'design' | 'history' | 'report';

interface HeaderProps {
  currentStage: StageId;
  onSelectStage: (stage: StageId) => void;
  onResetAll: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  canProceedToPractice: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentStage,
  onSelectStage,
  onResetAll,
  isDarkMode,
  onToggleTheme,
  canProceedToPractice,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);

  // 見出しの高さを CSS 変数 --header-h に入れる（画面に貼り付ける部品が、見出しの下に並ぶように）
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () =>
      document.documentElement.style.setProperty('--header-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // 鍵のかかったタブを押したときに、理由を少しのあいだ見せる
  const [showLockedNotice, setShowLockedNotice] = useState(false);
  const lockedTimerRef = useRef<number | null>(null);
  const handleLockedClick = () => {
    setShowLockedNotice(true);
    if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
    lockedTimerRef.current = window.setTimeout(() => setShowLockedNotice(false), 4000);
  };

  const stages: { id: StageId; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'start', label: '1. スタート', icon: <Compass className="w-4 h-4" /> },
    {
      id: 'practice',
      label: '2. 練習ステージ',
      icon: <BookOpen className="w-4 h-4" />,
      disabled: !canProceedToPractice,
    },
    {
      id: 'design',
      label: '3. 本番設計・試走',
      icon: <PlayCircle className="w-4 h-4" />,
      disabled: !canProceedToPractice,
    },
    {
      id: 'history',
      label: '4. 記録表',
      icon: <ListOrdered className="w-4 h-4" />,
      disabled: !canProceedToPractice,
    },
    {
      id: 'report',
      label: '5. レポート提出',
      icon: <FileText className="w-4 h-4" />,
      disabled: !canProceedToPractice,
    },
  ];

  return (
    <>
      <header ref={headerRef} className="no-print sticky top-0 z-40 bg-white/95 dark:bg-[#17223B]/95 backdrop-blur-md border-b border-[#D6DEF0] dark:border-[#263657] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* ロゴ & タイトル */}
          <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1D2B53] dark:text-[#EAEFFC]">
            ボールコースター・ミッション
          </h1>

          {/* 右側アクション */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* テーマ切替 */}
            <button
              onClick={onToggleTheme}
              aria-label="テーマ切替"
              className="p-2 text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-[#FFC93C]" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* リセットボタン */}
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1 text-xs text-sub hover:text-[#E63946] px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200"
              title="最初からやり直す（記録を消す）"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">リセット</span>
            </button>
          </div>
        </div>

        {/* ステージ ナビゲーションバー */}
        <div className="max-w-6xl mx-auto px-2 overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1 py-1 px-2 border-t border-slate-100 dark:border-slate-800">
            {stages.map((stage) => {
              const isActive = currentStage === stage.id;
              return (
                <button
                  key={stage.id}
                  aria-disabled={stage.disabled}
                  title={stage.disabled ? 'スタート画面で予想を書くと進めます' : undefined}
                  onClick={() => (stage.disabled ? handleLockedClick() : onSelectStage(stage.id))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#1D2B53] text-white dark:bg-[#4D9DE0] dark:text-[#0E1626] shadow-xs'
                      : stage.disabled
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'text-sub hover:text-[#1D2B53] dark:hover:text-[#EAEFFC] hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {stage.disabled ? <Lock className="w-3.5 h-3.5" /> : stage.icon}
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {showLockedNotice && canProceedToPractice === false && (
          <div role="status" className="max-w-6xl mx-auto px-4 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-[#B45309] dark:text-[#FFC93C]">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>先に「1. スタート」の下で、予想（Q1・Q2）を書こう。書くと練習ステージから先に進めます。</span>
            </div>
          </div>
        )}
      </header>

      {/* リセット確認モーダル */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-2 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#E63946]" />
              最初からやり直しますか？
            </h3>
            <p className="text-xs text-sub leading-relaxed mb-4">
              これまでに設計したコース、試走ログ、練習ステージの解答、レポートの記述がすべて初期化されます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-sub hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  onResetAll();
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-[#E63946] text-white hover:bg-red-600 rounded-lg shadow-sm transition-colors"
              >
                初期化して再スタート
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
