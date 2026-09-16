# CodeContour（コード・コンター）

## 仮要件定義（現時点のドラフト）

> 以下は、ここまでの議論を統合した現時点の要件定義ドラフトです。

---

以下を、ここまでの議論を統合した**現時点の要件定義ドラフト**として整理できます。
「決まっていること」と「まだ詳細設計・PoCで決めること」を分離しています。

# 1. プロダクト概要

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

# 2. 対象ユーザー

主対象は、

> **AIコーディングによってアプリ開発自体は進められるが、生成・変更されたコードについて、全体構造・Data Flow・Dependency・Symbolの役割を追跡し、自分が保守できるMental Modelを構築したい開発者**

とする。

「プログラミング初心者専用」には限定しない。

MVPは個人利用を前提とする。

---

# 3. アプリ形態

既存IDEのExtensionではなく、**独立したApplicationとして提供する**。

理由は、単なるコード閲覧ではなく、

> **面 ↔ 線 ↔ 点**

を視覚的に往復することそのものが主要なユーザー体験だからである。

アプリ内部にはコード表示画面を持つが、MVPではSource Code編集を目的としない。

---

# 4. プロダクトの中心モデル

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

## 面 ― Feature Map

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

# 5. 線 ― Feature → Process → Symbol

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

# 6. 初期理解用Process Template

Processを毎回ゼロから構築させない。

一般的な処理骨格については、アプリ側に**初期理解用Process Template**を用意する。

MVPでは以下の7種類とCustomを正式なTemplateとして扱う。

例：

### Create

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

### Read

```text
Receive Criteria
↓
Retrieve
↓
Filter / Transform
↓
Return
```

### Update

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

### Delete / State Change

### Authentication

### External Integration

### Event / Background Processing

### Custom

Templateは答えではなく、

> **理解開始時のScaffold**

として扱う。

---

# 7. Process Primitive

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

# 8. Data Flowをユーザー理解の中心に置く

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

# 9. AIによるProcess支援

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

# 10. 点 ― Code Editor / Code Wikipedia

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

# 11. Semantic Link

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

# 12. User Memo

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

# 13. 「自分で作るCode Wikipedia」

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

# 14. AIによる学習支援

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

# 15. Relation / Dependency

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

# 16. 点 → 線 → 面への集約

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

# 17. Graph表示

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

# 18. Feature Context

Featureごとに一度獲得した情報を、再利用可能な**Feature Context**として保存する。

Feature Contextは少なくとも、

```text
Structural Context
Semantic Context
User Context
Provenance Context
```

に分ける。

### Structural Context

* File
* Symbol
* Call
* Type
* Import
* Static Relation

### Semantic Context

* Feature
* Process
* Data
* Relationの意味
* Feature Summary

### User Context

* Memo
* 自分の説明
* 理解状態
* 自分で付けた意味

### Provenance Context

* Commit
* Hash
* Source Evidence
* 最終確認日時
* Staleness

---

# 19. Feature Contextの再利用

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

# 20. AI Context最小化

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

# 21. AIが読むコードの選択基準

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

# 22. Progressive Context Expansion

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

# 23. Context Cache

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

# 24. Gitの役割

Gitは面・線・点と並列の理解階層ではなく、

> **それらが時間とともにどう変化したかを見る時間軸**

として利用する。

利用項目：

* HEAD
* commit
* diff
* changed symbols
* Semantic Commit Label
* Feature Contextの根拠commit
* Staleness判定

Gitへのwrite操作はMVPでは行わない。

---

# 25. Feature ContextのIncremental Update

コード変更時にFeature Context全体を再生成しない。

Git・静的解析からChange Packetを作る。

例：

```text
Changed:
AuthService.login()

Added:
MfaService.verify()

Relation:
PasswordVerify
→ MFA
→ Session
```

既存Feature ContextとChange PacketだけをAIへ渡し、

更新対象のProcess / Data / Relationを推論する。

---

# 26. AgeとStaleness

二つを分離する。

### Age

```text
最終確認：72日前
```

時間が経過したことを示す。

### Staleness

```text
⚠ この説明の根拠コードが変更されています
```

コード変更による陳腐化を示す。

Feature全体ではなくProcess / Symbol単位で部分的にStaleにできる。

---

# 27. User Contextの編集

Feature Context自体はSYSTEMが生成するProjection / Context Cacheであり、ユーザーが直接編集する正本ではない。

ユーザーは、Feature、Process、DataFlow、SemanticRelation、Memo、UserExplanation、SemanticLinkを正本として編集する。Feature Contextはこれらの正本からSYSTEMが再構築する。

ただしCode Fact自体は編集対象にしない。

Code Factに問題があると考えた場合は、

> 解析結果への異議・再解析要求

として扱う。

---

# 28. User Contextの誤り検出

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

# 29. AIによるUser Context修正は禁止

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

# 30. AI Proposal

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

# 31. Human Write Gateway

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

# 32. User Memoは特にAI自動反映禁止

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

# 33. Structural Contextは自動更新可能

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

# 34. AI推定の不確実性

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

# 35. Navigation指標

Navigation回数そのものを少ないほど良いとはしない。

Semantic Linkを使って関連コードを辿ることは望ましい学習行為だからである。

減らしたいのは、

* 同じSymbolのRepeated Search
* 同じFile間の無目的往復
* 一度確認したDefinitionの再検索
* 目的Symbol到達までの余分なStep

などの**迷子Navigation**とする。

---

# 36. 理解Scope

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

# 37. Local Repository Security

ユーザーが明示的に選択したProject Rootだけを読む。

原則read-only。

さらに、

* Root外アクセス禁止
* Symlinkはreal pathで検証
* コードを実行しない
* AIにFile System直接権限を与えない

とする。

---

# 38. `.gitignore` Application Ignore Policy

`.gitignore`に最終的に一致するPathは、

Gitでtrackedかどうかに関係なく、アプリでは原則読み込まない。

対象外：

* Source Reader
* Index
* AST解析
* Search
* Semantic Link生成
* AI Context

`.gitignore`自体はIgnore Policy構築のため読み込む。

加えて独自のSecurity Ignore Rulesも持つ。

---

# 39. AIへの外部送信

Local Repositoryへの読取許可と、External AIへの送信許可を分離する。

```text
Local Read Permission
≠
AI Transmission Permission
```

AIへ送るのはContext Managerが許可した最小Contextだけ。

Repository全文を一括送信しない。

Secret / Credential等は送信前に除外する。

---

# 40. Repository内コンテンツの信頼境界

README、Comment、Source Code等にAI向け命令が書かれていても、それをInstructionとして扱わない。

Repository内容は、

> **Untrusted Input**

としてAIへ渡す。

Indirect Prompt Injectionを考慮する。

---

# 41. MVPの非目標

明示的にMVP外とする。

* Source Code編集
* AIコード生成
* AI自動修正
* AI Coding Agent
* Terminal
* Debugger
* Source RepositoryへのGit write操作
* Repository全体のAI自動Wiki
* 完全自動Feature確定
* 完全自動Process確定
* 巨大Function-level Graph
* Runtime Trace
* CI/CD解析
* Cloud / Infrastructure Dependency
* 本格SAST
* Architecture採点
* チーム共同編集
* Role / Permission
* コメント・Mention
* XP / Badge / Ranking
* 汎用Wiki
* 汎用Memoアプリ
* AIによる完全Curriculum生成
* Source CodeへのMemo書込み
* Repository全文のLLM一括送信
* AIによる任意File探索
* AIによるShell実行

---

# 42. 言語について

プロダクト思想としては**言語非依存**とする。

ただしMVPですべての言語を解析可能にするわけではない。

```text
Product Principle:
Language Agnostic

MVP:
Supported Languagesを限定
```

と分ける。

MVPのCore LanguageはTypeScript、Python、PHPとする。Framework-aware解析はReact、Next.js、Django、FastAPI、CakePHP、Laravelを対象とする。

---

# 43. 現在の基本利用フロー

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

# 44. 現時点で残っている主な要件決定事項

ここまでで思想と主要要件はかなり固まっています。

今後決める必要があるのは主に以下です。

| 項目                    | 状態                      |
| --------------------- | ----------------------- |
| MVP対応言語               | TypeScript / Python / PHPに確定 |
| 対応OS                  | macOS / Windowsに確定。LinuxはMVP外 |
| Feature作成・編集仕様        | 詳細未決                    |
| 面の初期Feature生成方法       | 詳細未決                    |
| Process Template正式一覧  | 7種類 + Customに確定          |
| Process Primitive正式一覧 | 確定                      |
| Relation Type正式一覧     | Structural / Semanticともに確定 |
| Data Flow入力UI         | データ項目・所有権は確定、操作詳細は未決 |
| Symbol候補ranking条件     | 方針確定、重み未決               |
| AI Context Budget     | PoC事項                   |
| Graphの抽象化UI           | 未決                      |
| Memo付与可能単位            | Symbol中心、Expression等は未決 |
| Understanding State   | 独立軸モデルに確定               |
| Feature Context保存形式   | Projection / Chunk / Snapshot方針に確定、物理形式は未決 |
| Context履歴保存期間         | 未決                      |
| Git過去commit学習UI       | First Parent・Relevant History方針は確定、操作詳細は未決 |
| Local保存方法             | 技術設計事項                  |
| AIモデル                 | 未決・詳細設計事項               |

つまり、**「何を作るか」はかなり固まり、「具体的にどう操作させるか」を決める段階**まで来ています。

## 現在のプロダクトを一文で定義すると

> **AIコーディングによって分散・高速変更されるコードについて、アプリ全体を俯瞰する「面」、Feature → Process → SymbolとData Flowを追う「線」、実コードをWikipedia的なSemantic Linkと自分自身のMemo・説明によって理解する「点」を往復しながら、自分自身のMental Modelを育てる独立型プログラム理解支援アプリ。AIはそのMental Modelを代筆せず、構造解析、候補提示、問い、ヒント、矛盾検出、変更差分の提示によって理解を補助する。**

### 根拠・参考資料

* Ko, Myers, Coblenz & Aung, *An Exploratory Study of How Developers Seek, Relate, and Collect Relevant Information during Software Maintenance Tasks*, IEEE Transactions on Software Engineering, 2006. コード理解における探索・Navigation・関連情報保持の負荷を観察。
* Sillito, Murphy & De Volder, *Asking and Answering Questions during a Programming Change Task*, IEEE Transactions on Software Engineering, 2008. 開発者が変更作業時に必要とするコード位置・依存・関係に関する問いを体系化。
* Alanazi, Gharibi & Lee, *Facilitating Program Comprehension with Call Graph Multilevel Hierarchical Abstractions*, Journal of Systems and Software, 2021. 大規模コード構造を複数抽象度で提示するプログラム理解支援を検討。
* Chi & Wylie, *The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes*, Educational Psychologist, 2014. 自己説明など、学習者自身が知識を生成・構成する活動の重要性を整理。
* Chi et al., *Self-Explanations: How Students Study and Use Examples in Learning to Solve Problems*, Cognitive Science, 1989. 自己説明と理解形成の関係を分析。
* Roediger & Karpicke, *Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention*, Psychological Science, 2006. 自力での想起が長期保持に寄与することを示した研究。
* Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, Transactions of the ACL, 2024. 長いContextへすべての情報を投入しても有効利用が保証されず、関連Context選択が重要であることを示しています。
* Zhang et al., *RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation*, EMNLP, 2023. Repository全文ではなく関連Contextを反復的に取得する方式を提案。
* Saltzer & Schroeder, *The Protection of Information in Computer Systems*, Proceedings of the IEEE, 1975. Least PrivilegeやComplete Mediationなど、権限制御をシステム境界で強制する設計原則の基礎。

---

# 45. 確定要件追補

本章以降は、その後の設計議論で確定した要件をまとめた追補である。前章までの記述と矛盾する場合は、本追補を優先する。

## 45.1 MVP対応範囲

| 項目 | 確定内容 |
| --- | --- |
| 対応OS | macOS / Windows。LinuxはMVP外 |
| Core Language | TypeScript / Python / PHP |
| Framework-aware | React / Next.js / Django / FastAPI / CakePHP / Laravel |
| 解析Tier | Tier A: Deterministic、Tier B: Framework-aware、Tier C: Inferred / Dynamic |
| Tier A精度目標 | Precision 98%以上、Recall 95%以上 |
| Tier B精度目標 | Precision 95%以上、Recall 85%以上 |

精度目標はPoCで検証する目標値である。誤検出より`UNKNOWN`を優先し、`UNKNOWN`を一級状態として扱う。

## 45.2 Process / Relation / Data Flow

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

# 46. Feature / Process状態モデル

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

# 47. User ExplanationのVerification

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

# 48. Feature Contextの位置付け

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

# 49. GitとLearning Log Repository

Source Repositoryは引き続きread-onlyとし、Git writeを禁止する。

一方、CodeContour専用のLearning Log Repositoryには、ユーザーの明示操作に限りcommit / pushを許可する。

```text
Source Repository:
READ ONLY

Learning Log Repository:
WRITE ALLOWED by explicit user action
```

Git時間軸は次の3状態を正式にサポートする。

```text
Working Tree
HEAD
Historical Commit
```

Historical Commitはcheckoutせず、Git Objectから読み取る。MVPのBefore / After比較はFirst Parent基準とする。

Feature / Process / SymbolごとにRelevant Historyを提供し、Previous / Next Relevant Commitへ移動できるようにする。

# 50. Learning機能

## 50.1 Learning Session

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

## 50.2 Learning Record

Learning RecordはSession終了時に確定し、保存後は原則Immutableとする。

```text
Project
Primary Feature
CodeSnapshot
User Reflection
Evidence
開始・終了時刻
```

# 51. GitHub Learning Log

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

# 52. Engineering Evidence / Engineering Radar

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

# 53. Public Snapshot / Public Profile

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

# 54. 認証とLogin Gate

Local利用にログインを要求しない。認証が必要なのは次の外部機能を利用する場合に限る。

```text
GitHub Learning Log
Public Snapshot公開
Public Engineering Profile公開
将来のCloud Sync
```

外部機能の操作時にLogin Gateを表示し、認証後は`returnPath`を使って元の操作へ戻す。起動直後にLogin画面を配置しない。

# 55. 画面構成

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

# 56. Error / Recovery

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

# 57. Undo / Redo

Session内のUser Context編集について、次の操作にUndo / Redoを提供する。

```text
Process Add / Delete / Rename / Reorder
Process Split / Merge
Data Flow編集
Semantic Relation編集
```

複合変更は`UserCommand`単位でAtomicに戻す。Git PushやPublic Publishなど外部Side EffectはUndo対象外とする。

# 58. 論理データモデル

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

# 59. Delete / Versioning規則

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

# 60. Write権限境界

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

# 61. AI Proposal適用方式

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

# 62. Change PacketとSTALE伝播

Change Packetは次の種類を持つ。

```text
SYMBOL_ADDED
SYMBOL_REMOVED
SYMBOL_MOVED
SYMBOL_RENAMED
BODY_CHANGED
SIGNATURE_CHANGED
TYPE_CHANGED
CALL_RELATION_CHANGED
INJECTION_CHANGED
READ_WRITE_CHANGED
```

STALEは次の向きへ局所的に伝播する。

```text
Changed Code
↓
EvidenceBinding
↓
直接関連するUser Context
↓
Process等の局所Context
↓
Feature aggregate
```

Featureが`STALE`になったことを理由に、全子要素を`STALE`へ変更する逆伝播は行わない。Move / Rename後もSourceAnchorを再解決できた場合は`CURRENT`を維持できる。

# 63. Evidence Engine

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

# 64. Event / Guard / Effect

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

# 65. 正式化する主要Sequence

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

# 66. Backup / Export

完全Backup / Restoreには`.codecontour`形式を使用し、人間可読ExportにはMarkdownを使用する。

Source Repository自体はBackupへ含めない。Repositoryが利用できない状態でもUser Wiki / Learning Contextを復元し、Source参照は`UNRESOLVED`として保持する。

# 67. 非機能目標

代表Repositoryの想定規模と応答時間の設計目標を次のように定める。

```text
代表Repository:
100k LOC以下
10k files以下

Code表示:
500ms以下

面 ↔ 線 ↔ 点:
300ms以下

Symbol Search:
1s以下

Semantic Link:
500ms以下

初回Structural Index:
60s以下
```

AI処理の待機によって、非AI操作をBlockingしない。
