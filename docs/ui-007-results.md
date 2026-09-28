# UI-007 Understanding Workspace 結果

Issue #23のSCR-004 Understanding Workspaceについて、固定仕様と既存UI Shellを接続した結果を記録する。

## Decision

- `WorkspaceContext`をRenderer内の単一の投影値とし、Project、View、SelectionをNavigation／Canvas／Inspectorへ同じ値で渡す。各PaneはSelectionの正本を所有しない。
- VIEW-101〜103は`#/workspace`内のView Stateであり、Inspectorにも独立Routeを与えない。
- Project切替では保存済みSelectionを復元するかclearし、新規Project開始ではViewをFeature Map、Selectionを未選択へ初期化する。
- Pane幅は既存Shellの表示レイアウトにとどめ、UI-007では保存・復元しない。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| View切替でProject Contextを保持 | PASS | 3 Viewの切替後も3 Paneに同じProject名を投影する。 |
| Selectionが3 Paneへ一貫して反映 | PASS | CanvasのSelection操作をApp Stateが所有し、Navigation／Canvas／Inspectorへ同じSelectionを渡す。 |
| Inspectorは独立Routeを持たない | PASS | InspectorはWorkspace Shell内のPaneであり、3 View往復中もURLは`#/workspace`のまま。 |
| Pane一時幅を正本として保存しない | PASS | UI-007はPane幅の保存API・永続Stateを追加しない。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| View切替 Integration Test | PASS — Project ContextとSelectionを保持したままProcess Flow／Code Viewerへ切り替える。 |
| Selection同期 Component Test | PASS — 一つのSelectionがNavigation／Canvas／Inspectorの全Paneに投影され、Canvasは更新要求だけを発行する。 |
| 3 Views往復 E2E Test | PASS — Feature Map → Process Flow → Code Viewer → Feature Mapを`#/workspace`内で往復し、InspectorのSelectionを維持する。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-007実装 | 判断 |
| --- | --- | --- |
| 3ペイン | Navigation／Main Canvas／Inspector | 共通Workspace ShellへContext Paneを接続 | 一致。 |
| View内容 | Feature／Flow／Codeの個別Canvas | Contextと見出し、最小Selection操作のみ | 個別CanvasはUI-008〜UI-011の範囲。 |
| Inspector | Selectionに従う補助UI | 同じContextの読み取り専用投影 | 一致。個別Feature／Process／Symbol編集は後続Issue。 |
| Pane幅・Animation | Mock上の視覚表現 | 保存・復元なし | 固定仕様の「一時Pane幅を正本にしない」に一致。 |

## Result

GO
