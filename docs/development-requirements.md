# Development Requirements v1.0

[ドキュメント一覧](README.md) | [固定MVP](mvp-scope.md) | [MVP実装境界](mvp-implementation-boundaries.md) | [Technical Requirements](technical-requirements.md) | [Architecture Spike](architecture-spike-plan.md)

```text
Status: FIXED
Decision: DEVELOPMENT-REQUIREMENTS-2026-09-17
```

> 本文書は、CodeContourのMVP開発におけるTDD、テスト階層、Issue管理、CI Gate、Definition of Ready / Doneの正規要件である。プロダクト仕様と技術境界を変更するものではなく、それらを検証可能な振る舞いとして実装・保護する方法を定める。

CodeContourでは、TDDを「すべてを細かいUnit Testから作る」ではなく、**振る舞いを先に固定し、後戻りコストの高い境界を自動テストで守る開発方式**として採用します。

中心ルールは、

> **Acceptance Criteria → 振る舞いTest → 最小実装 → Refactor**

とします。

## 1. TDD開発方針

開発単位は原則としてGitHub Issue 1件です。

```text
Issue
↓
受入条件を書く
↓
失敗するTestを書く
↓
最小実装
↓
Test Green
↓
Refactor
↓
Issue Acceptance Test
↓
Close
```

ただし、UIの色・余白・文言の微調整まで必ずTest Firstにはしません。

TDD対象を次のように分けます。

| 対象                              | TDD  |
| ------------------------------- | ---- |
| Domain Command / Guard / Effect | 必須   |
| Entity状態遷移                      | 必須   |
| Analyzer                        | 必須   |
| Active / Staging Snapshot       | 必須   |
| Verification競合制御                | 必須   |
| DB Transaction                  | 必須   |
| IPC Security Boundary           | 必須   |
| Repository Security             | 必須   |
| Screen主要E2E                     | 必須   |
| 単純なUIレイアウト                      | 原則不要 |
| 色・アイコン・Pane幅                    | 不要   |
| Tooltip文言                       | 不要   |

---

## 2. 振る舞い設計の基本単位

実装前にすべての内部処理を書くのではなく、外部から観測できる振る舞いを定義します。

形式は、

```text
Given
前提

When
操作・Event

Then
観測可能な結果
```

とします。

例えばFeature作成なら、

```text
Given
ACTIVEなProjectが存在する

When
CREATE_FEATURE(name="Authentication")
を実行する

Then
Featureが1件作成される

And
origin = USER

And
confirmation = CONFIRMED

And
FEATURE_CREATEDが発行される
```

内部でRepository Patternを使うか等はAcceptance Criteriaへ入れません。

---

## 3. Guard失敗も振る舞いとしてTestする

正常系だけではなく、

```text
Given
Feature名が空

When
CREATE_FEATUREを実行

Then
Featureを作成しない

And
INVALID / NAME_REQUIREDを返す

And
FEATURE_CREATEDは発行しない
```

までTestします。

つまり、

```text
Guard failure
= DB変更なし
= Domain Eventなし
```

を共通原則にします。

---

## 4. Test Layer

MVPでは5層に分けます。

| Layer                        | 主対象                       |
| ---------------------------- | ------------------------- |
| Domain Test                  | Command / Guard / State   |
| Analyzer Fixture Test        | TypeScript解析              |
| Persistence Integration Test | SQLite / Transaction      |
| Architecture Test            | Electron / IPC / Security |
| E2E Acceptance Test          | 主要ユーザーフロー                 |

大量のE2E Testだけで守る構成にはしません。

---

## 5. Domain Test

最も高速に大量実行するTestです。

例えば、

```text
Feature
Process
DataFlow
UserExplanation
VerificationAttempt
AnalysisState
```

の状態遷移を検証します。

### Process削除

```text
Given
Process Aが存在し
Aへ接続するDataFlowが2件ある

When
DELETE_PROCESS(A)

Then
Process A = TOMBSTONE

And
ProcessCodeRef = INACTIVE

And
接続DataFlow = TOMBSTONE

And
1つのUserCommandとして記録される
```

さらに、

```text
When
UNDO

Then
Process
ProcessCodeRef
DataFlow
が全て元状態へ戻る
```

までを同じFeature群としてTestします。

---

## 6. Analyzer Fixture Test

PoC-0からMVPまで非常に重要です。

Fixture Repositoryを正解データと一緒に管理します。

```text
fixtures/
  typescript-basic/
  import-alias/
  calls/
  external-library/
  unknown-cases/
```

例えば、

```text
AuthController.login
CALLS
AuthService.login
```

は、

```text
expected = RESOLVED
```

とします。

一方、

```ts
service[action]()
```

は、

```text
expected = UNKNOWN
```

です。

重要なTest原則は、

> **解決できないものを誤ってRESOLVEDにしない**

ことです。

---

## 7. Analyzer Testの評価値

Fixture Testでは単純なPass/Failに加えて、

```text
True Positive
False Positive
False Negative
UNKNOWN
```

を記録します。

特に、

```text
False Positive
```

を重視します。

CodeContourでは「存在しないRelationをあると断定する」方がMental Modelへ悪影響だからです。

---

## 8. Persistence Integration Test

SQLiteはMockだけで済ませません。

実SQLiteを使用したIntegration Testを持ちます。

最低限検証するのは、

```text
Migration
Foreign Key
WAL
Transaction
Rollback
Revision
Soft Delete
Active Snapshot切替
```

です。

特に重要なのがSnapshotです。

### Atomic Snapshot Test

```text
Given
Active Snapshot = A

And
Staging Snapshot = B

When
Bの解析が完了

Then
1 Transactionで
Active Snapshot = B

And
Aは破壊されない
```

失敗時：

```text
When
Staging Bの解析に失敗

Then
Active Snapshot = A

And
Bの不完全CacheはActiveにならない
```

---

## 9. Analyzer Batch Test

今回固定した、

```text
analysisRunId
stagingSnapshotId
sequenceNumber
schemaVersion
```

は必ずTestします。

例えば、

```text
Given
Run Bが現在ANALYZING

When
Cancel済みRun AのBatchが遅延到着

Then
DB ServiceはBatchを拒否

And
Run BのSnapshotへWriteしない
```

重複Batch：

```text
Given
sequenceNumber=10が処理済み

When
同じBatchが再到着

Then
二重Insertしない
```

これはArchitecture TestではなくPersistence/Analyzer Integrationの重要Acceptanceです。

---

## 10. Verification競合Test

User ExplanationのAI照合は、非同期競合を最優先でTestします。

```text
Given
Explanation Revision = 5

When
Verification Attempt Aを開始

And
UserがRevision 6を保存

And
Attempt Aが後から成功

Then
Revision 6へ結果を反映しない

And
Attempt A = STALE_RESULT
```

同様に、

```text
codeSnapshotId変更
sourceAnchor変更
latestAttempt変更
```

についても結果を拒否します。

これをE2EではなくService Testで高速に検証します。

---

## 11. Electron Architecture Test

MVPの技術受入条件として自動Testを持ちます。

最低限、

```text
Rendererからfsを直接利用できない

RendererからSQLiteへ直接接続できない

raw ipcRendererを公開していない

不正IPC PayloadをZodで拒否

許可されていないIPC Channelを実行できない

外部Navigationを拒否

Window.open等をAllowlist制御
```

を検証します。

可能なものは静的Test + Integration Testに分けます。

---

## 12. E2E Test

E2Eは本数を絞ります。

MVPでは中心価値を確認する5本程度で十分です。

### E2E-01 Repository → Feature

```text
Repository登録
↓
解析完了
↓
Feature作成
↓
Feature Mapへ表示
```

### E2E-02 Feature → Process → Code

```text
Feature選択
↓
Process作成
↓
Symbol関連付け
↓
Code Viewer
↓
Definition表示
```

### E2E-03 Data Flow

```text
Process A/B作成
↓
Data Flow作成
↓
Evidence Symbol追加
↓
EVIDENCED表示
```

### E2E-04 User Explanation

```text
Explanation保存
↓
UNVERIFIED
↓
コードと照合
↓
Verification結果
↓
本文はAI変更されない
```

### E2E-05 STALE

```text
Evidence付きExplanation
↓
Repository変更
↓
再解析
↓
関連ExplanationだけSTALE
↓
無関係なExplanationはCURRENT
```

---

## 13. Test Naming

Test名は実装詳細ではなく振る舞いを書くことを推奨します。

良い例：

```text
marks only explanations backed by changed symbols as stale
```

```text
rejects a verification result for an outdated explanation revision
```

避ける例：

```text
calls updateExplanation()
```

```text
repository method test
```

Refactorに弱いためです。

---

## 14. Issueの単位

Issueは「ファイルを作る」ではなく**ユーザーまたはDomain上の1振る舞い**で切ります。

悪い例：

```text
FeatureServiceを作る
```

良い例：

```text
ユーザーがFeatureを手動作成できる
```

さらに大きすぎる、

```text
Feature Mapを実装する
```

も避けます。

---

## 15. Issue Template

各MVP Issueは最低限次を持ちます。

```text
Title

目的

対象Screen / View

User Story / Domain Goal

前提

振る舞い

Acceptance Criteria

Failure / Edge Case

対象Entity

Command

Domain Event

Tests

Out of Scope

Definition of Done
```

Action Catalogが完全でなくても、Issue作成時に必要部分だけ追加します。

---

## 16. Acceptance Criteria書式

基本はGiven / When / Thenです。

例えばIssue：

### 「Featureを手動作成できる」

```text
Given
ACTIVEなProjectがある

When
Feature名として"Authentication"を入力し保存する

Then
Featureが作成される

And
origin = USER

And
confirmation = CONFIRMED

And
Feature Mapに表示される
```

失敗：

```text
Given
Feature名が空

When
保存する

Then
Featureを作成しない

And
NAME_REQUIREDを表示する
```

---

## 17. IssueにTest要件を書く

Issueには実装とTestを分離して別Issueにしない方がよいです。

同じIssueに、

```text
Required Tests

[ ] Domain: valid feature creation
[ ] Domain: blank name rejection
[ ] Integration: persistence after reload
[ ] E2E: Feature appears in Feature View
```

と持たせます。

つまり、

> Feature作成実装完了、テストは後日

をDoneにしません。

---

## 18. Definition of Ready

実装開始可能なIssueの条件です。

```text
目的が明確

対象Screen / Domainが明確

Acceptance Criteriaがある

主要Guardが分かる

主要Effectが分かる

MVP内である

外部依存が解決済み
```

全Failure Codeや全UI文言までは不要です。

---

## 19. Definition of Done

MVP Issueは次を満たしたらCloseします。

```text
Acceptance Criteria成立

必須Automated Test Green

既存Test Green

Type Check Green

Lint Green

関連Fixture Test Green

主要Error Path確認

Security Boundary違反なし

必要なCatalog / Domain仕様を更新

PR Review完了
```

「コードを書いた」はDoneではありません。

---

## 20. Bug Issue

Bugにも再現Testを要求します。

```text
Bug発見
↓
再現Testを追加
↓
Test Red
↓
Fix
↓
Green
```

例えば、

> Revision 5のAI結果がRevision 6へ反映された

というBugなら、そのケースをIntegration Testとして追加してから修正します。

Regression Testが残ります。

---

## 21. Spikeの扱い

PoC / Architecture SpikeはTDDと分けます。

Spikeの目的は、

> 正しい実装を作る

ではなく、

> 技術判断のEvidenceを得る

ことです。

したがって、

```text
ADR-001 Analyzer Executor Selection
ADR-002 SQLite Driver Selection
```

については、Acceptance Criteriaではなく測定項目を持ちます。

例えば、

```text
utilityProcess / Worker Thread双方を試す

Crash isolation測定

Memory測定

解析時間測定

Cancel確認

結果をADRへ記録
```

です。

SpikeコードをそのままProductionへ昇格させる場合は、改めてProduction Testを追加します。

---

## 22. 最初に作成するIssue群

MVP全体を一度にIssue化せず、最初はPoC-0と基盤から作るのがよいです。

推奨順は、

| Issue     | 内容                                    |
| --------- | ------------------------------------- |
| POC-001   | Repository + tsconfigを読み込む            |
| POC-002   | Symbol Indexを生成                       |
| POC-003   | Definition / Reference解析              |
| POC-004   | Explicit Call / Caller / Callee       |
| POC-005   | Resolution State                      |
| POC-006   | Manual Feature                        |
| POC-007   | Manual Process                        |
| POC-008   | Process → Symbol                      |
| POC-009   | Manual Data Flow + Evidence           |
| POC-010   | Feature → Process → Source Navigation |
| SPIKE-001 | Analyzer Executor比較                   |
| SPIKE-002 | SQLite Driver比較                       |

です。

PoC-0完了後にMVP Issue群を展開します。

---

## 23. MVP Vertical SliceのIssue例

PoC成功後は、技術レイヤー単位ではなくVertical Sliceで進めます。

例えば最初のMVP Slice：

```text
ISSUE: Local Repositoryを登録して
Featureを1つ作成できる
```

この中で、

```text
Electron
IPC
DB
Domain
React
```

を全部薄く通します。

次：

```text
ISSUE:
FeatureにProcessを追加できる
```

次：

```text
ISSUE:
ProcessからSource Symbolへ移動できる
```

という形です。

最初にDB全テーブル、次に全IPC、次に全UIというHorizontal Layer実装は避けます。

---

## 24. Test Directory案

```text
src/

tests/
├ domain/
│  ├ feature/
│  ├ process/
│  ├ data-flow/
│  └ explanation/
│
├ analyzer/
│  ├ fixtures/
│  └ expectations/
│
├ persistence/
│  ├ migrations/
│  ├ transactions/
│  └ snapshots/
│
├ architecture/
│  ├ ipc/
│  ├ security/
│  └ process-boundary/
│
└ e2e/
   ├ repository.spec.ts
   ├ understanding.spec.ts
   └ verification.spec.ts
```

Test codeをProduction codeの内部実装に過度に結合させません。

---

## 25. CI Gate

PR時には、

```text
Type Check
↓
Lint
↓
Domain Unit Tests
↓
Analyzer Fixture Tests
↓
Persistence Integration Tests
↓
Architecture Tests
↓
Build
```

を必須。

E2Eは時間次第で、

```text
PR
→ Smoke E2E

main / release
→ Full E2E
```

に分けてもよいです。

---

## 26. 受入試験とUnit Testを混同しない

例えばAcceptance Criteria：

> Process削除時に関連Data Flowも画面から消える。

これを満たすために、

Domain Testでは、

```text
Process=TOMBSTONE
DataFlow=TOMBSTONE
```

を確認。

E2Eでは、

```text
Process削除
↓
UIからProcess/DataFlowが消える
```

を確認します。

同じ振る舞いを別レイヤーから守ります。

---

## 27. TDDの止めどころ

過剰Testを防ぐルールも必要です。

次は原則Testしません。

```text
private function単体

単純getter

React Component内部実装

CSS class名

Paneのpixel値

外部Libraryそのものの挙動
```

Testするのは、

> **壊れたときにユーザー・Domain・Security上困る振る舞い**

です。

これは今回の「細部を決めすぎて進捗を遅らせない」という開発方針とも一致します。

---

## 28. 正式な開発ループ

CodeContourでは最終的に、

```text
Issue
↓
Acceptance Criteria
↓
最小Behavior Test
↓
RED
↓
Implementation
↓
GREEN
↓
Refactor
↓
Integration / E2E
↓
Review
↓
Merge
```

を標準とします。

新しい仕様が実装中に判明した場合は、

```text
仕様書を全部先に修正
```

ではなく、

```text
Issue内でDecision記録
↓
必要ならCatalog / Domain Doc更新
↓
実装
```

で十分です。

---

### 実装開始時に必要な最低限の成果物

このTDD方針であれば、全MVPを事前にIssue化する必要はありません。

実装開始時に用意すべきなのは、

```text
TDD / Testing Policy v1.0

Issue Template

Definition of Ready

Definition of Done

PoC-0 Issue群

Architecture Spike Issue群

Fixture Repository

CI初期構成
```

までです。

その後のMVP Issueは、PoC結果と実装で分かった制約を取り込みながら順次作成する方が、現在のCodeContourには適しています。

特に重要なのは、**「Issue = 実装タスク」ではなく「検証可能な振る舞い」**として管理することです。これにより、要件・Acceptance Criteria・自動Test・実装が同じ単位でつながります。
