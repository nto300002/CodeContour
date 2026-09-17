# プロダクト要件

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> **MVP Scope:** MVPでは手動Feature、TemplateのUser編集、手動Data Flow、Code Navigation、User Explanation Verificationに限定する。AIによるProcess / Data Flow / Dependency生成など、本文書に記載された将来機能のMVP適用可否は[固定MVP仕様](mvp-scope.md)を正とする。

> CodeContourの対象ユーザー、中心モデル、Process、Data Flow、Semantic Linkなど、中核となる理解体験を定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## CodeContour（コード・コンター）

### 仮要件定義（現時点のドラフト）

> 以下は、ここまでの議論を統合した現時点の要件定義ドラフトです。

---

以下を、ここまでの議論を統合した**現時点の要件定義ドラフト**として整理できます。
「決まっていること」と「まだ詳細設計・PoCで決めること」を分離しています。

---

## 1. プロダクト概要

本プロダクトは、AIコーディングによって高速に生成・変更されるコードについて、**人間側の理解が追いつかなくなる問題を解決するための独立したプログラム理解支援アプリ**である。

特に解決するのは、コード量そのものではなく、

* 複数ファイルへ分散した処理を追う負荷
* 「次にどこを見るか」を保持する負荷
* Functionや依存性注入元などを繰り返し検索する負荷
* コードから責務・意味へ翻訳する負荷
* Data FlowやDependencyを頭の中で保持する負荷
* 一度理解した箇所を再び検索・理解し直す負荷
* AIによる変更後に、自分のMental Modelが古くなる問題

を対象とする。

最上位原則は、

> **学習に不要な探索・Navigation負荷はシステムへ外部化し、意味付け・説明・関連付け・変更予測という学習に必要な認知活動はユーザー自身に残す。**

とする。

---

---

## 2. 対象ユーザー

主対象は、

> **AIコーディングによってアプリ開発自体は進められるが、生成・変更されたコードについて、全体構造・Data Flow・Dependency・Symbolの役割を追跡し、自分が保守できるMental Modelを構築したい開発者**

とする。

「プログラミング初心者専用」には限定しない。

MVPは個人利用を前提とする。

---

---

## 3. アプリ形態

既存IDEのExtensionではなく、**独立したApplicationとして提供する**。

理由は、単なるコード閲覧ではなく、

> **面 ↔ 線 ↔ 点**

を視覚的に往復することそのものが主要なユーザー体験だからである。

アプリ内部にはコード表示画面を持つが、MVPではSource Code編集を目的としない。

---

---

## 4. プロダクトの中心モデル

コード理解を、

```text
面
↕
線
↕
点
```

の3階層として扱う。

Gitはこれらとは別に「時間軸」として重ねる。

### 面 ― Feature Map

目的：

> アプリ全体をFeature単位で俯瞰し、学習したい機能へ直感的にアクセスする。

主な表示対象：

* Feature
* Feature間の主要Dependency
* 理解対象Scope
* 変更があったFeature
* 現在選択中のFeature

Featureは、

> **ユーザー・業務から見て意味のある機能**

を単位とする。

例：

```text
ログイン
プロフィール更新
ユーザー登録
決済
```

ServiceやRepositoryなどの技術レイヤーをFeatureとはしない。

---

---

## 5. 線 ― Feature → Process → Symbol

Featureを選択すると線へ移動する。

基本構造は、

```text
Feature
   ↓
Process
   ↓
Symbol
```

とする。

線の目的は、

> **そのFeatureがどのような処理・責務によって成立し、その間をどのDataが流れているか理解すること。**

---

---

## 6. 初期理解用Process Template

Processを毎回ゼロから構築させない。

一般的な処理骨格については、アプリ側に**初期理解用Process Template**を用意する。

MVPでは以下の7種類とCustomを正式なTemplateとして扱う。

例：

#### Create

```text
Receive
↓
Validate
↓
Transform / Create
↓
Persist
↓
Return
```

#### Read

```text
Receive Criteria
↓
Retrieve
↓
Filter / Transform
↓
Return
```

#### Update

```text
Identify
↓
Retrieve
↓
Receive Change
↓
Validate
↓
Transform / Update
↓
Persist
↓
Return
```

#### Delete / State Change

#### Authentication

#### External Integration

#### Event / Background Processing

#### Custom

Templateは答えではなく、

> **理解開始時のScaffold**

として扱う。

---

---

## 7. Process Primitive

Templateを構成する共通語彙として、技術非依存のPrimitiveを持つ。

例：

* Receive
* Identify
* Retrieve
* Validate
* Authorize
* Transform
* Execute
* Persist
* Notify / Emit
* Return

Templateには、

> 「何をするか」

だけを持たせる。

具体的な、

* Data
* Symbol
* File
* Framework
* Repository
* DB
* API

は埋め込まない。

---

---

## 8. Data Flowをユーザー理解の中心に置く

Process骨格そのものより、

> **Process間を何のDataが移動し、どこでどう変化するか**

をユーザー自身が記録する比重を高くする。

例えば、

```text
Receive
   │
   │ LoginInput
   ▼
Validate
   │
   │ ValidatedLoginInput
   ▼
Verify
   │
   │ User / AuthenticationResult
   ▼
Session生成
```

とする。

各Data Edgeについて最低限、

* 何が渡るか
* どう変化するか（任意）
* 根拠となるSymbol

を記録できるようにする。

---

---

## 9. AIによるProcess支援

AIがProcess構造を自動確定しない。

AIの主な役割は、

> **Templateと実コードとの差分を提示すること**

とする。

例えばAuthentication Templateに対して、

```text
Password検証
↓
Session生成
```

という骨格があるが、

実コードに、

```text
MFAService.verify()
```

が存在した場合、

AI：

> 「MFA検証Processが追加されている可能性があります」

と候補を提示する。

候補は、

* 追加
* 削除
* 分割
* 統合
* 順序変更

を含み得る。

ユーザーが最終確定する。

---

---

## 10. 点 ― Code Editor / Code Wikipedia

Processに関連するSymbolを選択すると、アプリ内のコード画面へ降りる。

点の目的は、

> **実コードから具体的な意味を理解すること。**

コード上のSymbolや式を起点として、

* Definition
* Caller
* Callee
* Implementation
* DI元
* Type
* Data origin
* Data destination
* 関連Process

などへ移動できる。

---

---

## 11. Semantic Link

コード上の関係をWikipediaのHyperlinkのように辿れるようにする。

例：

```text
ProfileService
↓
UserRepository
↓
PrismaUserRepository
↓
User
```

一度確認した関係はSemantic Linkとして保存し、

> 毎回検索queryを作り直す必要を減らす。

Semantic Linkは、

1. ユーザーのNavigation
2. Process間Relationの根拠
3. AI Context RetrievalのPointer

という複数用途で利用する。

---

---

## 12. User Memo

コード画面ではSemantic Linkだけでなく、ユーザー自身のMemoを記録できる。

例：

```text
UserRepository

自分のメモ：
「ServiceからDB実装へ降りる境界として理解」
```

MemoはSource Codeへ書き込まない。

アプリ側のUser Contextとして保存する。

Memo、自分の説明、理解状態は**ユーザー所有情報**とする。

---

---

## 13. 「自分で作るCode Wikipedia」

AIが完成したWikiを自動生成することを目的としない。

基本ループは、

```text
コードを見る
↓
ユーザーが自分の説明を書く
↓
AIがCode Modelと比較
↓
不足・矛盾・確認点を提示
↓
ユーザーがコードを確認
↓
自分で修正
```

とする。

AIはWriterではなく、

> **Socratic Editor / Reviewer**

として振る舞う。

---

---

## 14. AIによる学習支援

AIは初手から完成回答を出さない。

支援は段階化する。

```text
Level 0
自分で考える

↓
Level 1
関連箇所へのリンク

↓
Level 2
着目点

↓
Level 3
概念ヒント

↓
Level 4
部分説明

↓
Level 5
ユーザーが明示要求した場合のみ完成説明
```

基本は、

> 自己説明 → 不足指摘 → ヒント → 再確認

とする。

---

---

## 15. Relation / Dependency

ProcessやSymbol間の関係には型を持たせる。

MVP候補：

```text
NEXT
DATA
USES
READS
WRITES
CALLS
```

必要に応じて、

```text
INJECTS
IMPLEMENTS
```

などを追加する。

Relationは、

> 二つのEntity間の型付き関係

Dependencyは、

> Relationのうち、一方の成立・振る舞い・Dataが他方に影響する関係

と定義する。

---

---

## 16. 点 → 線 → 面への集約

具体コードで確認した関係を上位へ集約する。

例：

```text
Symbol A
--DATA-->
Symbol B
```

から、

```text
Process A
--DATA-->
Process B
```

へ。

さらに、

```text
Feature A
--USES-->
Feature B
```

へ抽象化できる。

つまり、

> **具体を理解するほど、線と面のMental Modelが育つ。**

---

---

## 17. Graph表示

面ではGraph表示を利用できる。

ただし巨大なFunction-level Graphを最初から表示しない。

基本は、

```text
Feature
↓
Process
↓
必要時のみSymbol
```

というProgressive Disclosureを採用する。

Graphは「関係の面」を理解するための表示とする。

線は「順序」を理解する。

---

---

## 確定したProcess / Relation / Data Flow仕様（旧45.2）

Process Templateは次の7種類とCustomに確定する。

```text
Create
Read
Update
Delete / State Change
Authentication
External Integration
Event / Background Processing
Custom
```

Process Primitiveは次のとおりとする。

```text
Receive / Identify / Retrieve / Validate / Authorize
Transform / Execute / Persist / Notify-Emit / Return
```

MVPでは`1 Process = 1 Feature`とし、Processを複数Featureへ所属させない。

Relationは構造的事実と意味的関係を分離する。

```text
Structural Relation:
CALLS / IMPLEMENTS / INJECTS / READS / WRITES

Semantic Relation:
NEXT / DATA / USES / DEPENDS_ON
```

Structural RelationからSemantic Relationへの自動変換は行わない。

Data Flowは以下を保持する。

```text
Data Name: 必須
Transformation: 任意
Type / Symbol Link: 任意
Evidence: 0..N
```

Data FlowのVerificationとFreshnessは別軸で管理する。USERが正本を作成し、AIはHintまたはProposalのみを生成できる。

---

### 現在のプロダクトを一文で定義すると

> **AIコーディングによって分散・高速変更されるコードについて、アプリ全体を俯瞰する「面」、Feature → Process → SymbolとData Flowを追う「線」、実コードをWikipedia的なSemantic Linkと自分自身のMemo・説明によって理解する「点」を往復しながら、自分自身のMental Modelを育てる独立型プログラム理解支援アプリ。AIはそのMental Modelを代筆せず、構造解析、候補提示、問い、ヒント、矛盾検出、変更差分の提示によって理解を補助する。**
