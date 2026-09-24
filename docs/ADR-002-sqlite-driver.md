# ADR-002: SQLite Driver Selection

## Status

PROPOSED — packaged-app Gateの成功Reportを取得後に`ACCEPTED`へ更新する。

## Context

MVPのCanonical Data、Analysis Snapshot、Batch GateはSQLiteへ保存する。AnalyzerおよびRendererはSQLite Connectionを取得せず、Main側のSingle Writerだけが`SQLiteDriver`を利用する。

候補は`better-sqlite3`とNode標準の`node:sqlite`である。両者を同じDriver Interface、Drizzle logical schema、versioned migration、Snapshot Serviceで検証する。

## Required evidence

- Migration、foreign key、WAL、rollback
- 1,000件のAnalyzer Cache bulk insertとatomic Snapshot promotion
- duplicate / cancelled / stale Batchの拒否
- Electron ForgeのmacOS arm64配布物で両候補を実ロードするsmoke

## Measurement

`npm run measure:sqlite-driver` は同一の`SqliteSnapshotService`で両候補のMigration、bulk insert、promotion時間とDBサイズをJSONへ保存する。速度・サイズは候補選定の唯一の根拠にはしない。

`npm run smoke:sqlite-packaged` はForgeのASAR設定とnative module unpack pluginを使い、macOS arm64配布物から両候補を5回ずつロードしてSQLite read/writeを実行する。Reportにはpackage生成時間、配布物サイズ、各候補のMain Event Loop heartbeat遅延p95を保存する。heartbeatの許容値は100ms以下とする。

## Provisional decision

`better-sqlite3`を第一候補とする。ただし、選定を確定するのはCI上で上記の測定・packaged smokeがともに`COMPLETE`となってからである。`node:sqlite`はnative addon再buildが不要な代替候補として維持する。

## Consequences

- `better-sqlite3`採用時はElectron ABI向けrebuildとASAR unpackをCI Gateにする。
- Driver交換は`SqliteDriver` interfaceを通して行い、Domain Serviceは候補へ依存しない。
- SQLiteへのWriteはMain側のSingle Writerだけが所有する。

## Revisit condition

arm64配布物でnative moduleのロードに失敗する、または後続のSQLite / Active Snapshot統合でDriver差異が契約を破る場合、`node:sqlite`を同一Gateで再評価する。
