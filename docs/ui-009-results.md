# UI-009 Process / Data Flow 結果

Issue #25のVIEW-102 Process / Data Flowを実装した結果を記録する。

## Decision

- VIEW-102は選択Featureを必須Contextとし、そのFeatureに属するProcessとData Flowだけを投影する。
- ProcessのLifecycleと、Data FlowのVerification／Freshnessは別々に表示する。`EVIDENCED`と`STALE`を単一状態にはしない。
- Process作成、名称編集、削除、順序変更、Data Flow作成、名称・Endpoint編集、削除、Evidence参照追加は、このUI Projectionのローカル操作として扱う。Evidenceはcanonical Project Symbolの`symbolId`、定義path、rangeを保存し、任意文字列・外部・UNKNOWN Symbolは受理しない。自動Process生成・共同編集は追加しない。
- Processの追加・削除・並替後は、選択Feature内の順序を一意かつ連続した`0..n-1`へ正規化する。
- 選択Feature外または同一ProcessをEndpointに指定する操作は、Flow StateとWorkspace Contextを変更せず拒否する。

## 受け入れ結果

| 要件 | 結果 |
| --- | --- |
| 選択FeatureのFlowを表示 | PASS — Feature IDでProcessとData Flowを絞り込む。 |
| InspectorにCode／Data／Evidenceを表示 | PASS — Code ref数、入出力、canonical Symbolの定義位置付きEvidence参照を表示する。 |
| VerificationとFreshnessを別軸表示 | PASS — `UNVERIFIED / EVIDENCED`と`CURRENT / STALE`を別行で表示する。 |
| Guard失敗でFlowとContextを変更しない | PASS — Feature／Endpoint／名称のGuard後にのみState・Selectionを更新する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Flow projection Unit Test | PASS — Process、Flow、Inspectorの状態軸と関連情報を確認。 |
| 編集 Integration Test | PASS — Process／Data Flowの名称・Endpoint変更、同一EndpointのGuard、Data Flow削除、追加・削除・並替後の順序正規化を確認する。 |
| 作成・並替・Evidence参照 E2E Test | PASS — Process作成、並替、Flow作成、canonical Symbol Evidence追加、未照合／外部／UNKNOWN Symbol拒否を確認。 |

## UI Mockとの差異レビュー

個別のグラフ配置、接続線の自由配置保存、Process自動生成、共同編集は対象外とした。ProcessとData Flowは意味、順序、状態、Evidenceを確認できる標準DOM表示に限定し、後続のCanvas表現へ置き換え可能にしている。

## Result

GO
