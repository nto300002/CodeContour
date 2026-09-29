# ARCH-002 / ANALYZER-001 修正TODO

- [x] Renderer起動時にMainのSQLite Project一覧を読み込み、選択時にProject／Model／Symbol Projectionを復元する。
- [x] Feature／Process／Data Flow／Evidenceの作成・編集・削除をMain Command API経由にし、SQLite Transactionで保存する。
- [x] Mainの`importLegacyJsonFile`経由で既存JSONを一回だけSQLiteへ移行する手順と回帰テストを追加した（ファイルの自動発見は既存Production JSONの保存場所がなかったため行わない）。
- [x] Security Ignore、`.gitignore`、tsconfig／import／triple-slash root外参照を共有解析境界で拒否する。
- [x] 4 Analyzerが同一の許可Application File集合を使うことを回帰テストで確認する。
