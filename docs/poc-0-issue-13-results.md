# POC-012 Small / Medium Repository計測結果

## 再実行

`npm run measure:poc-0` はSmall（1,200 LOC）とMedium（12,000 LOC）の生成TypeScript Repositoryを同一条件で解析し、[機械可読Report](poc-0-issue-13-measurements.json)を保存する。Fixture Testは保存済みJSONの再読込可能性も検証する。

## 計測項目

| 規模 | LOC | File | 記録する値 |
| --- | ---: | ---: | --- |
| Small | 1,200 | 10 | Index時間、全解析時間、processMaxRSS、Symbol数、Relation数、UNKNOWN数／比率、部分失敗 |
| Medium | 12,000 | 100 | Index時間、全解析時間、processMaxRSS、Symbol数、Relation数、UNKNOWN数／比率、部分失敗 |

`measureTypeScriptProject()`は、Repository Readerの許可済みApplication Fileのみを母数として測定する。Symbol Indexが成立しない場合は`FAILED`、それ以外のAnalyzer失敗またはparse-failed Fileは利用可能な結果を残して`PARTIAL`とする。

変動する実測値、Node version、platform、測定方法は保存済みJSONを正とする。`processMaxRSSBytes`はNodeプロセス起動後の最大RSSであり、Repository単位のisolated Peak memoryではない。Small／Mediumを比較するPeak memory指標としては用いない。

## 精度・部分失敗

- Unsupported computed callは`UNKNOWN`として件数へ記録する。
- parse-failed Fileが1件あっても他Fileの解析を継続し、`SYMBOL_INDEX`の部分失敗としてFile名を記録する。
- 実Repositoryでは、固定Commitと`auditScopes`を持つ監査契約により、Scope内のAnalyzer出力だけを`type / from / to / resolution / reason / syntaxCategory`で照合する。これは全Relation精度の主張ではない。
- Small／MediumともTP 2、FP 0、FN 0、UNKNOWN 1。Relation Reviewには全3件を保存し、確定CallとValue ReferenceをTP、computed Callを`DYNAMIC_PROPERTY_ACCESS / UNKNOWN`として分類する。
- FPは0件であり、全確定Relationを保存済みReportの`relationReview`で確認できる。
- actual UNKNOWNもexpectedとの完全一致が必要である。不一致のUNKNOWNは`FP`、対応する期待Relationは`FN`としてRelation Reviewへ残す。

## P0 Gate Report

| Gate | 状態 | 根拠 |
| --- | --- | --- |
| P0-01〜P0-06 | PASS | Repository ReaderのRoot、tsconfig、Ignore、paths、対象File Fixture。 |
| P0-07〜P0-09 | PASS | Symbol IndexのFunction / Class / Method / Interface / Type Alias Fixture。 |
| P0-10〜P0-11 | PASS | Import / Re-exportとDefinition Location Fixture。 |
| P0-12〜P0-16 | PASS | Static Reference、Call、Resolution分類とMetric Fixture。 |
| P0-17〜P0-20 | PASS | Feature / Process / Symbol Link / Data Flow EvidenceのE2E Fixture。 |
| P0-21 | PASS | Feature → Process → Symbol → Source Navigation Fixture。 |
| P0-22 | GO | 固定CommitのSmall / Medium実Repository測定は`COMPLETE`で完了し、致命的停止・部分失敗はない。事前定義した代表ScopeでImport、Call、Reference、UNKNOWNを監査し、FP / FNは0件。これは全Relation精度ではなく、PoC-0で固定した代表Scope監査の達成である。 |

## 実Repository測定

- `measure:repository` はrepository、commit、非空`auditScopes`、各expected Relationの`type / from / resolution / syntaxCategory`を必須とし、`UNREVIEWED`、FP、FN、またはReview内のFP/FNを検出した場合はfail-closedで失敗する。Scope内に期待Relationがゼロのケースも監査できる。
- Small: `nto300002/CodeContour`、Commit `e90b325f841fc2d85e9c7ab93f76260850b4eca6`、2,324 LOC／22 files／`COMPLETE`。監査契約はImport、Type / Value Reference、INFERRED interface-member Call、reason付きUNKNOWN Callの5 Scopeを定義し、TP 10／FP 0／FN 0／UNKNOWN 1。詳細は`poc-0-issue-13-real-small.json`を参照する。
- Medium: `nto300002/keikakun_front`、Commit `6664e5442bcc580885d216a332a3769a1bb18384`、28,648 LOC／210 files／`COMPLETE`。テスト・E2E・Notice Featureを除くApplication Scopeであり、使用した[sidecar tsconfig](poc-0-issue-13-keikakun-front-tsconfig.json)を保存する。監査契約はImport、Value Reference、RESOLVED Call、reason付きUNKNOWN Callの5 Scopeを定義し、TP 6／FP 0／FN 0／UNKNOWN 1。詳細は`poc-0-issue-13-real-medium.json`を参照する。

## 判定

GO — 生成Small / Mediumの計測、保存済みJSON、TP / FP / FN / UNKNOWNのRelation Review、parse-failed File継続に加え、固定Commitの実Repositoryで事前定義した代表Scopeを監査済みである。PoC-0は全Relation精度を主張せず、代表Scope以外は既知の未監査範囲としてMVPで拡張する。
