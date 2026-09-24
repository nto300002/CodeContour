# SQLite Driver Spike 完了計画

対象: SPIKE-002 / ADR-002 SQLite Driver Selection
現在の判定: `REWORK`

## 1. 結論

SQLite Driver選定を`GO`にするための残件は、次の四区分に分かれる。

1. AIが自律して実装・検証できる作業
2. AIが実装できるが、CIなど外部環境での実行が必要な作業
3. 人間の権限または秘密情報が必要な作業
4. 人間が採用方針を決定する作業

外部前提が未充足のままでも、コード側の安全境界は先に実装・テストできる。ただし、署名済み配布物での起動を成功として記録したり、ADR-002を`ACCEPTED`にしたりしてはならない。

## 2. 担当とコマンド実行可否の定義

| 区分 | AIが実行できるか | 人間が行うこと | 例 |
| --- | --- | --- | --- |
| A: AI自律実装 | はい。Repository内の変更とローカル検証だけで閉じる | 完了報告の確認 | TypeScript実装、unit / integration test、文書更新 |
| B: AI実行・外部実行待ち | 実装・設定追加までは可能。外部環境での実行結果取得はCI等が必要 | PR / workflowを実行可能な状態へ反映する | GitHub Actions workflow、Artifact検証 |
| C: AI補助・人間権限必須 | コマンドや設定案は作れるが、秘密情報や組織権限はAIに渡さない | Secret登録、証明書発行、Release権限付与 | Apple signing、notarization、GitHub Secret |
| D: 人間の意思決定必須 | 選択肢と根拠を提示できる | コスト・配布対象・採用候補を決定する | arm64 onlyかx64を含めるか、Driver採用 |

### 2.1 AIが自律実行するタスク（区分A）

| ID | タスク | AIが行う操作・コマンド | 入力 | 完了証跡 |
| --- | --- | --- | --- |
| A-01 | DB Serviceを追加する | `src/`へ`DatabaseService`とMain側Controllerを実装 | 既存`SqliteDriver`、`SqliteSnapshotService` | TypeScript型検査Green |
| A-02 | Single Writerを固定する | utilityProcess IPC Message型からDB path、SQL、Driver APIを除去 | Executorの既存Message protocol | utilityProcess入力が解析Batchだけであるテスト |
| A-03 | Main側の保存経路を接続する | `AnalysisBatchGate.accept()`成功後だけ`SqliteSnapshotService.acceptBatch()`を呼ぶ | run / snapshot / sequence情報 | 正常BatchがStagingへ1回だけ保存される統合テスト |
| A-04 | 拒否ケースを回帰保護する | cancelled / stale / duplicateケースのFixtureを追加 | `AnalysisBatchGate`とSQLite service | 拒否Batchによる追加SQLite保存が0件（Staging writer呼出なし） |
| A-05 | Active Snapshot保護を確認する | fail / cancel後にactive pointerが不変か検証 | Snapshot Fixture | active snapshot不変テスト |
| A-06 | Driver比較を保守する | `npm run measure:sqlite-driver`、`npm test`、`npm run typecheck`、`git diff --check`を実行 | 作業tree | JSON measurement、Greenログ |
| A-07 | Report / ADRを整合させる | 成功・失敗の範囲を文書へ反映する | 実行結果 | 実測と矛盾しないADR / Report |

AIはA-01からA-07を、資格情報を受け取らずにTDDで実装・検証できる。

### 2.2 AIが実装できるが、外部実行が必要なタスク（区分B）

| ID | タスク | AIが行う操作・コマンド | 外部側の前提 | 完了証跡 |
| --- | --- | --- | --- |
| B-01 | CI workflowを実装する | `.github/workflows/sqlite-driver-spike.yml`を追加・修正 | GitHub Actionsが有効 | workflow定義のレビュー |
| B-02 | macOS arm64 smokeを実行する | CIで`npm ci`、`npm run smoke:sqlite-packaged`を起動する設定を作る | `macos-14` runner、Node 24 | 完了: [Run 35961097858](https://github.com/nto300002/CodeContour/actions/runs/35961097858) の`COMPLETE` Artifact |
| B-03 | native rebuildを確認する | Forge / ASAR unpack構成を修正し再実行する | CIでElectron ABI向けrebuildが動く | 完了: `better-sqlite3`の配布物内ロード成功 |
| B-04 | 両Driverの配布物検証をGateする | 5回の起動とheartbeat p95検証をscript化する | arm64配布物を起動できるrunner | 完了: 両候補`COMPLETE`、p95 <= 100ms |
| B-05 | Report Artifactを検証する | `npm run verify:sqlite-spike`をCI stepに追加する | CI jobの結果取得 | 完了: build duration、size、全sampleを含むJSON |

AIはB-01からB-05のコードとworkflowを実装できる。実際の成功は、GitHub Actionsが対象Commitを実行した後にだけ確認できる。

### 2.3 人間の権限または秘密情報が不可欠なタスク（区分C）

| ID | タスク | AIが準備できるもの | 人間が行うこと | AIへ渡してよい情報 |
| --- | --- | --- | --- | --- |
| C-01 | GitHub Actions利用 | workflow、必要Secret名の一覧 | workflow実行権限、Repository設定の確認 | Run URL、Artifact結果。Secret値は渡さない |
| C-02 | Apple署名 | signing workflow、必要環境変数の説明 | Developer ID証明書・秘密鍵の発行とSecret登録 | Team ID、Bundle ID、Secretの**名前のみ** |
| C-03 | Notarization | notarize / staple stepの設定 | App Store Connect API KeyまたはApple ID認証情報をSecret登録 | Key ID、Issuer ID、Secret名。秘密鍵本文は渡さない |
| C-04 | Release / Artifact保存 | upload / release workflow | Release権限、保持期間、配布先を決定 | Release URL、対象Commit |

### 2.4 人間の判断が必要なタスク（区分D）

| ID | 判断 | 選択肢 | 判断基準 | 決定後にAIが行うこと |
| --- | --- | --- | --- | --- |
| D-01 | 対象Architecture | arm64 only / arm64 + x64 | MVP TesterにIntel Mac利用者がいるか | Forge matrixとGateを更新 |
| D-02 | Driver採用 | better-sqlite3 / node:sqlite | packaged Report、保守性、native module運用コスト | ADR-002を決定内容に更新 |
| D-03 | 署名をADR-002の必須Gateにするか | Spike段階で必須 / Release前Gate | 配布対象・利用者・リリース時期 | 完了条件とCI workflowを更新 |
| D-04 | heartbeat閾値 | 100ms維持 / 要件に応じて見直し | UI応答性のUX要件 | 根拠をADRへ記録しVerifierを更新 |

## 3. コード上で解決できること

| 作業 | 実施内容 | 完了証跡 | 状態 |
| --- | --- | --- | --- |
| 共通Driver境界 | `SqliteDriver` Interfaceを通して`node:sqlite`と`better-sqlite3`を交換可能にする | 両候補の契約テスト | 実装済み |
| 共通Schema | Drizzle logical schemaをMigration / Snapshot Serviceのテーブル定義に接続する | `sqlite-schema.test.ts` | 実装済み |
| SQLite基本契約 | versioned migration、FK、WAL、rollback、migration失敗からの回復 | 両候補のDriver contract test | 実装済み |
| Snapshot安全性 | bulk insert、atomic promotion、duplicate / cancelled / stale batch拒否 | Snapshot contract / service test | 実装済み |
| 開発時比較測定 | 同じService経由でMigration、bulk insert、promotion時間、DBサイズをJSONへ保存 | `npm run measure:sqlite-driver` | 実装済み |
| 配布物Smokeのfail-closed化 | package出力欠落、native load失敗、heartbeat閾値超過を成功扱いにしない | `npm run smoke:sqlite-packaged` の`FAILED` Report | 実装済み |
| Single Writer統合 | utilityProcess IPCにSQLite接続・DB file path・Driverを渡さず、Main DB ServiceだけがBatchを保存する | `main-database-service.test.ts` | 実装済み |
| Single Writer回帰保護 | Cancelled / stale / duplicate batchをMainの`AnalysisBatchGate`経由で拒否し、拒否Batchによる追加SQLite保存がないことを確認する | `main-database-service.test.ts` | 実装済み |
| ADR確定ロジック | `COMPLETE` Report以外ではADR-002を`ACCEPTED`へ更新できないよう文書・Verifierを維持する | Verifier / ADR review | 一部実装済み |

### 3.1 実装済み: Single Writer統合

1. `MainDatabaseService`が、IPC上で唯一のSQLite保存経路となるMain側Facadeである。
2. executor Messageは解析Batchだけを受け付け、DB path / SQL / Driver APIを含む入力を拒否する。
3. Main側Controllerは`AnalysisBatchGate.accept()`成功後だけ`MainDatabaseService.saveStaging()`を呼ぶ。
4. 統合テストで次を検証する。
   - 正常BatchはMain経由でのみStaging Snapshotへ保存される。
   - Cancelled Batchは`RUN_CANCELLED`となり、Staging writerを呼ばない。
   - Stale / duplicate BatchもStaging writerを呼ばず、既存SQLite保存を増やさない。
   - Active Snapshotは失敗・Cancel後も切り替わらない。

この範囲が保証するのは、アプリケーションIPC上のWrite責務境界である。utilityProcessのOSレベルのFilesystem権限や、配布物上での直接DB接続不能性はここでは主張しない。実SQLite／packaged appでの境界検証は区分Bの必須Gateとする。

## 4. コードだけでは完了できないこと

| 外部前提 | 必要なもの | 実施者が行うこと | 成功証跡 |
| --- | --- | --- | --- |
| macOS arm64 packaged smoke | GitHub Actionsの`macos-14` runner、Node 24 | workflowをpush / PRで実行する | Artifact内のpackaged smoke Reportが`COMPLETE` |
| Electron ABI向けnative rebuild | CI上の`npm ci`、Forge packaging | `better-sqlite3`がElectron ABI向けにrebuildされることを確認する | 配布物から`better-sqlite3`をロードしread/write成功 |
| 両候補の実配布物検証 | arm64配布物を実行できるCI環境 | `node:sqlite`と`better-sqlite3`を各5回起動する | 両候補が`COMPLETE`、heartbeat p95 <= 100ms |
| 署名 | Apple Developer Team、Developer ID Application証明書、秘密鍵 | 証明書・鍵をCI Secretへ安全に登録する | `codesign --verify`成功 |
| Notarization | App Store Connect API KeyまたはApple ID用認証情報 | notarize / staple workflowを設定する | notarization成功ログ、stapled app |
| 最終配布物の保持 | ArtifactまたはReleaseへの保存権限 | signed / notarized appとReportを保存する | Release / Artifact URLと対象Commit |

### 4.1 CIで実行する順序

1. `npm ci`
2. Driver / Snapshot contract tests
3. `npm run measure:sqlite-driver`
4. `npm run smoke:sqlite-packaged`
5. `npm run verify:sqlite-spike`
6. JSON ReportをArtifactへupload
7. 署名を導入した後は、署名・notarization済みappに対して同じSmokeを再実行する。

## 5. ADR-002を`ACCEPTED`にする基準

以下をすべて満たすまで、ADR-002のStatusは`PROPOSED`とする。

- Main側Single Writer統合テストがGreen
- macOS 14 / arm64 / Node 24のCIで測定とpackaged smokeがGreen
- Reportに両Driverの`COMPLETE`、非ゼロのpackage size・build duration、5 samplesのheartbeat p95が保存される
- `better-sqlite3`のnative moduleがASAR unpack後の配布物から実ロードできる
- `node:sqlite`も同じ配布物からSQLite read/writeできる
- 署名済み配布物を必須条件とする場合は、codesignとnotarizationの成功証跡が保存される
- ADRの選定理由は、成功したReportの値と実測範囲だけを根拠に記載する

## 6. 失敗時の分岐

| 失敗 | 対応 |
| --- | --- |
| `better-sqlite3`のnative load失敗 | Forge rebuild / ASAR unpack / Electron ABI / signing手順を修正する。解消不能なら`node:sqlite`を再評価する。 |
| `node:sqlite`がElectron runtimeで利用不能 | 対象Electron versionとの互換性を記録し、比較候補から除外する根拠をADRへ残す。 |
| heartbeat p95 > 100ms | Batch size、transaction粒度、DB Service配置を見直す。閾値だけを根拠なく緩和しない。 |
| Single Writerを迂回できる | utilityProcess APIからDB接続情報を除去し、Main Controller以外の保存経路を閉じる。 |
| 署名 / notarization失敗 | 証明書、Bundle ID、Team ID、entitlements、CI Secretの設定を確認する。SQLite Driver選定そのものの成功とは混同しない。 |

## 7. AIへ実装を依頼するための最小プロンプト

次のように依頼すると、区分Aを安全に開始できる。

```text
docs/sqlite-driver-completion-plan.md のA-01からA-05をTDDで実装してください。
SQLite接続・DB path・SQLをutilityProcessへ渡さず、Main側のDatabaseServiceだけが
AnalysisBatchGate通過後にSqliteSnapshotServiceへ保存する構成にしてください。
Cancelled / stale / duplicate batchの保存件数が0件である統合テストを追加し、
npm test、npm run typecheck、git diff --checkを実行してください。
```

区分Cの秘密情報は、AIへのプロンプト・Repository・ログに含めない。

## 8. 参照

- [Architecture Spike Plan](architecture-spike-plan.md)
- [Architecture Spike Report](architecture-spike-report.md)
- [ADR-002](ADR-002-sqlite-driver.md)
