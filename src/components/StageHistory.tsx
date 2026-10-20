/**
 * 試走の記録表 (Trial History Log)
 * 試行錯誤のプロセスを蓄積・閲覧・編集・再読み込み
 */

import React from 'react';
import { TrialHistoryEntry, CourseConfig } from '../types';
import { ListOrdered, Edit3, Trash2, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';

interface StageHistoryProps {
  historyEntries: TrialHistoryEntry[];
  onUpdateNote: (id: string, notes: string) => void;
  onDeleteEntry: (id: string) => void;
  onLoadConfig: (config: CourseConfig) => void;
}

// 成功率の色分け（80%以上・50%以上・それ未満）
const successRateClass = (rate: number) =>
  rate >= 80
    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#1F9D74]'
    : rate >= 50
    ? 'bg-amber-50 dark:bg-amber-950/40 text-[#D97706]'
    : 'bg-rose-50 dark:bg-rose-950/40 text-[#E63946]';

export const StageHistory: React.FC<StageHistoryProps> = ({
  historyEntries,
  onUpdateNote,
  onDeleteEntry,
  onLoadConfig,
}) => {
  // 公式記録なので、押し間違いで消えないように確かめる
  const confirmDelete = (entry: TrialHistoryEntry) => {
    if (
      window.confirm(
        `#${entry.trialNumber} の記録を消しますか？\n10回連続の結果と「何を変えたか・なぜか」が消え、元に戻せません。`
      )
    ) {
      onDeleteEntry(entry.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-[#5AB0F0]" />
              試走の記録表（改善のログ）
            </h3>
            <p className="text-xs text-sub mt-1">
              本番10回試走を行うたびに自動で1行追加されます。何を変えてどう結果が変わったかを振り返りましょう。
            </p>
          </div>

          <div className="text-xs font-mono font-bold text-sub bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            合計記録: {historyEntries.length} 件
          </div>
        </div>

        {historyEntries.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-sub">まだ記録がありません</p>
            <p className="text-[11px] text-sub">
              「3. 本番設計・試走」で「10回連続で本番試走！」ボタンを押すと、ここに結果と考察が記録されます。
            </p>
          </div>
        ) : (
          <>
          {/* スマホ・タブレット（1024px 未満）：1回分を1枚のカードにし、平均点と成功率を上に大きく出す */}
          <ul className="lg:hidden space-y-3">
            {historyEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-[#D6DEF0] dark:border-[#263657] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold font-mono text-[#5AB0F0]">#{entry.trialNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-sub">平均点</span>
                    <span className="font-mono font-extrabold text-[#1F9D74] text-lg">{entry.averageScore}点</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${successRateClass(entry.successRate)}`}>
                      成功率 {entry.successRate}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sub">
                  <span>予想：{entry.predictedScore ?? '—'}</span>
                  <span>理想の点：{entry.idealScore}点</span>
                </div>
                <div className="font-mono text-[11px] text-[#1D2B53] dark:text-[#EAEFFC] leading-relaxed">
                  {entry.configSummary}
                </div>
                <label className="block">
                  <span className="text-[11px] font-bold text-sub">何を変えたか・なぜか</span>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => onUpdateNote(entry.id, e.target.value)}
                    placeholder="何を変えたか・なぜかを記入..."
                    className="mt-0.5 w-full px-2 py-1.5 text-xs rounded border border-[#D6DEF0] dark:border-[#263657] focus:border-[#5AB0F0] bg-white dark:bg-[#0E1626]"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onLoadConfig(entry.config)}
                    aria-label={`#${entry.trialNumber} の設計を設計画面に戻す`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#5AB0F0] border border-[#5AB0F0]/50 hover:bg-sky-50 dark:hover:bg-sky-950/50"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>この設計に戻す</span>
                  </button>
                  <button
                    onClick={() => confirmDelete(entry)}
                    aria-label={`#${entry.trialNumber} の記録を削除`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-sub border border-[#D6DEF0] dark:border-[#263657] hover:text-[#E63946]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>削除</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* PC（1024px 以上）：表で並べる */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D6DEF0] dark:border-[#263657] text-sub bg-slate-50/60 dark:bg-slate-900/40">
                  <th className="py-2.5 px-3 font-bold w-12 text-center">回</th>
                  <th className="py-2.5 px-3 font-bold min-w-[220px]">コース設計の要点</th>
                  <th className="py-2.5 px-3 font-bold w-24 text-center">予想</th>
                  <th className="py-2.5 px-3 font-bold w-20 text-center">理想得点</th>
                  <th className="py-2.5 px-3 font-bold w-24 text-center">平均点</th>
                  <th className="py-2.5 px-3 font-bold w-20 text-center">成功率</th>
                  <th className="py-2.5 px-3 font-bold min-w-[220px]">何を変えたか・なぜか</th>
                  <th className="py-2.5 px-3 font-bold w-24 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEF0]/60 dark:divide-[#263657]/60">
                {historyEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <td className="py-3 px-3 text-center font-bold font-mono text-[#5AB0F0]">
                      #{entry.trialNumber}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-[#1D2B53] dark:text-[#EAEFFC]">
                      {entry.configSummary}
                    </td>

                    <td className="py-3 px-3 text-center text-[11px] text-sub">
                      {entry.predictedScore ?? '—'}
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold text-sub">
                      {entry.idealScore}点
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-extrabold text-[#1F9D74] text-sm">
                      {entry.averageScore}点
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${successRateClass(entry.successRate)}`}>
                        {entry.successRate}%
                      </span>
                    </td>

                    {/* メモ編集 */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => onUpdateNote(entry.id, e.target.value)}
                        placeholder="何を変えたか・なぜかを記入..."
                        className="w-full px-2 py-1 text-xs rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-[#5AB0F0] bg-transparent focus:bg-white dark:focus:bg-[#0E1626] transition-colors"
                      />
                    </td>

                    {/* 操作ボタン */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onLoadConfig(entry.config)}
                          title="この設計を設計画面に復元"
                          aria-label={`#${entry.trialNumber} の設計を設計画面に戻す`}
                          className="p-1 text-[#5AB0F0] hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded transition-colors"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(entry)}
                          title="削除"
                          aria-label={`#${entry.trialNumber} の記録を削除`}
                          className="p-1 text-sub hover:text-[#E63946] hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
