# Context・AI・ユーザー所有権

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> **MVP Scope:** MVPのAI機能はUser Explanation Verificationだけである。汎用Context Cache、AI Proposalの高度な適用、Process / Data Flow生成は設計を維持したままPOST-MVPとする。

> Feature Context、AI Context、User Context、AI Proposal、Verification、Write権限境界を定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 18. Feature Context

Featureごとに一度獲得した情報を、再利用可能な**Feature Context**として保存する。

Feature Contextは少なくとも、

```text
Structural Context
Semantic Context
User Context
Provenance Context
```

に分ける。

#### Structural Context

* File
* Symbol
* Call
* Type
* Import
* Static Relation

#### Semantic Context

* Feature
* Process
* Data
* Relationの意味
* Feature Summary

#### User Context

* Memo
* 自分の説明
* 理解状態
* 自分で付けた意味

#### Provenance Context

* Commit
* Hash
* Source Evidence
* 最終確認日時
* Staleness

---

---

## 19. Feature Contextの再利用

同一Featureについて別Processを学習する際、

Repository全体を再びAI解析しない。

```text
保存済みFeature Context
+
今回のProcess
+
直接Relation
+
必要Source
```

だけを利用する。

Feature ContextそのものもChunk化し、全文を毎回AIへ渡さない。

---

---

## 20. AI Context最小化

Repository全文・File全文を原則としてAIへ一括送信しない。

まずローカルで、

* Directory
* Route
* Symbol
* Import
* Call
* Type
* Data
* Test
* Git

などのIndexを構築する。

AIには圧縮情報から渡す。

Contextは、

```text
Feature Summary
↓
Process Summary
↓
Relation
↓
Symbol Summary
↓
Signature
↓
AST Block
↓
Function Body
↓
Source Evidence
```

の順で必要時のみ具体化する。

---

---

## 21. AIが読むコードの選択基準

Featureとの関連候補には複数Signalを利用する。

主な優先順位：

1. Entry Pointとの構造距離
2. Call / Data Flow接続
3. Framework上のRelation
4. Type / Symbol関係
5. Test Evidence
6. Path / Symbol名称
7. Git履歴
8. Semantic similarity

特に、

> **構造的接続とData Flowを文字列類似より優先する。**

単一のRelevance Scoreだけでなく、

```text
Structural: HIGH
Data: HIGH
Framework: MEDIUM
Lexical: LOW
```

のような複数Signalを内部保持する。

---

---

## 22. Progressive Context Expansion

AIが「情報不足」と判断した場合だけContextを追加する。

基本は1-hopから開始する。

```text
Current Symbol
↓
直接Caller / Callee
↓
直接Data
↓
必要時2-hop
```

AIにRepositoryを自由探索させない。

Context Managerを介して取得する。

---

---

## 23. Context Cache

一度解析した、

```text
Feature
Process
Symbol
Relation
```

についてAI結果をCacheする。

コードが変更されていなければ再解析しない。

同じFeatureを再訪するほどAI探索コストが低下する設計とする。

---

---

## 27. User Contextの編集

Feature Context自体はSYSTEMが生成するProjection / Context Cacheであり、ユーザーが直接編集する正本ではない。

ユーザーは、Feature、Process、DataFlow、SemanticRelation、Memo、UserExplanation、SemanticLinkを正本として編集する。Feature Contextはこれらの正本からSYSTEMが再構築する。

ただしCode Fact自体は編集対象にしない。

Code Factに問題があると考えた場合は、

> 解析結果への異議・再解析要求

として扱う。

---

---

## 28. User Contextの誤り検出

ユーザーが書いた説明はCode Modelと照合する。

状態例：

```text
UNVERIFIED
CONSISTENT
QUESTIONABLE
CONTRADICTED
STALE
```

AIはUser Contextを確定事実として扱わず、

* Provenance
* Verification State

とセットでContextへ渡す。

---

---

## 29. AIによるUser Context修正は禁止

これはPromptではなく**物理的なCapability制御**で実現する。

データを、

```text
Code Fact Store
AI Proposal Store
User Context Store
```

へ分離する。

権限イメージ：

| Actor          | Code Fact | AI Proposal |  User Context |
| -------------- | --------: | ----------: | ------------: |
| Local Analyzer |     Write |           × |             × |
| AI             |      Read |       Write | **Read only** |
| User           |      Read |        Read |     **Write** |

AIには、

```text
update_user_memo()
update_user_explanation()
set_understood()
```

などのToolを与えない。

---

---

## 30. AI Proposal

AIによる修正案はUser Contextへ直接反映せず、AI Proposalとして別保存する。

例えば、

```text
AI Proposal

「MFA検証Processが追加されている可能性があります」

根拠：
MfaService.verify()
```

とする。

AIはSuggestion Entityを生成できるが、

> **User-owned Entityのmutation capabilityを持たない。**

---

---

## 31. Human Write Gateway

User Contextへの変更は必ずユーザー操作を起点とする。

```text
User UI
↓
Human Write Gateway
↓
User Context Store
```

AIは、

```text
AI
↓
Proposal Gateway
↓
AI Proposal Store
```

のみ。

AIからHuman Write Gatewayへ直接到達できない構造とする。

---

---

## 32. User Memoは特にAI自動反映禁止

以下はAIからの自動変更だけでなく、AI Proposalのワンクリック反映も原則行わない。

* User Memo
* 自分の説明
* 自分自身の意味付け
* 理解状態

AIは、

> 「ここを再確認してください」

まで。

実際の文章はユーザー自身が書き直す。

---

---

## 33. Structural Contextは自動更新可能

一方、

* File移動
* Symbol rename
* Call Relation
* Type情報
* Git情報

などコードから機械的に確認可能な情報はLocal Analyzerが自動更新できる。

つまり、

```text
SYSTEM
構造的事実を更新

AI
意味候補を提示

USER
Mental Modelを更新
```

という三者分離とする。

---

---

## 34. AI推定の不確実性

AI推定には明示的な表示を付ける。

3段階程度：

```text
高
中
低
```

ただしContext量だけではなく、

* Source Evidenceの強さ
* Context充足度
* 構造解析との一致
* 解釈の曖昧さ

から判断する。

「87%」のような偽精密な数値は原則出さない。

---

---

## 47. User ExplanationのVerification

User Explanationを保存した時点では`UNVERIFIED`とし、保存を契機にAI Verificationを自動実行しない。

ユーザーが`コードと照合する`を明示的に実行した場合のみ、次のように遷移する。

```text
UNVERIFIED
↓
VERIFYING
↓
CONSISTENT / QUESTIONABLE / CONTRADICTED
```

説明本文を編集した場合は再び`UNVERIFIED`とする。コードだけが変更された場合は、過去のVerification結果と現在の鮮度を分離して保持できる。

```text
verification = CONSISTENT
freshness = STALE
```

---

## 48. Feature Contextの位置付け

Feature Contextはユーザーの正本ではなく、SYSTEMが生成するProjection / Context Cacheとして扱う。

ユーザーが編集する正本は以下である。

```text
Feature
Process
DataFlow
SemanticRelation
Memo
UserExplanation
SemanticLink
```

SYSTEMはこれらの正本から、次の構造を再構築する。

```text
FeatureContext
└ FeatureContextChunk
```

Chunkは次の種類に分割する。

```text
FEATURE_SUMMARY
PROCESS
DATA
RELATION
USER_CONTEXT
```

Feature ContextはSnapshot単位でVersionを持ち、部分的な`STALE`を許容する。

---

## 60. Write権限境界

Write権限を次のように分離する。

```text
ANALYZER
→ Code Factのみ

AI
→ AIProposalのみ

USER / Human Write Gateway
→ User Context

SYSTEM
→ Verification / Freshness / FeatureContext /
  LearningEvent / SkillEvidence / Projection

PUBLIC BUILDER
→ Public Artifact

GIT SYNC
→ LearningLogSync
```

AIには`MUTATE_USER_CONTEXT` Capabilityを与えない。

---

## 61. AI Proposal適用方式

AI Proposalの採用は次の手順で実行する。

```text
AIProposal
↓
User「採用」
↓
ChangePlan生成
↓
変更Preview
↓
User最終確認
↓
Human Write Gateway
↓
Transaction
```

Split / Mergeなどで関連DataFlowを判断できない場合、AIが勝手に振り分けず`REVIEW_REQUIRED`とする。複合変更は全成功または全Rollbackとする。
