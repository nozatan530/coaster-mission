---
name: studio-brief
description: AI Studioでプロンプトとスキーマを固めるための指示書（brief.md）とテストケースを作る。開発フローの第2段階。
disable-model-invocation: true
argument-hint: "<機能名>"
---

# AI Studio 向け指示書の作成

対象機能: $ARGUMENTS

`docs/concept.md` の「AI機能一覧」から該当機能を読み、`prompts/$ARGUMENTS/` に次の3ファイルを作る。

## 1. `brief.md`（人間が AI Studio を操作しながら読む手順書）

```markdown
# <機能名> — AI Studio 作業指示

## この機能がやること（1〜2文）

## System instructions の初稿
（そのまま AI Studio の System instructions 欄に貼れる形で書く）

## 出力スキーマの初稿
（Structured output の「Edit」欄に貼れる JSON Schema。
  AI Studio が受け付ける形式＝OpenAPI サブセットに合わせ、
  各フィールドに description を付ける）

## 試すモデルと設定
- 第一候補: Flash 系（速度・コスト重視）
- 比較用: Pro 系（精度が足りないときだけ）
- Temperature の目安と理由

## 確かめること（チェックリスト）
- [ ] cases.jsonl の全ケースでスキーマどおりの JSON が返る
- [ ] 端的すぎる入力・長すぎる入力・無関係な入力でも破綻しない
- [ ] 中高生向けとして不適切な表現が出ない
- [ ] 個人情報を入力しても出力に再掲しない
- [ ] （機能固有の観点）

## 終わったら保存するもの
- `system_prompt.md` … 確定した System instructions
- `schema.json` … 確定した出力スキーマ
- `config.json` … {"model": "...", "temperature": ..., "note": "選んだ理由"}
- （任意）`studio_code.txt` … 「Get code」の出力をそのまま
保存後、Claude Code で `/studio-import <機能名>` を実行する。
```

## 2. `cases.jsonl`（テストケース）

1行1ケース。`{"id": "...", "input": "...", "expect": "期待すること（自然文）"}`
- 典型ケース 3〜5
- 境界ケース（空に近い入力、極端に長い入力、想定外の話題、意地悪な入力）3〜5

## 3. 空の置き場所

`system_prompt.md` `schema.json` `config.json` はまだ作らない（AI Studio 側で確定させるため）。

## 最後に

brief.md の場所と、AI Studio で最初にやること（新規プロンプト → System instructions に貼る → Structured output をオン → スキーマを貼る → cases のinputを順に試す）を3行で案内する。
