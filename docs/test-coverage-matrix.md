# MVP テスト網羅表

[開発要件](development-requirements.md) の5層と E2E-01〜05を、テスト名と実行環境へ対応づける。テスト件数はコード網羅率を示さない。下表は2026-09-29のコミット `49c216f` に対する [PR Gate](https://github.com/nto300002/CodeContour/actions/runs/36523793725) の `test-coverage-by-layer` Artifactの値。実行環境によって計測値が変わるため、各Commitの値はそのCI Artifactを正とする。

## 実行方法と基準値

| 実行 | 確認すること | 環境 |
| --- | --- | --- |
| `npm test` | Domain、Analyzer Fixture、SQLite、IPC handler、happy-dom UI | Node / Vitest |
| `npm run test:coverage` | 上記を V8 Coverage で再実行し、`coverage/coverage-summary.json` と `coverage/coverage-by-layer.json` を生成 | Node / Vitest。計測負荷を考慮して2 Worker、30秒 Timeout |
| `npm run smoke:electron-app` | 実 Window、Preload、IPC、SQLite、実 Repository Fixture、アプリ再起動 | macOS。先に `npm run build:main` と `npm run build:renderer` を実行 |
| `npm run test:e2e:ui` | 画面遷移と操作の UI E2E Suite | happy-dom。実 Electron の代替ではない |

Coverage対象は `src/**/*.{ts,tsx}` とRootの `*.cjs`。Test、Fixture、生成物は含めない。Native Electron Smokeは別Processなので V8 Coverage の数値には含まれない。Branch Coverage は安全上重要な失敗経路を優先して改善し、単一の総合率だけで合否を決めない。

| 層 | 対象File | Statements | Branches |
| --- | ---: | ---: | ---: |
| Domain | 9 | 428 / 433 = 98.85% | 291 / 342 = 85.09% |
| Analyzer | 8 | 658 / 703 = 93.60% | 445 / 524 = 84.92% |
| Persistence | 7 | 474 / 482 = 98.34% | 175 / 196 = 89.29% |
| Main IPC / Architecture | 6 | 176 / 325 = 54.15% | 71 / 105 = 67.62% |
| Renderer | 12 | 632 / 676 = 93.49% | 438 / 505 = 86.73% |

Main IPC の低い数値には、Production の `electron-main.cjs` と `preload.cjs` が Vitest Process 内で実行されないことが含まれる。Native Smoke はこれらの実境界を通すが、上の数値に加算しない。

## 5層の対応

状態は「実装済み」「機能待ち」「未検証」を用いる。一つの層のすべての振る舞いが実装済みという意味ではなく、行に示したケースの状態を表す。

| 層 | 実装済みのテストと環境 | 機能待ち・未検証のケース |
| --- | --- | --- |
| Domain | `test/feature-service.test.ts`、`process-service.test.ts`、`data-flow-service.test.ts`、`main-project-model-service.test.ts`：Node Unit / SQLite Integration | 機能待ち：TOMBSTONEと接続Flow・Evidenceの保持 [#58](https://github.com/nto300002/CodeContour/issues/58)、Guard／Rollback後の Domain Event [#62](https://github.com/nto300002/CodeContour/issues/62) |
| Analyzer Fixture | `test/repository-reader.test.ts`、`symbol-index.test.ts`、`relation-analyzer.test.ts`、`reference-analyzer.test.ts`、`call-analyzer.test.ts`、`analyzer-approved-file-consistency.test.ts`：一時Repository Fixture | 機能待ち：実解析から READY／PARTIAL まで [#46](https://github.com/nto300002/CodeContour/issues/46)、[#49](https://github.com/nto300002/CodeContour/issues/49)。別Gate：固定Commitの実Repository精度監査 |
| Persistence Integration | `test/sqlite-driver-contract.test.ts`、`sqlite-snapshot-service.test.ts`、`sqlite-user-model-store.test.ts`、`main-project-model-runtime.test.ts`：実SQLite | 機能待ち：Batch schemaVersion・順序・PARTIAL Gate [#49](https://github.com/nto300002/CodeContour/issues/49)、失敗終了のDB更新失敗 [#59](https://github.com/nto300002/CodeContour/issues/59)、User Context／SourceAnchor Cache再構築 [#51](https://github.com/nto300002/CodeContour/issues/51) |
| Architecture | `test/renderer-boundary.test.ts`、`project-model-ipc.test.ts`、`initial-analysis-ipc.test.ts`、`electron-runtime-lifecycle.test.ts`：静的検査／handler Mock／実SQLite。`smoke:electron-app`：実 Electron | 機能待ち：sender／subframe、不正Payload、Navigation／CSP拒否 [#45](https://github.com/nto300002/CodeContour/issues/45) |
| E2E Acceptance | `test/*.e2e.test.tsx`：happy-dom。`smoke:electron-app`：実 Window と実 Repository | 未検証：配布物上の全UI操作。主要 Screen／Recovery の完成 [#32](https://github.com/nto300002/CodeContour/issues/32) |

## MVP E2E-01〜05

| 要件 | 現在のテスト | 状態・残件 |
| --- | --- | --- |
| E2E-01 Repository → Feature | `test/repository-setup.e2e.test.tsx`、`project-hub.e2e.test.tsx`、`smoke:electron-app` | 実装済み：実境界で登録・解析・Feature保存。UI操作だけでの全経路は未検証 [#32](https://github.com/nto300002/CodeContour/issues/32) |
| E2E-02 Feature → Process → Code | `test/process-data-flow.e2e.test.tsx`、`workspace.e2e.test.tsx` | 機能待ち：実 Code Viewer と Definition 表示 [#26](https://github.com/nto300002/CodeContour/issues/26) |
| E2E-03 Data Flow | `test/process-data-flow.e2e.test.tsx`、`smoke:electron-app` | 実装済み：FlowとEvidenceの保存・再起動後復元。すべてのUI操作のNative E2Eは未検証 |
| E2E-04 User Explanation | 対応テストなし | 機能待ち：保存、明示Verification、AIが本文を変更しないこと [#27](https://github.com/nto300002/CodeContour/issues/27)、[#32](https://github.com/nto300002/CodeContour/issues/32) |
| E2E-05 STALE | 対応テストなし | 機能待ち：関連説明だけSTALEにする [#56](https://github.com/nto300002/CodeContour/issues/56) |

## 実Repository監査とCI分担

通常の `npm test` では `test/real-repository-measurement.test.ts` の環境依存2件をスキップする。固定Commitと期待Relation Manifestが利用可能な監査環境では、次を設定して `npm run measure:repository` を実行する。

```text
CODECONTOUR_REAL_REPOSITORY_ROOT
CODECONTOUR_REAL_REPOSITORY_ID
CODECONTOUR_REAL_REPOSITORY_COMMIT
CODECONTOUR_REAL_TSCONFIG（省略時 tsconfig.json）
CODECONTOUR_REAL_EXPECTED_RELATIONS
CODECONTOUR_REAL_MEASUREMENT_OUTPUT
```

出力 JSON を対象CommitのRelease受入記録として保存し、FP / FN が0であることを確認する。監査用RepositoryとManifestは現在CIへ配布されていないため、通常PRでは実行しない。外部MVP配布前には固定Commitの監査結果をRelease Gateとして確認する。

PR共通Gateは Test、Coverage、Type Check、Build、実 Electron Smokeを実行する。`main` と `v*` Tag の Acceptance Workflow は happy-dom の全UI E2Eと実 Electron Smokeを実行する。機能待ちのケースは対応Issueの受入条件を満たした時点でこの表を更新する。
