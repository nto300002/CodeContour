# 状態・論理データモデル・主要Sequence

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> Feature / Process状態、Entity、Cardinality、Versioning、Event / Guard / Effect、主要Sequenceを定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 46. Feature / Process状態モデル

状態を巨大な単一enumにせず、独立した軸として管理する。

Featureは次の状態軸を持つ。

```text
Origin:
SYSTEM / AI / USER

Confirmation:
CANDIDATE / CONFIRMED

Scope:
IN_SCOPE / OUT_OF_SCOPE

Freshness:
CURRENT / PARTIALLY_STALE / STALE

Evidence:
UNVERIFIED / EVIDENCED / QUESTIONABLE / CONTRADICTED
```

Processも同様に、次の独立軸を持つ。

```text
Origin:
TEMPLATE / AI / USER

Confirmation:
UNCONFIRMED / CONFIRMED

Freshness:
CURRENT / STALE

Evidence:
UNVERIFIED / EVIDENCED / QUESTIONABLE / CONTRADICTED
```

Feature Candidateに対して、ユーザーは採用、Renameして採用、非表示を選択できる。AIがCandidateを直接`CONFIRMED`へ変更することは禁止する。

---

## 58. 論理データモデル

主要Entityは次のとおりとする。

```text
RepositoryBinding
ProjectSecurityPolicy
CodeSnapshot
FileSnapshot
SourceAnchor
SymbolOccurrence
StructuralRelation

Feature
Process
ProcessCodeRef
DataFlow

EvidenceRef
EvidenceBinding

SemanticRelation
Memo
UserExplanation
SemanticLink

FeatureContext
FeatureContextChunk

AIProposal

LearningSession
LearningEvent
LearningRecord
LearningRecordEvidence
LearningLogSync

SkillEvidence
SkillRubric

PublicProject
PublicSnapshot
PublicSnapshotItem

PublicEngineeringProfile
PublicProfileSnapshot
```

主要なCardinalityは次のとおりとする。

```text
Project 1:N RepositoryBinding
※ ACTIVEは最大1

Project 1:N CodeSnapshot
Project 1:N Feature
Feature 1:N Process
Process N:M SourceAnchor via ProcessCodeRef
Feature 1:N DataFlow
SourceAnchor 1:N SymbolOccurrence
LearningSession 1:0..1 LearningRecord
LearningRecord N:M EvidenceRef
LearningRecord 1:N LearningLogSync
PublicProject 1:N PublicSnapshot
```

---

## 59. Delete / Versioning規則

Delete方式は、Entityの性質に応じて次を使い分ける。

```text
ARCHIVE
TOMBSTONE
GC
PURGE
REVOKE
```

Versioning方式は次を使い分ける。

```text
IMMUTABLE
REVISIONED
SNAPSHOT
REBUILDABLE
PROJECTION
```

代表的な適用例は次のとおりである。

```text
LearningRecord: IMMUTABLE
UserExplanation: REVISIONED
CodeSnapshot: SNAPSHOT
FeatureContext: REBUILDABLE / SNAPSHOT
EngineeringProfile: PROJECTION
```

---

## 64. Event / Guard / Effect

主要な状態変更はすべて次の形式で定義する。

```text
Event
+ Guard
→ Effect
```

Event名はActorを示す接頭辞を付ける。

```text
USER_...
AI_...
SYSTEM_...
ANALYZER_...
GIT_...
PUBLIC_...
```

共通Guardは次のとおりとする。

```text
PROJECT_ACTIVE
USER_HAS_WRITE_AUTHORITY
TARGET_EXISTS
BASE_REVISION_MATCHES
EVENT_NOT_ALREADY_APPLIED
SECURITY_POLICY_ALLOWS
```

Guard failure時はUser Contextを変更しない。

State-changing Eventは論理的に次の属性を持つ。

```text
eventId
idempotencyKey
actor
projectId
baseRevision
createdAt
```

Network Retryなどで同じEventが複数回到着しても、重複Entityを生成しない。

---

## 65. 正式化する主要Sequence

次のSequenceを正式な設計対象とする。

```text
Project登録・初回解析
Feature Candidate採用
Learning Session開始
Process / DataFlow / Code理解
User Explanation保存・照合
Git変更 → STALE → 再確認
Learning Session終了・LearningRecord確定
LearningRecord → SkillEvidence → Radar
LearningRecord → GitHub Push
Public Snapshot公開
```
