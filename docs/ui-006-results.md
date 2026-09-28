# UI-006 Initial Analysis 結果

Issue #22 の SCR-003 Initial Analysis を実装した結果を記録する。

## Decision

- ScreenはAnalyzer / Mainが所有するRunのProjectionだけを表示し、RendererはExecutor Batchを受け取らず、Analysis Stateを成功へ変更しない。
- 進捗総数が渡されない場合は`Progress: Unknown`と表示し、割合を推測しない。
- Cancel CommandはMainがRun IDを発行した後だけ有効にし、用途限定Preload APIを通じてMain側`InitialAnalysisRunController.cancel()`へ委譲する。開始中はCancelを無効化して、IDなしのCancelを黙殺しない。CancelとRun切替による遅延Batchの拒否は既存`AnalysisBatchGate`が担当する。
- Workspace導線は`READY`または`PARTIAL`だけに表示する。Snapshotのない初回解析ProjectはCardのAnalyzer状態を投影し、既定`READY`を仮定しない。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 全Analysis Stateを表示 | PASS | PENDING / ANALYZING / READY / PARTIAL / FAILED / CANCELLED を状態、Phase、Files、Symbolsとともに表示する。 |
| 不明な進捗に虚偽の割合を表示しない | PASS | `completed`と`total`の両方がない限り`Progress: Unknown`を表示する。 |
| Cancel後の遅延Batchを反映しない | PASS | Run IDの発行前はCancelを無効化し、発行後のUI CancelがMain側Run Controllerへ委譲される。Cancel後とRun切替後の遅延BatchをBatch Gateが拒否する。 |
| READY／PARTIALから利用可能Viewへ進める | PASS | 両Stateだけに`Open available Workspace`を表示する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| State表示 Component Test | PASS — 全6State、未知進捗、状態ごとの操作を確認。 |
| Run切替／Cancel Integration Test | PASS — Cancel済みRunと置換済みRunの遅延Batchを拒否し、現RunのBatchだけを受理することを確認。 |
| 初回解析 E2E Test | PASS — 遅延したStart応答中はCancelが無効であること、Run ID確定後のUI CancelがMain Commandを呼び、Controllerが拒否する遅延Batchまで確認。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-006実装 | 判断 |
| --- | --- | --- | --- |
| 進捗 | 解析中の状況を表示 | Phase、Files、Symbolsを表示し、未計測値はUnknown | 虚偽の進捗率を避ける固定方針に一致。 |
| Cancel | 解析を中止できる | Run ControllerがBatch GateをCancelし、ScreenはCANCELLEDを投影 | MainがGuardを所有する境界に一致。 |
| バックグラウンド継続 | 作業を妨げずに継続 | Project Hubへ戻る操作を提供。解析実行はScreen操作で変更しない | 実Executor進捗通知は後続接続時に追加。 |
| READY / PARTIAL | 利用可能範囲へ進む | 両StateだけWorkspace導線を表示 | Snapshot可用性の固定境界に一致。 |

## Result

GO
