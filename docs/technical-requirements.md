# Technical Requirements v1.0

[ドキュメント一覧](README.md) | [固定MVP](mvp-scope.md) | [MVP実装境界](mvp-implementation-boundaries.md) | [Architecture Spike](architecture-spike-plan.md)

```text
Status: FIXED BOUNDARIES / EXPLICIT SELECTIONS PENDING
Decision: TECHNICAL-REQUIREMENTS-2026-09-17
```

> 本文書は、MVPの技術構成、プロセス境界、Security Boundary、永続化責務の正規仕様である。論理・セキュリティ・責務境界は固定し、Analyzer ExecutorとSQLite Driverの物理実装だけをArchitecture Spikeで選定する。

## 1. 確定状態

| 領域 | 状態 |
| --- | --- |
| Architecture Boundary | FIXED |
| Electron + React + TypeScript | FIXED |
| TypeScript Compiler API | FIXED |
| SQLite + Drizzle | FIXED |
| DB Single Writer | FIXED |
| Active / Staging Snapshot | FIXED |
| Analyzer Batch Protocol | FIXED |
| SourceAnchor責務 | FIXED |
| Electron Security Boundary | FIXED |
| Electron Forge | FIXED |
| CredentialStore interface | FIXED |
| MVP対象OS | macOS only: FIXED |
| macOS対象Architecture | DECISION REQUIRED（arm64 only推奨） |
| Analyzer Executor | SPIKE REQUIRED → FIX |
| SQLite Driver | SPIKE REQUIRED → FIX |
| AI Provider | MVP実装時に決定可 |
| Maker / 配布形式の細部 | 配布準備時に決定可 |

```text
Architecture Boundary
→ FIXED

Process Topology / SQLite Driver
→ Architecture Spikeの結果でFIXED
```

WindowsはPOST-MVPとする。macOS Architectureは実装開始前に決定する。自分自身と少人数での検証なら`arm64 only`を推奨し、Intel Mac利用者をMVP Testerへ含める場合だけ`arm64 + x64`とする。

## 2. 基本技術構成

```text
Desktop / Shell: Electron
UI: React + TypeScript
Build: Vite
Packaging: Electron Forge

Analyzer: TypeScript Compiler API
Analyzer IR: CodeContour独自IR

Local DB: SQLite
Schema / Migration: Drizzle
Boundary Validation: Zod
UI / Selection State: Zustand
```

ZustandはSelection、Pane、Filter、未保存UI状態などに限定する。Domain Dataの正本をZustandへ複製せず、SQLiteとProjectionを参照する。

Cloud BackendはMVPに置かない。AIを利用しない場合も、解析、Feature / Process / Data Flow、Source Navigation、説明保存を利用可能とする。

## 3. Electron Process Boundary

```text
Renderer
  ↓ 用途別Typed API
Preload
  ↓ validated IPC
Electron Main
  ├ Command / Guard / Human Write Gateway
  ├ DB Service Interface
  ├ CredentialStore Interface
  ├ AI Provider Interface
  └ Analyzer Executor Interface
```

Rendererから次へ直接アクセスしない。

```text
Filesystem
child_process
SQLite
Repository contents
API Credential
raw ipcRenderer
Electron shell
```

AnalyzerはRendererで実行せず、Main Event Loopを占有しない。異常終了してもElectron本体とActive Snapshotを利用可能にする。実行方式は`utilityProcess`を基準案とし、Worker Threadとの比較後に確定する。

## 4. Electron Security Boundary

次を必須とする。

```text
sandbox = true
contextIsolation = true
nodeIntegration = false

用途別Preload APIのみ公開
IPC input / outputをZodで検証
IPC sender / frameを検証
Content Security Policyを設定
外部Navigationを制限
New Windowを制限
External URLをAllowlist制御
Electron FusesをPackaging時に設定
```

公開APIはCommandの用途ごとに定義する。

```text
window.codeContour.project.open(...)
window.codeContour.analysis.start(...)
window.codeContour.feature.create(...)
window.codeContour.verification.request(...)
```

次のような汎用能力は公開しない。

```text
window.ipcRenderer
window.fs
window.db
window.shell
```

IPCはSerializableなDTO、versioned schema、明示的なError Envelopeを使用する。大量の解析結果をRendererへ一括転送せず、ProjectionをQuery / Paginationで取得する。

## 5. DB Single Writer

SQLite Connection、Write順序、Transaction境界は単一のDB Serviceが所有する。

```text
Analyzer
  ↓ AnalysisResultBatch
DB Service
  ↓ Single Writer / Transaction
SQLite
```

AnalyzerとRendererはSQLite Connectionを持たない。Canonical DataとAnalyzer Cacheを同じWrite境界で管理する。

MVPではDB ServiceをMain側のInterfaceとして開始できる。ただし物理配置を交換可能にし、同期SQLite処理がMain Event Loopを許容以上に停止させる場合は別Processへ移せる構造にする。

DBでは少なくとも次を有効にする。

```text
foreign_keys
WAL
Transaction
versioned migration
```

Production DBへ`push`形式でSchemaを直接適用しない。生成済みMigrationをVersion管理し、起動時の適用失敗から既存DBを復旧できるようにする。

## 6. Analyzer Batch Protocol

AnalyzerからDB Serviceへ渡す単位を次に固定する。

Projectごとに`ANALYZING`のRunは最大1つとし、Projectは実行中のRunとStaging Snapshotを明示的に指す。

```text
Project.currentAnalysisRunId
Project.currentStagingSnapshotId
```

新しいRunを開始する前に既存Runを終了またはCancel状態へ遷移させる。Runの開始、上記Pointerの設定、Staging Snapshotの作成は同じTransactionで行う。

```text
AnalysisResultBatch

analysisRunId
stagingSnapshotId
sequenceNumber
schemaVersion
payload
```

`sequenceNumber`は同一`analysisRunId`内で単調増加する。DB Serviceは`(analysisRunId, sequenceNumber)`を一意に扱い、同じBatchが再送されても二重反映しない。

DB ServiceはBatch受信時にすべてのGuardを確認する。

```text
AnalysisRun.status == ANALYZING

batch.analysisRunId
== Project.currentAnalysisRunId

batch.stagingSnapshotId
== Project.currentStagingSnapshotId

stagingSnapshotId
!= Project.activeCodeSnapshotId

sequenceNumber is unprocessed
```

1つでも不成立ならBatchを保存せず破棄する。Analyzer自身の状態申告を信頼境界にしない。

この規約により、Cancel後、Analyzer再起動後、旧Runの遅延、重複送信による結果混入を防ぐ。Batch size、Backpressure、圧縮方式は計測結果をもとに実装時に調整できる。

## 7. Snapshot切替

AnalyzerはActive Snapshotを直接変更しない。解析結果はStaging Snapshotへ保存し、`READY`または`PARTIAL`成立後に1 TransactionでActiveへ切り替える。

```text
BEGIN
Staging Snapshotを確定
Project.activeCodeSnapshotId = stagingSnapshotId
Project.currentAnalysisRunId = null
Project.currentStagingSnapshotId = null
COMMIT
```

`FAILED`または`CANCELLED`ではStagingを破棄し、current Pointerを解除し、Active Snapshotを維持する。詳細状態とPARTIAL条件は[MVP実装境界](mvp-implementation-boundaries.md)を正規仕様とする。

## 8. SourceAnchorとAnalyzer Cache

```text
SourceAnchor
= Stable Identity
= Canonical

SymbolOccurrence
= Snapshot上の解決結果
= Rebuildable Cache
```

SourceAnchorの安定ID、identity hints、現在のresolution projectionは永続化する。Snapshotごとの実体、位置、解決履歴はSymbolOccurrenceとして保持する。

```text
SourceAnchor.currentResolutionState
→ 現在状態のProjection

SymbolOccurrence by Snapshot
→ Snapshotごとの解決結果
```

再解析で解決できなくてもSourceAnchorを削除せず`ORPHANED`にする。後続解析で再接続できた場合は`RESOLVED`へ戻す。

CodeSnapshotのID、fingerprint / commit、provenanceは永続化する。FileSnapshot、SymbolOccurrence、StructuralRelation、解析用中間表現は再構築可能Cacheとする。

## 9. SQLite Driver Boundary

Driver Interfaceを固定し、実装をArchitecture Spikeで決定する。

```text
SQLiteDriver interface: FIXED

第一候補: better-sqlite3
比較候補: node:sqlite
```

選定ではMigration、WAL、Foreign Key、Transaction、Bulk Insert、Atomic Snapshot切替、Electron Forge配布物上の起動を確認する。開発モードだけの動作を採用条件にしない。

## 10. CredentialとAI

Credential本文をSQLiteへ保存しない。

```text
CredentialStore interface

macOS
→ Keychain Adapter

SQLite
→ provider
→ credentialReferenceId
→ configured
```

具体的なKeychain Access Libraryは実装時に選択できる。CredentialをRendererやAI Contextへ渡さない。

AIはCloud APIを利用できるが、MVPではUser Explanation Verificationだけを担う。AIはDBへ直接Writeせず、VerificationAttemptへ紐づく結果を返す。SYSTEMがRevision、Snapshot、Anchor、AttemptのGuardを確認した場合だけ反映する。

Source全文、Prompt全文、AI Context Payload全文はログまたはSQLiteへ保存しない。

## 11. PackagingとDistribution

```text
GitHub Actions
↓
Test
↓
Build
↓
Electron Forge
↓
Sign / Notarize
↓
GitHub Releases
```

外部MVP配布物は署名・Notarizationを行う。Credential Storeの受入試験には、一貫したApplication Identityを持つ署名済みTest Buildを使用する。自動更新はPOST-MVPとする。

## 12. 技術受入試験

- RendererからFilesystem、SQLite、raw Electron APIへ直接到達できない
- 未許可IPCと不正Payloadを拒否できる
- 旧Analysis Run、Cancel済みRun、重複Batchを保存しない
- 再解析失敗後もActive Snapshotを利用できる
- Cache削除後もUser ContextとSourceAnchorが残る
- 解決不能なSourceAnchorが削除されず`ORPHANED`になる
- 古いVerification結果が`STALE_RESULT`になる
- Analyzer異常終了後もアプリを継続利用できる
- Migration失敗時に既存DBを破壊しない
- Forgeで作成した対象Architecture向け配布物でSQLite Driverが起動する

## 13. 実装前に完全固定しない事項

- Analyzer IRの全Field
- IPC APIの最終粒度
- AnalysisResultBatchの最適サイズ
- Cache保持期間
- SQLite Driver内部の最適化
- Keychain Access Library
- AI Provider
- Forge Makerと配布形式の細部
- CSP文字列の最終形
- 自動更新
- Windows対応
- UI Component分割

## 14. 参考資料

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron Packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Drizzle SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
- [better-sqlite3 Electron troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)
