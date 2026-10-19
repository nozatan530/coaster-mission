---
name: studio-import
description: AI Studioで確定したプロンプト・スキーマ・設定を取り込み、テストケースで評価して仕様書に反映する。開発フローの第4段階。
disable-model-invocation: true
argument-hint: "<機能名>"
---

# AI Studio の結果を取り込む

対象機能: $ARGUMENTS

## 1. そろっているか確認

`prompts/$ARGUMENTS/` に `system_prompt.md` `schema.json` `config.json` があるか確認する。
- ない場合: `studio_code.txt`（Get code の出力）や、ユーザーが貼り付けた内容から3ファイルを切り出して保存してよいか尋ねる。
- `schema.json` が有効な JSON か確認する。

## 2. 実際に API で評価

`.env` に `GEMINI_API_KEY` があれば次を実行する。

```
node --env-file=.env scripts/eval-prompt.mjs $ARGUMENTS
```

結果（`prompts/$ARGUMENTS/eval-result.json`）を読み、各ケースについて
- スキーマに合っているか
- `expect` を満たしているか（自分で判定し、理由を1行）
を表にまとめる。

キーがない場合は評価を飛ばし、その旨を伝える。

## 3. 判定

- 全ケース OK → 手順4へ。
- NG がある → **正本は書き換えず**、直すべき点と修正案（プロンプトの差分）を示し、「AI Studio で直して再保存 → もう一度 `/studio-import`」を案内して終了する。

## 4. 仕様書へ反映

`docs/spec.md` の「AI機能」節に次を追記・更新する（プロンプト本文は転記せず、パスで参照）。

```markdown
### <機能名>
- 正本: prompts/<機能名>/（system_prompt.md, schema.json, config.json）
- モデル / temperature:
- 入力: どの画面の何を、どう整形して渡すか
- 出力の使い方: スキーマの各フィールドをどの画面のどこに出すか
- 失敗時の扱い: タイムアウト・スキーマ不一致・不適切出力のときの表示
- 評価: yyyy-mm-dd に cases N件すべて通過
```

最後に「次は `/build`」と案内する。
