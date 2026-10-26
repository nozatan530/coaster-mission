/**
 * ステージ0: スタート画面
 * アプリの目的、コースのイメージ図、ルール、点の取り方、得点の例、予想入力
 */

import React, { useMemo, useState } from 'react';
import { Target, ArrowRight, ShieldAlert, Award, Compass, Sparkles, Lightbulb } from 'lucide-react';
import { CourseConfig, ReportState } from '../types';
import {
  LARGE_LOOP_RAIL_LENGTH,
  PHYSICS_CONSTANTS,
  SMALL_LOOP_RAIL_LENGTH,
  calculateRailUsage,
  getCanDistance,
  simulateRun,
} from '../physics';
import { CourseIllustration } from './CourseIllustration';

interface Stage0StartProps {
  reportState: ReportState;
  onUpdateReport: (updates: Partial<ReportState>) => void;
  onProceed: () => void;
}

const EXAMPLE_BASE: CourseConfig = {
  startHeight: 1.5,
  loopType: 'none',
  loop1Bottom: 1.0,
  loop2Bottom: 1.0,
  slowHeight: 1.45,
  launchHeight: 0.8,
  launchAngle: 23, // 140 cm の缶（1.40 m 先）の中心を向く角度
  canSize: 'small',
  canHeight: 1.4,
  motionType: 'rolling',
};

// 「こんな設計だと何点？」の例。点数は physics.ts で計算して表示する
const EXAMPLES: { title: string; config: CourseConfig }[] = [
  {
    title: 'ループなし。ゆっくり区間と缶で稼ぐ',
    config: { ...EXAMPLE_BASE },
  },
  {
    title: '小ループを入れて、ゆっくり区間も狙う',
    config: {
      ...EXAMPLE_BASE,
      loopType: 'small',
      loop1Bottom: 1.0,
      slowHeight: 1.4,
      launchHeight: 0.6,
      launchAngle: 30,
      canSize: 'medium',
    },
  },
  {
    title: '大と小のループ。ゆっくり区間はあきらめる',
    config: {
      ...EXAMPLE_BASE,
      loopType: 'large_small',
      loop1Bottom: 0.6,
      loop2Bottom: 0.6,
      slowHeight: 0.6,
      launchHeight: 0.6,
      launchAngle: 30,
      canSize: 'medium',
    },
  },
  {
    title: '全部入り（大＋小ループ＋ゆっくり区間＋小さい缶）',
    config: {
      ...EXAMPLE_BASE,
      loopType: 'large_small',
      loop1Bottom: 0.5,
      loop2Bottom: 0.5,
      slowHeight: 1.3,
    },
  },
];

const cm = (m: number) => `${Math.round(m * 100)} cm`;

function describeConfig(c: CourseConfig): string {
  const can = PHYSICS_CONSTANTS.CAN_SPECS[c.canSize].name;
  const loop =
    c.loopType === 'none'
      ? 'ループなし'
      : c.loopType === 'small'
        ? `小ループ（いちばん下 ${cm(c.loop1Bottom)}）`
        : c.loopType === 'large'
          ? `大ループ（いちばん下 ${cm(c.loop1Bottom)}）`
          : c.loopType === 'large_small'
            ? `大→小ループ（いちばん下 ${cm(c.loop1Bottom)}・${cm(c.loop2Bottom)}）`
            : `小→大ループ（いちばん下 ${cm(c.loop1Bottom)}・${cm(c.loop2Bottom)}）`;
  return `スタート ${cm(c.startHeight)} ／ ${loop} ／ ゆっくり区間 ${cm(c.slowHeight)} ／ 発射台 ${cm(c.launchHeight)}・${c.launchAngle}° ／ ${can}の缶を ${cm(c.canHeight)} に`;
}

const cardClass =
  'bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-xl p-5 shadow-xs';
const strong = 'text-[#1D2B53] dark:text-[#EAEFFC] font-bold';

export const Stage0Start: React.FC<Stage0StartProps> = ({
  reportState,
  onUpdateReport,
  onProceed,
}) => {
  const [expectedScore, setExpectedScore] = useState(
    reportState.initialPredictions.expectedScore
  );
  const [strategy, setStrategy] = useState(reportState.initialPredictions.strategy);
  const [errorMsg, setErrorMsg] = useState('');

  const examples = useMemo(
    () =>
      EXAMPLES.map((ex) => ({
        ...ex,
        rail: calculateRailUsage(ex.config),
        result: simulateRun(ex.config, { isIdeal: true }),
      })),
    []
  );

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedScore.trim() || !strategy.trim()) {
      setErrorMsg('予想得点と作戦の両方を入力してください（振り返りレポートで使用します）');
      return;
    }

    onUpdateReport({
      initialPredictions: {
        expectedScore: expectedScore.trim(),
        strategy: strategy.trim(),
      },
    });
    onProceed();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* ヒーローカード */}
      <div className="bg-white dark:bg-[#17223B] border border-[#D6DEF0] dark:border-[#263657] rounded-2xl p-5 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-[#5AB0F0] text-xs font-bold mb-3 border border-sky-100 dark:border-sky-900/50">
            <Compass className="w-3.5 h-3.5" />
            <span>物理基礎 · 力学的エネルギーと斜方投射</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1D2B53] dark:text-[#EAEFFC] tracking-tight leading-tight mb-3">
            ボールコースター・ミッション
          </h2>
          <p className="text-sm sm:text-base text-sub leading-relaxed max-w-2xl">
            鉄のボールを転がして、<strong className={strong}>ループ</strong>・
            <strong className={strong}>ゆっくり区間</strong>・<strong className={strong}>缶当て</strong>
            で点を取るコースを設計しよう。使えるレールは全部で <strong className={strong}>{PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(1)} m</strong>。
            スタートを高くするとボールは勢いよく走るけれど、そのぶん坂が長くなって、レールが足りなくなる。
            どこにエネルギーとレールを使うかが勝負です。
          </p>

          {/* コースのイメージ図 */}
          <figure className="mt-5">
            <div className="rounded-xl bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60 p-2 sm:p-4 overflow-x-auto">
              <CourseIllustration config={EXAMPLES[1].config} className="min-w-[440px]" />
            </div>
            <div className="sm:hidden mt-1 text-[11px] text-sub text-center">← 図は横にスクロールできます →</div>
            <figcaption className="mt-2 text-[11px] text-sub leading-relaxed">
              横から見たコースの例（小ループあり）。ボールは左のスタート台から右へ転がり、発射台から飛び出して缶をねらう。
              <span className="text-[#5AB0F0] font-bold">青い線が「坂」</span>。
              缶はボールが飛び出した瞬間に落ち始めるので、点線の枠の位置から落ちてきたところでボールと出会う。
              図は高さの違いが見やすいよう、たて方向を1.5倍にしてある。
            </figcaption>
          </figure>
        </div>

        {/* 背景装飾 */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#5AB0F0]/10 pointer-events-none blur-2xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* コースのルール */}
        <div className={cardClass}>
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-[#5AB0F0]" />
            コースのルール
          </h3>
          <ol className="space-y-3 text-xs text-sub leading-relaxed">
            <li className="flex items-start gap-2">
              <span className={strong}>1.</span>
              <span>
                部品の<strong className={strong}>順番は決まっている</strong>：スタート台 → ループ（入れなくてもよい）→
                ゆっくり区間 → 発射台 → 空中を飛んで缶へ。
                きみが決めるのは、<strong className={strong}>それぞれの部品の高さ</strong>と、
                <strong className={strong}>ループを入れるかどうか</strong>。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={strong}>2.</span>
              <span>
                使えるレールは<strong className="text-[#E63946]">全部で {PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(1)} m まで</strong>。
                1 cm でも超えると走らせられない。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={strong}>3.</span>
              <span>
                <strong className="text-[#5AB0F0]">坂</strong>は、高さのちがう部品と部品をつなぐ斜めのレール（図の青い線）。
                <strong className={strong}>どの坂も傾きは 30°</strong>で、変えられない。
                30°の坂では、<strong className={strong}>高さが 10 cm ちがうと、坂のレールが 20 cm 要る</strong>（上りでも下りでも）。
                <span className="block mt-1">
                  例：スタート 150 cm → ループのいちばん下 100 cm なら、50 cm 下がるので坂は 1.0 m。
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={strong}>4.</span>
              <span>
                部品の高さ（支柱）は <strong className={strong}>10〜150 cm</strong>。10 cm ずつ変えられる（ゆっくり区間だけ 5 cm ずつ）。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className={strong}>5.</span>
              <span>
                部品そのものもレールを使う：スタート台 {PHYSICS_CONSTANTS.START_FLAT_LENGTH.toFixed(1)} m・ゆっくり区間{' '}
                {PHYSICS_CONSTANTS.SLOW_FLAT_LENGTH.toFixed(1)} m・発射台 {PHYSICS_CONSTANTS.LAUNCH_FLAT_LENGTH.toFixed(1)} m
                （この3つは必ず使う）。ループは小 {SMALL_LOOP_RAIL_LENGTH.toFixed(2)} m・大{' '}
                {LARGE_LOOP_RAIL_LENGTH.toFixed(2)} m。
              </span>
            </li>
          </ol>
        </div>

        {/* 点の取り方 */}
        <div className={cardClass}>
          <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-[#FFC93C]" />
            点の取り方
          </h3>
          <div className="space-y-3 text-xs text-sub leading-relaxed">
            <div className="p-3 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60">
              <div className={`${strong} mb-1`}>🌀 ループを1周できたら</div>
              <div>
                大ループ <strong className="text-[#5AB0F0]">+30点</strong>／小ループ{' '}
                <strong className="text-[#5AB0F0]">+10点</strong>（両方入れて回れば +40点）
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60">
              <div className={`${strong} mb-1`}>🐢 ゆっくり区間を遅く通るほど</div>
              <div>
                区間のまん中での速さが<strong className={strong}>時速 5.0 km より遅いほど</strong>点が入る。
                時速 0.1 km 遅いごとに <strong className="text-[#FFC93C]">+1点</strong>。
              </div>
              <div className="mt-1">例：時速 4.7 km → 3点、時速 2.8 km → 22点。止まってしまったら、そこで終わり。</div>
            </div>

            <div className="p-3 rounded-lg bg-[#F4F8FF] dark:bg-[#0E1626] border border-[#D6DEF0]/60 dark:border-[#263657]/60">
              <div className={`${strong} mb-1`}>🎯 缶に当たったら</div>
              <div className="mb-2">
                <strong className={strong}>「缶の大きさの点」＋「つるす高さの点」</strong>の合計が入る。
              </div>
              <div className="grid grid-cols-2 gap-2">
                <table className="w-full text-[11px]">
                  <caption className="text-left font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-0.5">缶の大きさ</caption>
                  <tbody>
                    {(['small', 'medium', 'large'] as const).map((size) => {
                      const spec = PHYSICS_CONSTANTS.CAN_SPECS[size];
                      return (
                        <tr key={size} className="border-t border-[#D6DEF0]/60 dark:border-[#263657]/60">
                          <td className="py-0.5">
                            {spec.name}（直径{Math.round(spec.diameter * 100)} cm）
                          </td>
                          <td className="py-0.5 text-right font-bold text-[#1F9D74]">{spec.score}点</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table className="w-full text-[11px]">
                  <caption className="text-left font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-0.5">つるす高さ（床から）と距離</caption>
                  <tbody>
                    {[1.4, 1.2, 1.0, 0.8, 0.6].map((h) => (
                      <tr key={h} className="border-t border-[#D6DEF0]/60 dark:border-[#263657]/60">
                        <td className="py-0.5">{cm(h)}</td>
                        <td className="py-0.5 text-right">{getCanDistance(h).toFixed(2)} m 先</td>
                        <td className="py-0.5 text-right font-bold text-[#1F9D74]">
                          {PHYSICS_CONSTANTS.CAN_HEIGHT_SCORES[h]}点
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                例：中の缶を 120 cm につるして当てたら 20＋40＝<strong className={strong}>60点</strong>。
                いちばん高いのは、小さい缶を 140 cm につるして当てたときの 30＋50＝<strong className={strong}>80点</strong>。
              </div>
              <div className="mt-1">
                缶は、<strong className={strong}>高くつるすほど発射台から遠くに置く</strong>（60 cm は 0.80 m 先 … 140 cm は 1.40 m 先）。遠いほど、左右に外れやすい。
                そして缶は、<strong className={strong}>ボールが発射台を離れた瞬間に落ち始める</strong>。
              </div>
            </div>

            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>ループで落ちる・止まる・坂を戻ったときは、そこまでの点で終わり。</li>
              <li>
                本番の記録は<strong className={strong}>「10回連続」の平均点</strong>。毎回少しずつ結果がばらつくので、ぎりぎりの設計は失敗しやすい。
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* こんな設計だと何点？ */}
      <div className={cardClass}>
        <h3 className="text-sm font-bold text-[#1D2B53] dark:text-[#EAEFFC] flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-[#FFC93C]" />
          こんな設計だと何点？
        </h3>
        <p className="text-[11px] text-sub mb-3">
          ばらつきのない「理想の1回」で走らせたときの点。本番の10回連続では、ここから下がることが多い。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {examples.map((ex) => (
            <div
              key={ex.title}
              className="p-3 rounded-lg border border-[#D6DEF0]/80 dark:border-[#263657] bg-[#F4F8FF]/60 dark:bg-[#0E1626]/60 flex flex-col"
            >
              <div className={`text-xs ${strong} mb-1`}>{ex.title}</div>
              <CourseIllustration config={ex.config} showLabels={false} className="my-1" />
              <div className="text-[11px] text-sub leading-relaxed">{describeConfig(ex.config)}</div>
              <div className="mt-2 pt-2 border-t border-[#D6DEF0]/60 dark:border-[#263657]/60 text-[11px] text-sub">
                <div>
                  使うレール <strong className={strong}>{ex.rail.total.toFixed(1)} m</strong>
                </div>
                {ex.rail.isExceeded ? (
                  <div className="mt-1 font-bold text-[#E63946]">
                    {PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(1)} m を {ex.rail.excess.toFixed(1)} m 超えるので、走らせられない
                  </div>
                ) : (
                  <div className="mt-1">
                    ループ {ex.result.loopPoints} ＋ ゆっくり {ex.result.slowSpeedPoints} ＋ 缶 {ex.result.canPoints} ＝{' '}
                    <strong className="text-sm text-[#1D2B53] dark:text-[#EAEFFC]">{ex.result.totalScore}点</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ミッション全体の流れ */}
      <div className={cardClass}>
        <h3 className="text-xs font-bold text-sub uppercase tracking-wider mb-3">これからの流れ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#5AB0F0] mb-1">STEP 1：3つの練習</div>
            <p className="text-sub text-[11px]">
              レールの制限なしで、ループ・ゆっくり区間・缶当てを1つずつ試す。どうすればうまくいくかを、エネルギーの言葉で考える。
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#FFC93C] mb-1">STEP 2：本番の設計と試走</div>
            <p className="text-sub text-[11px]">
              {PHYSICS_CONSTANTS.MAX_RAIL_LENGTH.toFixed(1)} m のレールでコースを設計して走らせる。直したら走らせ直す。記録は「10回連続」の平均点。
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="font-bold text-[#1F9D74] mb-1">STEP 3：レポート提出</div>
            <p className="text-sub text-[11px]">
              試した記録と、問いへの答えを1枚にまとめる。印刷・PDF・テキストのコピーで提出する。
            </p>
          </div>
        </div>
      </div>

      {/* 予想入力フォーム (必須) */}
      <form onSubmit={handleStart} className="bg-white dark:bg-[#17223B] border-2 border-[#5AB0F0] dark:border-[#4D9DE0] rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-[#1D2B53] dark:text-[#EAEFFC]">
          <Sparkles className="w-5 h-5 text-[#5AB0F0]" />
          <span>始める前に予想しよう（必須）</span>
        </div>

        <p className="text-xs text-sub">
          設計を始める前に、いまの考えを書いておこう。最後のレポートで、結果と比べるのに使う。両方書くと練習ステージへ進める。
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-1">
              <Target className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-[#5AB0F0]" />
              Q1. 何点くらい取れそう？ <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="例: 100点くらい。90点は確実に取りたい"
              value={expectedScore}
              onChange={(e) => {
                setExpectedScore(e.target.value);
                setErrorMsg('');
              }}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1D2B53] dark:text-[#EAEFFC] mb-1">
              Q2. どこで点を取るつもり？（ループ？ ゆっくり区間？ 缶当て？） <span className="text-[#E63946]">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="例: レールを節約して大ループを回り、高い缶に確実に当てたい"
              value={strategy}
              onChange={(e) => {
                setStrategy(e.target.value);
                setErrorMsg('');
              }}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-[#F4F8FF] dark:bg-[#0E1626] text-[#1D2B53] dark:text-[#EAEFFC] focus:outline-hidden focus:ring-2 focus:ring-[#5AB0F0]"
            />
          </div>

          <p className="text-[11px] text-sub">
            ※名前や連絡先などの個人情報は書かないでね。データはこのブラウザ内にのみ保存されます。
          </p>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs font-bold text-[#E63946]">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1D2B53] hover:bg-[#15203e] dark:bg-[#5AB0F0] dark:hover:bg-[#4a9de0] text-white dark:text-[#0E1626] font-bold text-sm shadow-md transition-all transform active:scale-98"
            >
              <span>予想を決めて練習ステージへ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
