# POC-011 FeatureからSource CodeまでのNavigation 結果

## P0-21 結果

| 項目 | 判定 | 検証内容 |
| --- | --- | --- |
| Feature → Process → Symbol | PASS | 選択Featureに属するProcessと、その保存済みProject Symbolだけを選択する。Featureを切り替えると下位Selectionをclearする。 |
| Definition Source | PASS | Index済みSymbolの`relativePath`と`range`を使い、Source本文とrangeの切出し一致を確認する。 |
| Caller / Callee | PASS | Project内の`RESOLVED` RelationをDefinitionへ移動でき、`UNKNOWN`はreason/evidenceを表示するだけで遷移しない。 |
| Back | PASS | DefinitionからCallerへ移動した後、直前のFeature / Process / Symbol Contextへ戻る。 |
| Data Flow Evidence | PASS | 選択FeatureのData Flow Evidenceから、保存済みProject SymbolのDefinitionへ移動する。 |
| Source読取り境界 | PASS | File不明、Root外相対path、Root外Fileを指すsymlinkは`SOURCE_UNAVAILABLE`として扱い、Viewerを停止させない。Repository内通常Fileの表示も維持する。 |
| 外部Symbol | PASS | `EXTERNAL` RelationにはProject内Source Navigationを提示しない。 |

## Required Fixture Test

- [x] Integration: Feature → Process → Symbol selection
- [x] UI: Definition Source表示とrange
- [x] UI: Caller一覧 / Callee一覧
- [x] UI: UNKNOWN Relationの非確定表示
- [x] E2E: Feature → Process → Source
- [x] E2E: Definition → Caller → Back
- [x] E2E: Process → Data Flow Evidence → Source

## 操作上の制約

- Read-only Viewerは既存のApplication Symbol IndexにあるProject Symbolのみを対象にする。外部／UNKNOWN RelationをSourceへ推測遷移させない。
- SourceのpathがRoot外、symlink経由、またはFile不明の場合は、本文を返さず`SOURCE_UNAVAILABLE`とする。
- Code Viewerの最終UI、Electron Routing、Editorの採用、Verification Result画面はIssue #12の対象外とする。

## 判定

GO — `npm test`（79件）、`npm run typecheck`、`git diff --check`がGreen。レビュー完了。
