# ADR-001: Analyzer Executorの選定

Status: REWORK

Decision date: 2026-09-22

## Context

AnalyzerはRendererで実行せず、Main Event Loopを実用上停止させず、異常終了時にもElectron本体とActive Snapshotを維持しなければならない。比較対象はElectron `utilityProcess`とNode.js `Worker Thread`である。

両候補はAnalyzer結果を直接保存しない。`AnalysisResultBatch`はDB ServiceのSingle Writerへ渡し、`analysisRunId`、Staging Snapshot、sequence numberを検証する。Cancel済み、旧Run、重複Batch、Active Snapshot直接Writeは拒否する。

## Candidates

| 候補 | 物理境界 | 評価 |
| --- | --- | --- |
| Electron `utilityProcess` | Electron Mainと別Process | 有力候補（実行環境の再現待ち） |
| Node.js `Worker Thread` | 同一Node Process内の別Thread | 代替案として維持 |

## Measurements

同一のTypeScript Parser TaskへSmall（10 File / 1,200 declarations）とMedium（100 File / 12,000 declarations）を渡した。結果は[機械可読Report](adr-001-analyzer-executor-measurements.json)を正とする。これはPoC-0全Analyzerの性能値ではなく、候補間の同一Task比較である。

| 規模 | 候補 | 解析時間 | 子Process RSS | 親Event Loop最大遅延 | Message payload | IR |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Small | Worker Thread | 未測定 | 比較不能 | 未測定 | 44,621 bytes | 未確認 |
| Small | utilityProcess | 実行環境未充足 | 比較不能 | 未測定 | 44,621 bytes | 未確認 |
| Medium | Worker Thread | 未測定 | 比較不能 | 未測定 | 456,911 bytes | 未確認 |
| Medium | utilityProcess | 実行環境未充足 | 比較不能 | 未測定 | 456,911 bytes | 未確認 |

現在の通常実行環境ではElectron 44.4.3が`--version`のpreflight段階で`SIGABRT`（exit code 134）となる。したがって`npm run measure:executor`は`UTILITY_PROCESS_RUNTIME_UNAVAILABLE`としてfail-closedし、成功値をReport／採用根拠に残さない。成功・失敗のいずれでも子Processのexit code、signal、stdout、stderr、経過時間、OS、Node、Electron binaryを機械可読Reportへ保存する。RSSはWorker ThreadとutilityProcessで同じ測定単位ではないため、選定根拠に用いない。

## Decision

Analyzer Executorの選定は保留する。

`AnalysisBatchController`と`AnalysisBatchGate`により、Cancel済みRunのBatchを`RUN_CANCELLED`で拒否し、Executor由来のActive Snapshot書込み要求を拒否する設計・回帰テストはある。しかしutilityProcessを含むLifecycleを通常実行環境で再現できていないため、Crash分離・再fork・途中Cancel・Main応答性を確認済みとは扱わない。

`ACCEPTED / GO`の前提は、macOS上でElectron 44.4.3のapp binaryを起動できる実行環境で`npm run measure:executor`を実行し、Small／Medium、Crash後の同一Mainからの再fork、解析途中Cancel、`RUN_CANCELLED`、保存0件、起動済みMainのIPC往復20回以上・p95が100ms未満を含む`status: "COMPLETE"` Reportを保存することである。最大値もReportへ保存するが、utilityProcessが解析中にPONGを処理できない単発時間をMain UI停止と誤認しないため、品質Gateにはp95を用いる。前提外のOS、Electron version、署名／sandbox制約、またはpreflight失敗ではRunnerはfail-closedする。

## GO execution plan

1. GitHub Actionsの`Executor measurement`をmacOS 14／Node 24で実行する。
2. `npm run measure:executor`が既定の`docs/adr-001-analyzer-executor-measurements.json`を生成する。
3. `npm run verify:executor-measurement`がSmall／MediumのIR一致、Electron preflight、Crash後のMain応答・再fork、解析途中Cancel、`RUN_CANCELLED`、保存0件をfail-closedで検証する。
4. 成功・失敗を問わず既定ReportをCI Artifactとして保存する。レビューは成功したCommitのArtifactだけを根拠にする。
5. 成功Artifactを確認した後、ADRのStatusを`ACCEPTED`へ更新する。CIで失敗した場合はReportのpreflight／Lifecycle結果に従い、`REWORK`を維持する。

## Consequences

- Main ProcessはAnalyzer要求、Cancel、再起動、およびBatchのDB Serviceへの転送だけを担う。
- utilityProcessは読み取り専用Analyzer IRを返し、SQLite Connection・Active Snapshot Write権限を持たない。
- Batchの受入可否はutilityProcessの自己申告ではなくDB Service側のGuardで判定する。
- Message payloadがMediumで約457KBであるため、MVP実装ではBatch size、backpressure、必要時の圧縮を計測しながら決める。

## Rejected Alternative

Worker ThreadはIR一致、Cancel、Crash後の親継続、再起動の条件を満たした。しかしMain Processとメモリ空間を共有するため、AnalyzerのMemory異常をより強く隔離できるutilityProcessを優先する。Worker ThreadはElectron外のCLI Analyzerや、低コストな補助計算で再利用できる。

## Revisit Condition

次のいずれかが発生した場合に再評価する。

- 実PoC-0 AnalyzerでutilityProcessのIPC／起動コストが操作応答性を損なう。
- Electron ForgeのPackaged AppでutilityProcess起動、sandbox、署名、macOS arm64配布が成立しない。
- 実AnalyzerのMemory、Crash、Cancel、Batch backpressureがこのSpikeの前提を越える。
- Worker Threadに採用判断を覆す明確な安定性・保守性の優位が確認される。
