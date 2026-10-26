/**
 * コースコードと QR コード。レポートと本番設計の画面で使う
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { CourseConfig } from '../types';
import { courseUrl, decodeCourse, encodeCourse, qrMatrix } from '../courseCode';

export function QrCode({ text, size = 120 }: { text: string; size?: number }) {
  const matrix = useMemo(() => qrMatrix(text), [text]);
  const n = matrix.length;
  const margin = 2;
  const cells: React.ReactNode[] = [];
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) cells.push(<rect key={`${r}-${c}`} x={c + margin} y={r + margin} width={1} height={1} />);
    })
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n + margin * 2} ${n + margin * 2}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="このコースを開く QR コード"
      className="bg-white rounded-md shrink-0"
    >
      <g fill="#000">{cells}</g>
    </svg>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('コピーしてください', text);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#D6DEF0] dark:border-[#263657] text-[11px] font-bold text-sub hover:text-[#5AB0F0]"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#1F9D74]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'コピーしました' : label}
    </button>
  );
}

// レポート用：コースコード＋QR コード
export function CourseCodeCard({ config }: { config: CourseConfig }) {
  const code = encodeCourse(config);
  const url = courseUrl(config);
  return (
    <div className="p-3 rounded-xl border border-[#D6DEF0] dark:border-[#263657] bg-white/60 dark:bg-slate-900/40 flex items-center gap-4 print-break-inside-avoid">
      <QrCode text={url} size={112} />
      <div className="min-w-0 space-y-1.5">
        <div className="text-[11px] text-sub">コースコード（このコースを再現できます）</div>
        <div className="font-mono font-bold text-base sm:text-lg tracking-wide text-[#1D2B53] dark:text-[#EAEFFC] break-all">
          {code}
        </div>
        <p className="text-[11px] text-sub leading-relaxed">
          QR コードを読み取るか、「本番設計」画面の「コースコードを読み込む」にこのコードを入れると、同じコースが開きます。
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={code} label="コードをコピー" />
          <CopyButton text={url} label="リンクをコピー" />
        </div>
      </div>
    </div>
  );
}

// 本番設計用：いまのコードの表示と、コードからの読み込み
export function CourseCodeLoader({
  config,
  onLoad,
}: {
  config: CourseConfig;
  onLoad: (config: CourseConfig) => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const code = encodeCourse(config);

  const load = () => {
    const result = decodeCourse(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!window.confirm('いまの設計を、このコースに置きかえます。よいですか？')) return;
    setError('');
    setInput('');
    onLoad(result.config);
  };

  return (
    <div className="p-4 rounded-xl border border-[#D6DEF0] dark:border-[#263657] bg-card-theme space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-sub">いまの設計のコースコード:</span>
        <span className="font-mono font-bold text-sm text-[#1D2B53] dark:text-[#EAEFFC] break-all">{code}</span>
        <CopyButton text={code} label="コピー" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') load();
          }}
          placeholder="例: S150-B70-M70-Y130-H80-A10-CS100"
          aria-label="コースコード"
          className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border border-[#D6DEF0] dark:border-[#263657] bg-white dark:bg-[#0E1626] font-mono text-sm"
        />
        <button
          type="button"
          onClick={load}
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#5AB0F0] text-white text-sm font-bold disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          コースコードを読み込む
        </button>
      </div>
      {error && <p className="text-xs font-bold text-[#E63946]">{error}</p>}
    </div>
  );
}
