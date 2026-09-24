# ADR-002: SQLite Driver Selection

## Status

ACCEPTED — Driver選定のSpike Gateは、macOS arm64の未署名packaged smokeで完了した。署名・notarizationはMVP User Test配布および一般公開のRelease Gateとする。

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

2026-09-24に[GitHub Actions Run 35961097858](https://github.com/nto300002/CodeContour/actions/runs/35961097858)で実行した結果は次のとおり。

| Environment | Package build | Package size | better-sqlite3 p95 | node:sqlite p95 |
| --- | ---: | ---: | ---: | ---: |
| macOS 14 / arm64 / Node 24.20.0 | 6,970ms | 543,380,370 bytes | 26.49ms | 30.16ms |

両候補は5/5 sampleで`COMPLETE`となり、100msのheartbeat Gateを満たした。`better-sqlite3`はASAR unpack済み配布物からnative moduleをロードしてSQLite read/writeに成功した。

## Provisional decision

`better-sqlite3`を採用する。CI上で上記の測定・packaged smokeがともに`COMPLETE`であり、ASAR-unpacked native moduleを含むmacOS arm64配布物でSQLite read/writeを確認した。`node:sqlite`はnative addon再buildが不要な代替候補として維持する。

## Consequences

- `better-sqlite3`採用時はElectron ABI向けrebuildとASAR unpackをCI Gateにする。
- Driver交換は`SqliteDriver` interfaceを通して行い、Domain Serviceは候補へ依存しない。
- SQLiteへのWriteはMain側のSingle Writerだけが所有する。
- 開発・自分用BuildとPoC技術者向け一時配布は未署名を許容する。ただしGatekeeper警告を許容する利用者に限定する。
- MVP User Test配布とGitHub Releasesでの一般公開は、Developer ID Application署名とnotarizationを必須にする。

## Revisit condition

arm64配布物でnative moduleのロードに失敗する、後続のSQLite / Active Snapshot統合でDriver差異が契約を破る、または署名済み配布物でnative moduleのロードに失敗する場合、`node:sqlite`を同一Gateで再評価する。
