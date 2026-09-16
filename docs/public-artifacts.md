# Public Snapshot・Public Profile

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> Local Projectから安全なPublic Artifactを生成・公開する境界とURLモデルを定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 53. Public Snapshot / Public Profile

Local Projectを直接公開しない。公開時は次のPipelineを必ず通す。

```text
Local Project
↓
Allowlist抽出
↓
Sanitize
↓
Secret Scan
↓
Preview
↓
User明示公開
↓
Public Artifact
```

Public ViewerはLocal Storeを直接参照しない。Working Treeは公開不可とし、公開内容は必ずCommitへ固定する。

公開対象となる「点」は基本的に次の情報とする。

```text
Symbol
Role
User Explanation
Repository-relative Path
Commit
Evidence
Public Repository Permalink
```

Source全文は再配信しない。

Public URLはStable URLとImmutable Snapshot URLの2層構造にする。

```text
Stable URL:
/p/project/example

Immutable Snapshot URL:
/p/project/example/snapshots/{snapshotId}
```

Stable URLは最新のPublished Snapshotを指し、Immutable Snapshot URLは特定の公開Versionを固定表示する。Engineering ProfileもStable HandleとImmutable Snapshotの方式を採用する。
