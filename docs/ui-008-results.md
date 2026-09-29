# UI-008 Feature Map 結果

Issue #24のVIEW-101 Feature Mapを実装した結果を記録する。

## Decision

- Feature NodeはConfirmation、Lifecycle、Freshnessを別々に表示する。`CONFIRMED`と`ARCHIVED`、Freshnessを単一状態へ混在させない。
- 選択FeatureはWorkspace ContextのFeature IDとして保持し、Feature Map InspectorとVIEW-102へ同じContextを渡す。
- 0件時は手動Feature作成フォームを表示する。作成、名前変更、ArchiveはこのUI Projectionのローカル操作として扱い、自動生成・自由配置保存は追加しない。

## 受け入れ結果

| 要件 | 結果 |
| --- | --- |
| Feature選択でInspector更新 | PASS — Node選択がFeature Map Inspectorの詳細へ反映される。 |
| 同じFeatureでFlowへ移動 | PASS — `View <Feature> flow`がFeature Contextを保ってVIEW-102へ切り替える。 |
| 状態軸を分離して表示 | PASS — Confirmation / Lifecycle / Freshnessを別行で表示する。 |
| 0件時の作成導線 | PASS — Empty StateとFeature名入力、Create操作を表示する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Node／Edge Component Test | PASS — Node状態軸、件数、Relation Edge、Inspector投影を確認。 |
| 選択とView遷移 Integration Test | PASS — Feature選択からInspector更新、Flow切替後のFeature Contextを確認。 |
| 作成からFlow移動 E2E Test | PASS — 0件Feature Mapで作成し、作成FeatureのFlowへ移動することを確認。 |

## UI Mockとの差異レビュー

個別のGraph Layout、自由配置の保存、AIによるFeature生成・Relation推定は対象外とした。Node／Edgeは意味と状態を確認できる標準DOM表示に限定し、後続Canvas改善で置き換え可能にしている。

## Result

GO
