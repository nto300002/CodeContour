# ADR-003: MVP Project Modelの正本をSQLiteへ一本化する

## Decision

Project、Repository設定、Feature、Process、Data Flow、Symbol Link、Evidence、Snapshot、Analysis Runの永続正本はSQLiteとする。SQLite DriverはMain Processだけが保持し、全更新は用途別Main CommandからSQLite Transactionとして実行する。Rendererは選択、フォーム編集中、受信したProjectionだけを保持し、Domain modelを正本として更新しない。

## JSON compatibility and migration

`UserModelFileStore`はPoC Fixture、テスト、既存データの読み取り互換に限定する。新規Production Writeには使わない。既存JSONはProjectごとに一度だけSQLiteへimportする。Domain置換と`json_user_model_migration`記録は一つのTransactionで実行し、二回目以降は何もしない。

## Rollback

JSON importまたはDomain WriteのValidation／SQLite失敗はTransactionをrollbackする。Active Snapshotのpointerと既存User Modelは更新しない。Analysis cancel／failはStaging Snapshotだけを破棄し、Active SnapshotおよびSQLiteのProject Modelを維持する。

## Consequences

Renderer再起動時はMainのread-only Projection CommandからSQLite Modelを再取得する。JSONをProductionの保存先として再導入する場合は、このADRを置換する新しいDecisionと明示的なmigrationを必要とする。
