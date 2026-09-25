# UI-003 共通状態表示 結果

Issue #19 の Loading / Empty / Error / Retry と分析状態を、Renderer 専用の共通コンポーネントとして実装した結果を記録する。

## Decision

- `AnalysisStatePanel` は分析状態を表示するだけで、Route・Screen・Selection を所有または変更しない。
- `FAILED` と `CANCELLED` の Retry は呼び出し元へ委譲する。呼び出し元が状態を `ANALYZING` に更新しても、現在の Screen と Selection は維持する。
- `PARTIAL` は利用可能な範囲と利用不能な範囲を別々の見出しとリストで表示する。
- `EmptyState` は空の理由と次の操作を表示し、`StatusBadge` は状態名を可視テキストと accessible name の両方で表示する。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 状態ごとの意味と推奨操作を区別 | PASS | 6つの Analysis State に title と recommended action を固定する。 |
| PARTIAL の利用可能／不足範囲を表示 | PASS | `Available` / `Unavailable` の独立リストを表示する。 |
| Recoverable Error で Screen / Selection を維持 | PASS | Retry integration test が Workspace / Feature selection を維持したまま `ANALYZING` へ遷移することを確認する。 |
| 色だけに依存しない状態識別 | PASS | 見出し、可視状態名、ARIA `status` / `alert`、accessible name を提供する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| 全状態 Component Test | PASS — Empty と PENDING / ANALYZING / READY / PARTIAL / FAILED / CANCELLED を確認。 |
| Retry Integration Test | PASS — Retry 後も Screen と Selection を維持する。 |
| Accessibility Test | PASS — `status` / `alert` role、状態名、Retry button の accessible name を確認。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-003実装 | 判断 |
| --- | --- | --- |
| Loading | 解析中であることと推奨操作を示す | `PENDING` / `ANALYZING` を共通 `status` として表示 | 一致。進捗率・アニメーションは固定仕様外のため後続画面で接続する。 |
| Empty | 空の理由と次の操作を示す | `EmptyState` が説明と `Next` を表示 | 一致。Screen固有の作成導線は各 Screen Issue で渡す。 |
| Error / Retry | 現在の画面を維持して回復する | Inline / Blocking Error と callback 型 Retry | 一致。Failure Code ごとの文言は Out of Scope。 |
| Badge | 色だけに依存しない状態表示 | 可視テキストと accessible name | 一致。配色トークンは後続のデザイン調整で追加する。 |

## Result

GO
