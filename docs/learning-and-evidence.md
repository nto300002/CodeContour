# Learning・Evidence・Engineering Radar

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

```text
Status: DESIGNED / POST-MVP
```

> 本文書の設計は保持するが、固定MVPの実装対象、依存関係、受入条件には含めない。

> Learning Session、Learning Record、GitHub Learning Log、Skill Evidence、Engineering Radarを定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 50. Learning機能

### 50.1 Learning Session

1つのLearning Sessionは、1 Projectと1 Primary Featureで構成する。

```text
1 Learning Session
= 1 Project
+ 1 Primary Feature
```

Sessionはユーザーが明示的に開始・終了する。関連Featureの参照は可能だが、Primary Featureは1つとする。

記録対象はクリック数などの操作量ではなく、次の学習成果Eventである。

```text
Explanation Created / Revised
Data Flow Evidenced
Dependency Confirmed
Change Impact Predicted
Process Confirmed
Contradiction Rechecked
```

クリック数、Scroll、検索回数、AI質問回数は能力Evidenceにしない。

### 50.2 Learning Record

Learning RecordはSession終了時に確定し、保存後は原則Immutableとする。

```text
Project
Primary Feature
CodeSnapshot
User Reflection
Evidence
開始・終了時刻
```

---

## 51. GitHub Learning Log

Learning RecordからMarkdownを生成し、Learning Log Repositoryへcommit / pushできる。

```text
CodeContour
↓
Learning Record
↓
Learning Log Repository
↓
commit / push
↓
GitHub
```

GitHub Contribution Graphは継続性を補助するEvidenceとして扱うが、Engineering Radarの能力Levelへ直接加算しない。

AIはcommit / push Capabilityを持たず、実行はユーザーの明示操作に限定する。

Git同期状態はLearningRecord本体へ持たせず、`LearningLogSync`として別Entityにする。Push再試行履歴はappend-onlyで保持する。

---

## 52. Engineering Evidence / Engineering Radar

Engineering Radarは次の5軸を正式採用する。

```text
コード理解
データフロー
依存・変更影響
システム俯瞰
説明・検証
```

各軸のLevelは0から5とする。ただしLevelを直接保存・編集せず、EvidenceとRubricからProjectionとして計算する。

```text
SkillEvidence
+ SkillRubric
↓
EngineeringProfile Projection
↓
Radar
```

Skill判定は件数の単純加算ではなくRule Gate方式とし、高いLevelほどBreadthを要求する。

```text
Lv1: 1対象
Lv2: 1 Feature
Lv3: 複数Process / Evidence
Lv4: 複数Featureまたは複数Change Scenario
Lv5: 複数Project
```

Current Radarには`CURRENT + VERIFIED`のEvidenceのみを使用し、Historical Evidenceは別表示する。

Skill RubricはVersioningする。

```text
SkillRubric

id
version
axis
level
conditions
effectiveFrom
```

これにより、Level条件を変更した場合も、どのRubricで計算されたか追跡可能にする。

---

## 63. Evidence Engine

Evidence生成の共通条件は次のとおりとする。

```text
origin = USER
verification = VERIFIED / CONSISTENT
freshness = CURRENT
AI Proposal only = false
Evidenceあり
CONTRADICTEDではない
```

同一の理解を繰り返し保存してEvidenceが水増しされないよう、Semantic Dedupを行う。
