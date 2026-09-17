# CodeContour Documentation

CodeContourの設計・要件ドキュメントです。要件はテーマ別の正規仕様へ分割されています。

## 読む順序

1. [プロダクトの設計思想](product-principles.md)
2. [プロダクト要件](product-requirements.md)
3. [MVP Scope・対応範囲・非機能目標](mvp-scope.md)
4. [MVP実装境界・開始Gate](mvp-implementation-boundaries.md)
5. [PoC-0正式仕様](poc-0-spec.md)
6. 必要なテーマ別仕様

## テーマ別仕様

| 文書 | 内容 |
| --- | --- |
| [product-principles.md](product-principles.md) | プロダクト原則と判断基準 |
| [product-requirements.md](product-requirements.md) | 面・線・点、Process、Data Flow、Semantic Link |
| [mvp-scope.md](mvp-scope.md) | 固定MVP、受入条件、PoC-0、実装順 |
| [mvp-implementation-boundaries.md](mvp-implementation-boundaries.md) | 高コストな実装境界、状態、権限、SQLite保存範囲 |
| [poc-0-spec.md](poc-0-spec.md) | PoC-0のIN / OUT、Gate、Fixture、計測、Go / No-Go |
| [domain-model.md](domain-model.md) | 状態モデル、Entity、Cardinality、Event、Sequence |
| [context-and-ai.md](context-and-ai.md) | Feature Context、AI境界、User Context、Proposal |
| [git-and-staleness.md](git-and-staleness.md) | Git時間軸、変更追跡、STALE伝播 |
| [user-experience.md](user-experience.md) | 画面、基本フロー、Recovery、Undo / Redo |
| [security-and-data.md](security-and-data.md) | Repository境界、外部送信、認証、Backup |
| [learning-and-evidence.md](learning-and-evidence.md) | Learning Record、Evidence、Radar |
| [public-artifacts.md](public-artifacts.md) | Public Snapshot / Profile |
| [references.md](references.md) | 根拠・参考資料 |

## 文書の優先順位

- プロダクト判断では[設計思想](product-principles.md)を最上位原則とします。
- MVPの実装範囲と完了判定では[固定MVP仕様](mvp-scope.md)を優先します。
- MVPの状態・権限・保存境界では[MVP実装境界](mvp-implementation-boundaries.md)を優先します。
- PoC-0の範囲と成功判定では[PoC-0正式仕様](poc-0-spec.md)を優先します。
- 具体的な振る舞い・状態・境界は各テーマ別仕様を正規仕様とします。
- [requirements-draft.md](requirements-draft.md)は旧URL互換用の案内ページであり、要件本文の正本ではありません。
