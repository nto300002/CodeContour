# UI-004 Project Hub 結果

Issue #20 の SCR-001 Project Hub を実装した結果を記録する。

## Decision

- Project Card は Project 名、言語、更新日時、Analysis 状態、接続状態を常に表示する。
- `Open` は保存済みの View / Selection を復元せず、解析済み Project は Workspace、未解析 Project は Initial Analysis へ遷移する。
- `Continue` は保存済みの Workspace View と Feature Selection を復元する。接続が `DISCONNECTED` の場合は、先に Repository Reconnect へ安全に遷移する。
- Project が0件の場合も、空の理由と `Register new project` 導線を表示する。登録開始時は Repository Setup へ遷移する。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 登録済み Project と最近の作業を俯瞰 | PASS | Card に識別情報、保存済みの View / Selection による `Recent work`、`Open` / `Continue` を表示する。 |
| Project 名・言語・更新日時・Analysis／接続状態 | PASS | `HubProject` の必須フィールドを Card に可視テキストとして表示する。 |
| 新規 Project、開く、続きから | PASS | `Register new project`、各 Card の `Open` と `Continue` を提供する。 |
| 続きからで保存済み Selection を復元 | PASS | Workspace View と Feature Selection を復元する E2E を追加した。 |
| 未解析 Project は SCR-003 へ遷移 | PASS | `hasActiveSnapshot: false` は `#/analysis`（Initial Analysis）へ遷移する E2E を追加した。 |
| DISCONNECTED は SCR-005 へ遷移 | PASS | `DISCONNECTED` Project は `#/repository/reconnect` へ遷移する E2E を追加した。 |
| 0件時は登録導線付き Empty | PASS | `No projects` EmptyState と登録ボタンから `#/repository/setup` へ遷移する E2E を追加した。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Project Card Component Test | PASS — 表示項目と `Open` / `Continue` callback を確認。 |
| 状態別遷移 Integration Test | PASS — READY、未解析、DISCONNECTED の遷移先を確認。 |
| 0件から登録開始まで E2E | PASS — Empty 表示から Repository Setup への hash 遷移を確認。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-004実装 | 判断 |
| --- | --- | --- | --- |
| 最近の作業 | Project Hub から直近の作業再開地点を選ぶ | 保存済み Workspace View と Feature Selection を `Continue` で復元 | 一致。日時順ソートや履歴一覧は固定仕様にないため対象外。 |
| 新規登録 | Project Hub から新規 Project 登録を開始 | UI は Repository Setup への遷移まで。実ファイルシステム選択・永続登録は次の Repository Setup の範囲 | 境界どおり。 |
| Project Card | Project の状態を俯瞰 | テキストと操作を優先した最小 Card。視覚デザイントークン、サムネイル、フィルタは未実装 | UI Mock は非規範的であり、機能要件を満たす最小実装を採用。 |
| 接続切断 | 切断時は復旧フローへ誘導 | Card 操作時に SCR-005 へ遷移し、既存の Reconnect 復帰制御を利用 | 一致。 |

## Result

GO
