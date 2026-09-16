# ユーザー体験・画面・Recovery

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> **MVP Scope:** MVPの主要画面はLocal ProjectとUnderstanding Workspace（面・線・点）に限定する。Learning、Engineering Profile、Login Gate、公開導線はDESIGNED / POST-MVPとする。

> Navigation、理解Scope、基本利用フロー、画面構成、Error / Recovery、Undo / Redoを定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 35. Navigation指標

Navigation回数そのものを少ないほど良いとはしない。

Semantic Linkを使って関連コードを辿ることは望ましい学習行為だからである。

減らしたいのは、

* 同じSymbolのRepeated Search
* 同じFile間の無目的往復
* 一度確認したDefinitionの再検索
* 目的Symbol到達までの余分なStep

などの**迷子Navigation**とする。

---

---

## 36. 理解Scope

Repository全体について、

```text
理解度 73%
```

とは表示しない。

ユーザーが、

> 今回理解したいFeature / Process

を設定する。

そのScope内で、

```text
役割
Data Flow
Dependency
変更影響
```

などの理解状態を持たせる程度にする。

「100%理解」を目的化しない。

---

---

## 43. 現在の基本利用フロー

最終的にユーザー体験をまとめると、

```text
Local Repositoryを選択
        ↓
Security Boundary構築
        ↓
Local Structural Analysis
        ↓
──────── 面 ────────
Feature Mapを俯瞰
        ↓
学習Featureを選択
        ↓
──────── 線 ────────
Initial Process Template
        ↓
AIが差分候補
        ↓
ユーザーがProcessを確定
        ↓
ProcessごとにSymbol候補
        ↓
ユーザーが関連付け
        ↓
Data Flowを自分で記録
        ↓
──────── 点 ────────
実コードを見る
        ↓
Semantic Linkで関連箇所へ移動
        ↓
自分のMemo / 説明を書く
        ↓
AIと問答
        ↓
不足・矛盾を確認
        ↓
自分で理解を書き直す
        ↓
Code Relationを確認
        ↓
Process Relationへ反映
        ↓
Feature Dependencyへ集約
        ↓
──────── 面 ────────
全体へ戻る
```

さらにGit変更時は、

```text
Git Change
↓
Change Packet
↓
Feature Contextとの差分確認
↓
Structural Context自動更新
↓
Semantic ContextへAI変更候補
↓
User ContextをStale表示
↓
ユーザーが再学習・再編集
```

となる。

---

---

## 55. 画面構成

主要な画面構成は次のとおりとする。

```text
Concept Overview
↓
Project Hub
↓
Understanding Workspace
↓
Learning
↓
Engineering Profile
```

Understanding Workspaceは共通3ペイン構成とする。

```text
左: Navigation / List
中央: Main Canvas
右: Inspector / Editor
```

主要Viewは次の3種類とする。

```text
全体: Feature Map
流れ: Process / Data Flow
コード: Read-only Code Viewer
```

右InspectorはFeature Inspector、Process Inspector、Data Edge Editor、Symbol Contextを兼用する。Code ViewではFile / Symbol Treeを常時表示する。

---

## 56. Error / Recovery

基本原則は、復旧可能なエラーでは現在画面を維持することである。

次の状態では専用画面へ遷移しない。

```text
入力Validation
AI Offline
UNKNOWN
STALE
CONTRADICTED
通常のNetwork Retry
```

Recovery専用遷移を使用するのは次の場合とする。

```text
App Data Recovery
Repository Reconnect
Authentication
Git Conflict
GitHub Repository再設定
```

Recovery後は`returnPath`へ戻す。

---

## 57. Undo / Redo

Session内のUser Context編集について、次の操作にUndo / Redoを提供する。

```text
Process Add / Delete / Rename / Reorder
Process Split / Merge
Data Flow編集
Semantic Relation編集
```

複合変更は`UserCommand`単位でAtomicに戻す。Git PushやPublic Publishなど外部Side EffectはUndo対象外とする。
