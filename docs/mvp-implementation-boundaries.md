# MVP実装境界・開始Gate

[ドキュメント一覧](README.md) | [固定MVP](mvp-scope.md) | [Domain Model](domain-model.md) | [Security](security-and-data.md)

```text
Status: FIXED
Decision: MVP-BOUNDARIES-2026-09-17
```

> 本文書は、MVP実装前に固定する高コスト境界の正規仕様である。全Action、全Failure Code、画面文言などの局所仕様は実装と検証で更新できる。本書とほかの文書がMVPの実装境界について矛盾する場合は、本書を優先する。

## 1. 設計方針

仕様書の完全性ではなく、後から変更するとDB、IPC、状態管理、画面構造を横断して手戻りが発生する事項を先に固定する。

```text
高コストな境界
→ 実装前に固定

局所的で変更しやすい仕様
→ 実装とPoCで判明した事実をもとに更新
```

実装前に固定する対象は次の8項目とする。

1. Screen / View / Overlayの責務
2. CommandとDomain Eventの分離
3. 主要Entityの状態遷移とWrite権限
4. Verification Attemptなど非同期処理の競合防止
5. Analyzer StateとSnapshot切替
6. Selection Stateの不変条件
7. Global SettingsとProject SettingsのScope
8. SQLiteへ保存する正本データの範囲

## 2. Screen / View / Overlay

```text
Screen:
独立RouteとLifecycleを持つNavigation到達点

View:
Understanding Workspace内の抽象度切替

Inspector / Overlay:
現在のSelectionに従う補助UI
独立Routeを持たない

Recovery:
正常フローへ戻るための独立Screen
```

MVPの独立Screenは次の7つとする。

```text
SCR-001 Project Hub
SCR-002 Repository Setup
SCR-003 Initial Analysis
SCR-004 Understanding Workspace
SCR-005 Repository Reconnect
SCR-006 Global Settings
SCR-007 Project Settings
```

Understanding Workspaceは1 Screenとし、中央Viewを切り替える。

```text
VIEW-101 Feature Map
VIEW-102 Process / Data Flow
VIEW-103 Code Viewer
```

Verification Resultは独立Screenにせず、Code Viewer内のInspector状態として表示する。

## 3. CommandとDomain Event

User起点の処理を次の順序に固定する。

```text
UI Action
↓
Command
↓
Guard
↓
Transaction / Effect
↓
Domain Event
↓
Projection更新
↓
Navigation
```

Commandは実行要求、Domain Eventは成立済みの事実である。

```text
Command:
CREATE_FEATURE
RENAME_FEATURE
VERIFY_EXPLANATION

Domain Event:
FEATURE_CREATED
FEATURE_RENAMED
EXPLANATION_VERIFICATION_COMPLETED
```

ActorはCommand / Eventのmetadataとして保持し、Event名で要求主体を表現しない。

System起点の処理は別系統とする。

```text
Analyzer / AI / Filesystem
↓
System Event
↓
Guard
↓
Effect
↓
Projection更新
```

Guard failure時はUser Contextを変更しない。

## 4. Analyzer StateとSnapshot

### 4.1 Analysis State

```text
PENDING
ANALYZING
READY
PARTIAL
FAILED
CANCELLED
```

Analysis StateはUserのNavigationではなくAnalyzer / SYSTEMが変更する。

```text
PENDING
↓ ANALYZER_INDEX_STARTED
ANALYZING

ANALYZING
├ ANALYZER_INDEX_COMPLETED → READY
├ ANALYZER_INDEX_PARTIALLY_COMPLETED → PARTIAL
├ ANALYZER_INDEX_FAILED → FAILED
└ ANALYZER_INDEX_CANCELLED → CANCELLED
```

Userの`Workspaceへ`操作はAnalysis Stateを変更しない。

### 4.2 Active / Staging Snapshot

```text
Active Snapshot:
現在UIが参照する利用可能な解析結果

Staging Snapshot:
解析中の新しい解析結果
```

再解析はActive Snapshotを維持したままStaging Snapshotへ書き込む。

```text
Active Snapshot A
↓
Staging Snapshot Bを生成
↓
解析成功
↓
BをREADYまたはPARTIALとして確定
↓
Project.activeCodeSnapshotIdをAからBへAtomic切替
↓
Aは旧Snapshotとして保持
```

切替は1 Transactionで行う。

```text
BEGIN
Staging Snapshot Bを確定
Project.activeCodeSnapshotId = B
COMMIT
```

解析が`FAILED`または`CANCELLED`の場合、Staging Snapshotを破棄し、Active Snapshotを変更しない。

### 4.3 Analyzer Batch Protocol

AnalyzerからDB Serviceへ渡す結果には次を付与する。

Projectごとに`ANALYZING`のRunは最大1つとし、次のPointerで実行対象を特定する。Run開始、Pointer設定、Staging Snapshot作成は同じTransactionで行う。

```text
Project.currentAnalysisRunId
Project.currentStagingSnapshotId
```

```text
analysisRunId
stagingSnapshotId
sequenceNumber
schemaVersion
payload
```

`sequenceNumber`は同一Run内で単調増加し、`(analysisRunId, sequenceNumber)`を一意に扱う。DB Serviceは次をすべて満たすBatchだけを保存する。

```text
AnalysisRun.status == ANALYZING
batch.analysisRunId == Project.currentAnalysisRunId
batch.stagingSnapshotId == Project.currentStagingSnapshotId
stagingSnapshotId != Project.activeCodeSnapshotId
sequenceNumber is unprocessed
```

不成立のBatchは破棄する。GuardはAnalyzerではなく単一Write主体であるDB Serviceが実行し、Cancel済みRun、旧Runの遅延結果、重複Batchが現在の解析結果へ混入することを防ぐ。詳細は[Technical Requirements](technical-requirements.md)を参照する。

### 4.4 Projectの利用可能性

Workspaceを利用できるかは最新Analysis Stateだけで判断しない。

```text
Workspace usable
⇔ Project.activeCodeSnapshotId != null
```

再解析が失敗してもActive SnapshotがあればWorkspaceを利用できる。初回解析が失敗しActive SnapshotがなければWorkspaceへ進めない。

### 4.5 PARTIAL最低条件

次をすべて満たす場合だけ`PARTIAL`とする。

```text
tsconfig load成功
Application File Index利用可能
Symbol Index利用可能
Indexed PROJECT SymbolのDefinition Locationを取得可能
Feature / ProcessへSymbolを関連付け可能
```

そのうえで、一部Relationが`UNKNOWN`、一部File解析失敗、一部Call解決失敗などが存在する状態を`PARTIAL`とする。

Symbol Index自体が利用不能な場合は`FAILED`とする。

## 5. 主要Entity状態

状態は意味の異なる独立軸へ分離し、巨大な単一enumにしない。

### 5.1 Project

```text
Lifecycle:
ACTIVE / ARCHIVED
```

### 5.2 RepositoryBinding

```text
Lifecycle:
ACTIVE / INACTIVE

Connection:
CONNECTED / DISCONNECTED
```

`INACTIVE`と`DISCONNECTED`を混同しない。

### 5.3 AnalysisRun

```text
PENDING / ANALYZING / READY / PARTIAL / FAILED / CANCELLED
```

### 5.4 Feature

```text
Confirmation:
CANDIDATE / CONFIRMED

Lifecycle:
ACTIVE / ARCHIVED

Freshness:
CURRENT / PARTIALLY_STALE / STALE
```

### 5.5 Process

```text
Lifecycle:
ACTIVE / TOMBSTONE
```

### 5.6 DataFlow

```text
Lifecycle:
ACTIVE / TOMBSTONE

Verification:
UNVERIFIED / EVIDENCED

Freshness:
CURRENT / STALE
```

### 5.7 SourceAnchor

```text
Resolution:
RESOLVED / ORPHANED
```

SourceAnchorはSnapshotを跨ぐ安定Identityである。`resolutionState`は現在状態のProjectionとし、Snapshotごとの位置・解決結果はSymbolOccurrenceへ保持する。旧Snapshotの解決情報を破壊的に上書きしない。

### 5.8 UserExplanation

```text
Lifecycle:
ACTIVE / DELETED

Verification:
UNVERIFIED / CONSISTENT / QUESTIONABLE / CONTRADICTED

Freshness:
CURRENT / STALE
```

### 5.9 VerificationAttempt

```text
PENDING / RUNNING / COMPLETED / FAILED / STALE_RESULT
```

## 6. Write権限

| Actor | Write可能な対象 |
| --- | --- |
| USER / Human Write Gateway | Feature、Process、ProcessCodeRef、DataFlow、EvidenceBinding、Memo、UserExplanation本文、SemanticLink |
| ANALYZER | CodeSnapshot内容、FileSnapshot、SymbolOccurrence、StructuralRelation、SourceAnchor解決情報 |
| SYSTEM | Analysis State、Freshness、Verification結果、Projection、VerificationAttempt |
| AI | DBへの直接Writeなし |

Field単位では次を厳守する。

```text
UserExplanation.body
→ USER only

UserExplanation.verification
→ SYSTEM only

UserExplanation.freshness
→ SYSTEM only
```

AIはVerification結果を返すだけであり、User ContextやDBへ直接書き込まない。SYSTEMがGuardを確認した後に結果を反映する。

## 7. Verification Attemptと競合防止

Verification処理はUserExplanationの状態から分離したEntityとして管理する。

```text
VerificationAttempt

id
explanationId
explanationRevisionId
codeSnapshotId
sourceAnchorId
status
requestId
createdAt
completedAt
result
failureReason
```

UserExplanationの過去Verification結果を`VERIFYING`で上書きしない。UI上の照合中表示は`VerificationAttempt.status = RUNNING`から導出する。

AI結果を反映する前に次を確認する。

```text
ATTEMPT_IS_LATEST
EXPLANATION_REVISION_MATCHES
CODE_SNAPSHOT_MATCHES
SOURCE_ANCHOR_MATCHES
```

すべて一致した場合だけ、Verification結果をUserExplanationへ反映する。

```text
verification = CONSISTENT / QUESTIONABLE / CONTRADICTED
freshness = CURRENT
```

一致しない場合は次とし、現在のUserExplanationを変更しない。

```text
VerificationAttempt.status = STALE_RESULT
```

通信失敗時はAttemptを`FAILED`にし、UserExplanationの過去Verification / Freshnessを維持する。

アプリ起動時に永続Store上の`RUNNING` Attemptが残っていた場合、MVPでは再開せず次へ遷移させる。

```text
status = FAILED
failureReason = INTERRUPTED
```

## 8. Selection Stateの不変条件

Projectごとに次をLocal保存する。

```text
lastView
selectedFeatureId
selectedProcessId
selectedSymbolId
```

Feature Selectionが変わった場合、次を適用する。

```text
Process.featureId != selectedFeatureId
→ selectedProcessIdをclear

DataFlow.featureId != selectedFeatureId
→ selectedDataFlowIdをclear
```

SymbolはProject内のGlobal Selectionとして保持できる。ただし現在Featureとの`ProcessCodeRef`がない場合、UIへ次を表示する。

```text
このSymbolは現在選択中のFeatureに関連付けられていません
```

復元対象が存在しない場合は上位ContextへFallbackする。

```text
Symbol消失
→ Process

Process消失
→ Feature

Feature消失
→ Feature Map未選択
```

未保存Form、Dialog、Hover、Tooltip、一時Filter、Pane幅はSelection Stateとして永続化しない。

## 9. Settings Scope

### 9.1 Global Settings

```text
Path:
/settings

Scope:
AI Provider
Model
Credential Reference
Default AI Settings
Default AI Transmission Policy
```

### 9.2 Project Settings

```text
Path:
/projects/:projectId/settings

Scope:
ProjectSecurityPolicy
Project AI Transmission Policy
Security Ignore
Analysis Settings
Repository Settings
```

設定値の優先順位を次に固定する。

```text
Project Setting
?? Global Default
?? Application Default
```

Security関連のApplication Defaultは安全側とし、AI Transmission PolicyのDefaultは`DENY`とする。

API Credential本体はSQLiteへ保存せず、macOS Keychain等のOS Secure Storeへ委譲する。SQLiteにはProvider、Credential Reference ID、設定済み状態だけを保存する。

## 10. SQLite保存境界

### 10.1 永続する正本・安定参照

消失するとUserの理解・設定・Provenance・コードとの安定接続を失うデータである。

```text
Project
RepositoryBinding
ProjectSecurityPolicy

Feature
Process
ProcessCodeRef
DataFlow

EvidenceRef
EvidenceBinding

Memo
UserExplanation
UserExplanationRevision
SemanticLink

SourceAnchor

VerificationAttempt
VerificationResult

CodeSnapshot metadata
WorkspaceSelectionState
AnalysisRun / AnalysisState
```

SourceAnchorは破棄可能Cacheにしない。User Contextから参照される安定IDとして永続化する。

```text
SourceAnchor

id
repositoryBindingId
qualifiedName
relativePath
kind
signatureHash
resolutionState
```

再解析時は新しいSymbolOccurrenceを既存SourceAnchorへ照合する。解決できない場合も削除せず`ORPHANED`にする。

CodeSnapshotは詳細CacheをGCした後も、VerificationやEvidenceのProvenanceに必要なmetadataを保持する。

```text
CodeSnapshot metadata

id
projectId
sourceKind
commitHash
workingTreeHash
createdAt
analysisResult
```

### 10.2 SQLiteへ保存する再構築可能Cache

```text
FileSnapshot
SymbolOccurrence
StructuralRelation

FeatureContext
FeatureContextChunk

Search Index
解析用中間表現
```

Cacheが破損または削除されてもUser Contextを失わない。Source Repositoryから再解析し、既存SourceAnchorへ再接続して復旧する。

### 10.3 SQLiteへ保存しない

```text
Source Code全文
AI API Credential本体
AIへ送信したPrompt全文
AI Context Payload全文

未保存Form
Dialog状態
Hover
Tooltip
一時Filter
Pane幅

Analyzer作業中Memory
Undo / Redo Stack
```

Undo / Redo StackはMVPではSession内だけ保持し、アプリ再起動後には復元しない。

## 11. 実装開始Gate

次の仕様設計Gateを満たしたため、Action Catalogの完全化を待たずPoC-0とArchitecture Spikeへ進める。

```text
✓ MVP Scope
✓ Screen / View / Overlay責務
✓ 7 Screens
✓ Command / Domain Event分離
✓ Analyzer State
✓ Active / Staging Snapshot
✓ PARTIAL条件
✓ 主要9 Entity State
✓ Field単位Write権限
✓ VerificationAttemptと競合Guard
✓ Selection invariant
✓ Global / Project Settings
✓ SQLite保存境界
✓ 中心E2E
```

MVP Vertical Slice実装は、PoC-0の必須Gate、[Architecture Spike](architecture-spike-plan.md)の必須Gate、ADR-001、ADR-002の確定後に開始する。ここでいう実装開始Gateは、追加の網羅的仕様化をBlocking条件にしないという意味であり、技術Spikeを省略する意味ではない。

## 12. 実装前に完全固定しない事項

次は実装とPoCの結果をもとに更新できるため、実装開始のBlocking条件にしない。

- 全Action Catalog
- 全Failure Code
- 全Undo / Redo操作
- Button配置
- UI文言
- Icon
- Pane幅
- Loading Animation
- Filter UI
- Tooltip
- 個別Actionの細かな命名
- Internal Component分割

主要E2Eが矛盾なく動き、データ所有権、状態、競合防止、復旧方針が守られていることを優先する。
