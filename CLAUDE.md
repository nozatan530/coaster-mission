# プロジェクト規約

## 開発フロー

## 2つのルート

- **通常ルート（AIを組み込まないアプリ）**：`~/code/ideas` で構想 → AI Studio Build で試作 → GitHub → `/from-studio` でここに取り込み → `/build` → `/verify`。下の表の 2〜4 は使わない。
- **AI機能ありルート**：下の表を 1 から順に進める。


| 段階 | 誰が | コマンド | 成果物 |
| --- | --- | --- | --- |
| 1. 構想 | Claude Code | `/app-idea` | `docs/concept.md` |
| 2. AI Studio向け指示書 | Claude Code | `/studio-brief <機能名>` | `prompts/<機能名>/brief.md`, `cases.jsonl` |
| 3. プロンプト・スキーマ確定 | 人間（AI Studio） | — | `prompts/<機能名>/` に結果を保存 |
| 4. 取り込み・評価 | Claude Code | `/studio-import <機能名>` | `docs/spec.md` 更新、評価レポート |
| 5. 実装 | Claude Code | `/build` | `src/` |
| 6. 検証 | Claude Code | `/verify` | 検証レポート |
| 7. 振り返り | Claude Code | `/retro <気づき>` | `docs/retro.md`、改善タスク、`~/code/ideas/LESSONS.md` |

段階を飛ばさない。AI機能がないアプリは 2〜4 を省略してよい。

## ルール

- `prompts/<機能名>/` の `system_prompt.md` `schema.json` `config.json` は AI Studio で確定した**正本**。実装側で勝手に書き換えない。変更が必要になったら理由を示して提案し、`/studio-brief` に戻る。
- 実装はプロンプトやスキーマを**コードにコピペせず、`prompts/` から読み込む**（正本を1か所に保つため）。
- Gemini の APIキーはフロントエンドに絶対に置かない。サーバー側（Firebase Functions / Cloud Run など）を経由させる。
- 生徒の個人情報（氏名・出席番号など）を API に送らない設計にする。
- 1機能ずつ実装し、動いたらコミットする。
- 利用者は中高生と教員。端末は Chromebook / iPad / スマホを想定し、狭い画面でも使えること。

## コマンド

- プロンプト評価: `node --env-file=.env scripts/eval-prompt.mjs <機能名>`
- 依存の導入: `npm install`
- 開発サーバー: `npm run dev`（http://localhost:3000）
- 型チェック: `npm run lint`（`tsc --noEmit`）
- 物理の確認（テストの代わり）: `npm run check:physics`（`docs/studio-prompt.md` の「計算の確認用」3設計と照合。ずれがあると終了コード1）
- ビルド: `npm run build`（`dist/` に出力）／確認 `npm run preview`

## 技術スタック

- **通常ルート**（AIを組み込まないアプリ）。構想は `docs/concept.md`、試作の指示書は `docs/studio-prompt.md`
- Vite 8 + React 19 + TypeScript、Tailwind CSS 4（`@tailwindcss/vite`）、lucide-react、motion
- サーバーなしの静的サイト。保存は localStorage のみ（`src/storage.ts`）
- 物理モデルと定数は `src/physics.ts`、型は `src/types.ts`、コース図は `src/components/CourseCanvas.tsx`
- AI Studio の雛形由来で `@google/genai`・`express`・`dotenv` が package.json に残っているが、`src/` からは使っていない（Gemini は呼ばない）。`metadata.json` の `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` も同じく雛形由来
