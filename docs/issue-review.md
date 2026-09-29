# Issue Review Criteria v1.0

[ドキュメント一覧](README.md) | [Development Requirements](development-requirements.md) | [プロダクトの設計思想](product-principles.md) | [PoC-0正式仕様](poc-0-spec.md)

```text
Status: FIXED
Decision: ISSUE-REVIEW-CRITERIA-2026-09-17
```

> 本文書は、CodeContourにおけるIssue完了時のレビュー基準と振り返り記録の正規要件である。既存の[Definition of Done](development-requirements.md#19-definition-of-done)を置き換えるものではなく、完了判定に「CodeContourの中心原則を壊していないか」と、次の実装判断に使える学びを加える。

## 1. レビューの目的

CodeContourのIssue Reviewは、単にコード品質を確認する工程ではない。次の問いに答えるための確認と記録である。

> **要求された振る舞いが成立し、誤った理解を生まず、既存の責務境界を壊さず、次の実装判断に使える知見が残ったか。**

Issueを「検証可能な振る舞い」として扱う開発方針は、[Development Requirements](development-requirements.md)に従う。レビューでは、その振る舞いがプロダクト原則・解析の安全性・実装境界と両立していることを確認する。

## 2. 固定する7つの評価軸

Issueごとのレビューは、以下の7軸で行う。

| 評価軸 | レビュー時に確認すること |
| --- | --- |
| ① 受入条件 | Issueに書いたAcceptance Criteriaをすべて満たしたか |
| ② 正確性 | 誤ったRelationや状態を「確定」として生成していないか |
| ③ 境界遵守 | USER / ANALYZER / SYSTEM / AIのWrite責務を破っていないか |
| ④ 回帰 | 既存Fixture・Domain Test・E2Eを壊していないか |
| ⑤ 失敗時 | `UNKNOWN`・`PARTIAL`・`RETRYABLE`等を安全に扱えるか |
| ⑥ スコープ | Issue外の機能を必要以上に実装していないか |
| ⑦ 学び | 次IssueやMVP設計へ反映すべき制約・発見があったか |

### 2.1 最優先: 正確性

CodeContourでは、②の**「分からないことを分かったことにしない」**を最重要基準とする。

AnalyzerがCall先を一意に解決できない場合、無理に`RESOLVED`にしてはならない。静的根拠があるが一意に確定できない場合は`INFERRED`として確定Relationと分離し、安全にRelationを生成できない場合は`UNKNOWN`として残す。これは[PoC-0正式仕様のResolution State](poc-0-spec.md#64-resolution-state)に従う。

```text
一意に特定できる                 → RESOLVED
根拠はあるが一意に確定できない    → INFERRED
安全にRelationを生成できない      → UNKNOWN
```

誤ったRelationを確定表示するFalse Positiveは、解決不能な関係を`UNKNOWN`として残すことより重く扱う。部分的な解析失敗がある場合も、利用可能なFactと状態を返し、解析全体を不必要に停止させない。

### 2.2 境界遵守

Write権限は[MVP実装境界](mvp-implementation-boundaries.md#6-write権限)に従う。

| Actor | レビューで守る責務 |
| --- | --- |
| USER / Human Write Gateway | ユーザーの意味付け・説明・関連付けを保存する |
| ANALYZER | CodeSnapshot、Symbol、Structural Relationなどの解析Factのみを生成する |
| SYSTEM | Analysis State、Freshness、Verification、Projectionなどのシステム状態を管理する |
| AI | DBへ直接Writeしない。提案はユーザーまたはSystemの明示的な経路を通す |

## 3. Issue終了時の振り返りテンプレート

IssueをCloseする前に、Issue本文・PR本文・または対応する記録ドキュメントへ次のテンプレートを残す。該当しない項目は`なし`と明記する。

```md
## Issue Review

### 1. Acceptance
- [ ] Acceptance Criteriaをすべて満たした
- [ ] 必須TestがGreen
- [ ] 既存Testを壊していない

### 2. Correctness
- 誤った確定情報を生成していないか：
- UNKNOWNとして残したケース：
- 既知の制限：

### 3. Architecture
- Write権限・Security Boundary違反：
- 既存設計から変更した点：

### 4. Scope
- Issue外に追加実装したもの：
- POST-MVPへ送ったもの：

### 5. Findings
- 実装して初めて分かったこと：
- 次Issueへ影響すること：

### 6. Result
GO / CONDITIONAL GO / REWORK
```

## 4. 判定

| 判定 | 意味 | 次の扱い |
| --- | --- | --- |
| `GO` | 受入条件・安全性・必要なテストを満たし、そのまま次へ進める | IssueをCloseする |
| `CONDITIONAL GO` | Issue自体は完了したが、既知の制限を次工程へ持ち越す | 制限・フォローアップIssue・理由を記録してCloseする |
| `REWORK` | 受入条件または安全性の前提を満たさず、次へ進めない | Closeせず、修正と再レビューを行う |

`CONDITIONAL GO`では、持ち越す制限が「何か」「どの状態で安全か」「いつ再評価するか」を必ず残す。正確性や責務境界の違反を、将来対応として`CONDITIONAL GO`にすることはできない。

## 5. フェーズ別の重点

### PoC-0 Issue

PoC-0ではUIの完成度やProduction品質より、次を重視する。

- 仮説を検証できたか
- 解析限界と`UNKNOWN`へ退避すべき条件が明確か
- Fixtureと計測結果から、次の設計判断に使える証拠が残ったか

PoC-0の詳細な成功条件・対象外・計測は[PoC-0正式仕様](poc-0-spec.md)を優先する。

### MVP Issue

MVPではPoC-0の基準に加え、以下をレビュー対象にする。

- 永続化とTransactionの整合性
- Recoveryと失敗後の安全な再実行
- Security BoundaryとRepository境界
- 再起動後の状態復元
- 既存Domain Test、Fixture Test、E2Eの回帰

これらの必須テストと完了条件は[Development RequirementsのDefinition of Done](development-requirements.md#19-definition-of-done)に従う。

## 6. 運用ルール

1. 実装者はIssue完了時にテンプレートを記入する。
2. レビュアーは7軸を順に確認し、未確認項目を残さない。
3. `UNKNOWN`、`PARTIAL`、`RETRYABLE`などの状態を扱うIssueでは、正常系だけでなく状態が残る失敗経路を確認する。
4. 実装中に分かった制約・設計変更・次Issueへの影響は「Findings」に記録し、必要に応じて仕様書またはフォローアップIssueへ反映する。
5. `REWORK`の場合は、何が前提を満たさなかったかを明記してから再実装する。

この記録により、Issueを閉じる判断を単なる実装完了ではなく、プロダクトの理解可能性と安全な進行を守る判断にする。
