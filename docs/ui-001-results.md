# UI-001 App Shell 結果

Issue #17の共通Electron / React App Shellについて、固定仕様とUI Mockを照合した結果を記録する。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 7 Screensの共通Shell | PASS | `screenDefinitions`にSCR-001〜SCR-007を固定し、Screen Active Stateを共通Top Barで表示する。 |
| SCR-004の独立スクロール3ペイン | PASS | Navigation / Canvas / Inspectorにそれぞれ`overflow: auto`を設定し、Visual SmokeでDOM layoutを確認する。 |
| Project未選択時のNavigation無効化 | PASS | Project依存Screenはdisabled。Project Hubの最小選択操作後に有効化する。 |
| RendererのNode API遮断 | PASS | RendererにNode / Electron importを置かず、Mainは`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`で起動する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Shell表示条件 Component Test | PASS — 7 Screens、Active状態、Project未選択を検証。 |
| Active Navigation Unit Test | PASS — Project / Screen / ViewのState遷移を検証。 |
| 代表画面 Visual Smoke Test | PASS — happy-dom上でProject Hubの2ペインを描画し、Project選択→Workspace移動→Code Viewer切替、3ペインのDOM layoutと各paneのscroll設定を検証。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock | UI-001実装 | 判断 |
| --- | --- | --- | --- |
| Top Bar / Project Navigation | Project名・Screen Navigationを表示 | 共通Top Bar、Active Screen、Project未選択表示を実装 | 一致。実Project一覧は後続のSCR-001で接続する。 |
| SCR-001 Project Hub | Project card、最近の作業、新規作成導線 | 2ペインShellと最小のProject選択操作のみ | 詳細データとCard UIはUI-004（#20）の範囲。 |
| SCR-004 Workspace | 左Navigation / 中央Canvas / 右Inspector | 3ペインShell、View切替、独立scrollを実装 | Feature Map / Flow / Codeの内容はUI-008〜UI-011で実装する。 |
| Pane幅・Icon・文言 | Mock上の具体配置 | 最小Gridと標準Button | UI Mockは参照資料であり、Pane幅・Icon・局所文言は固定仕様ではない。 |
| Inspector内容 | Feature / Process / Symbol固有情報 | `Inspector` placeholder | Selection・Domain dataは後続Issueの範囲。 |

## Scope / Findings

- UI-001は共通ShellとNavigation Stateだけを所有する。Screen固有データ、詳細Pane幅、テーマ切替は実装しない。
- `CodeContourApp`のsample projectは、RepositoryやSQLiteを読む代わりではなく、Project未選択時のNavigation GuardをVisual Smokeで検証するための最小Stateである。
- Preload APIは空の用途別Bridgeに限定する。Repository、SQLite、Credential、raw IPCの公開は後続の用途別API実装まで行わない。

## Result

GO
