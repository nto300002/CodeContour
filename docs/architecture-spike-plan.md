# Architecture Spike Plan

[ドキュメント一覧](README.md) | [Technical Requirements](technical-requirements.md) | [PoC-0正式仕様](poc-0-spec.md)

```text
Status: REQUIRED
Decision: ARCHITECTURE-SPIKE-2026-09-17
```

> 本Spikeは、Technical Requirements v1.0で未確定とした物理実装を選定する。PoC-0とは目的、合否、結果レポートを分離する。

## 1. 目的

次の2項目をMVP実装前に決定する。

```text
ADR-001 Analyzer Executor Selection
ADR-002 SQLite Driver Selection
```

論理境界、DB Single Writer、Analyzer Batch Protocol、Security Boundaryは比較対象ではなく、両候補が守る必須条件である。

## 2. PoC-0との分離

```text
PoC-0 Gate
────────────────
TypeScript解析
Structural Relation / UNKNOWN
Feature / Process / Symbol
Data Flow Evidence
Source Navigation
解析精度と性能傾向
```

```text
Architecture Spike Gate
────────────────
Electron Process Topology
SQLite Driver
DB Single Writer
Native Module Packaging
Electron Security Boundary
Packaged App起動
```

Architecture Spikeの失敗をPoC-0のAnalyzer技術評価の失敗として扱わず、PoC-0の失敗をSQLite Driver選定の失敗として扱わない。並行実施は許可するが、結果レポートとGateを統合しない。

## 3. Spike A: Analyzer Executor

### 比較候補

```text
Baseline: Electron utilityProcess
Alternative: Node.js Worker Thread
```

### 共通Fixture

- PoC-0と同じSmall Repository
- PoC-0と同じMedium Repository
- 同一のTypeScript Compiler設定
- 同一のAnalyzer IR出力条件

### 必須Gate

- Main Event Loopを実用上Blockingしない
- Analyzer Crashでアプリ本体が終了しない
- Cancelできる
- Cancel後のBatchがDB Serviceで拒否される
- Analyzerを再起動できる
- Medium Repositoryを許容Memory内で解析できる
- Active Snapshotへ直接Writeしない

### 計測

```text
解析時間
Peak memory
Main UI responsiveness
Crash isolation
Message転送コスト
停止 / 再起動の容易さ
実装・テスト複雑度
```

数%の速度差だけでWorker Threadを選ばない。速度が同等ならCrashとMemoryの分離が強い方式を優先する。

## 4. Spike B: SQLite Driver

### 比較候補

```text
better-sqlite3
node:sqlite
```

両候補とも同じ`SQLiteDriver` Interface、Drizzle Schema、Migration、DB Serviceから利用する。

### 必須Gate

- Versioned Migrationが成功する
- `foreign_keys`が有効になる
- WALが動作する
- Transaction rollbackが成功する
- Analyzer CacheのBulk Insertが成立する
- Active Snapshotを1 TransactionでAtomic切替できる
- `(analysisRunId, sequenceNumber)`の重複を拒否できる
- Cancel済み・旧RunのBatchを拒否できる
- Electron ForgeのPackaged Appで起動する
- 決定済みのmacOS対象Architectureで動作する

開発モードでの動作だけではGate通過としない。`better-sqlite3`ではElectron向けRebuild、ASAR Unpack、未署名のmacOS arm64配布物でのNative Module Loadを確認する。Developer ID署名・notarization済み配布物での確認は、MVP User TestおよびGitHub Releasesでの一般公開前のRelease Gateとする。MVP Testerが自分自身と少人数だけなら`arm64 only`を推奨し、Intel Mac利用者を含む場合だけx64もGateへ追加する。

### 計測

```text
Migration時間
Bulk Insert時間
Snapshot切替時間
Main Event Loopへの影響
Packaged App size
Build / Packagingの複雑度
Failure recovery
```

## 5. Security確認

Spike用アプリでも次を無効化しない。

```text
sandbox = true
contextIsolation = true
nodeIntegration = false
```

Rendererへraw `ipcRenderer`、Filesystem、SQLiteを公開しない。IPC入出力とSenderを検証し、Analyzer / DB操作は用途別Preload APIだけから要求する。

## 6. 成果物

```text
architecture-spike-report.md

ADR-001-analyzer-executor.md
ADR-002-sqlite-driver.md
```

各ADRには少なくとも次を記録する。

```text
Status
Context
Candidates
Measurements
Decision
Consequences
Rejected Alternative
Revisit Condition
```

## 7. 完了条件

```text
PoC-0 Gate PASS
+
Architecture Spike A PASS
+
Architecture Spike B PASS
+
ADR-001 ACCEPTED
+
ADR-002 ACCEPTED
↓
MVP Vertical Slice実装開始
```

Spike結果が必須Gateを満たさない場合、Architecture Boundaryを崩さず別のExecutorまたはDriverを再評価する。
