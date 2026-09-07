# CodeContour（コード・コンター）

## プロダクトの設計思想

> 以下は、CodeContourのプロダクト原則・思想をまとめた現時点のドラフトです。

---

# プロダクトの原則・思想

## 最上位思想

このプロダクトの最上位思想は、

> **AIがコードを理解してくれる状態を作るのではなく、AIによって高速に生成・変更されるコードを、人間自身が理解・説明・予測できる状態を作る。**

ことである。

AIコーディングによって「実装できること」と「その実装を理解して保守できること」の間に生じた差を埋める。

その際、単にコード解説を大量に生成するのではなく、

> **学習に不要な探索・Navigation・位置保持の負荷はシステムへ外部化し、意味付け・説明・関連付け・変更予測という、理解に必要な思考はユーザー自身に残す。**

ことを基本とする。

---

# 1. コードを「点・線・面」で理解する

コードそのものだけを読んで全体像を頭の中で構築することを要求しない。

理解対象を、

**面 → 線 → 点**

という異なる抽象度から見る。

**面**ではアプリ全体をFeature単位で俯瞰し、「何が存在するか」「どの機能を理解したいか」「機能同士がどう関係しているか」を見る。

**線**では、選択したFeatureについて、

> Feature → Process → Symbol

へ具体化しながら、主要な処理順序とData Flowを理解する。

**点**では実際のSource Codeへ降り、Function、Class、Type、DI、Dataなど具体的なコードの意味を理解する。

そして、

> **面 → 線 → 点**

だけでなく、

> **点 → 線 → 面**

へ戻れることを重視する。

具体コードから得た理解によって、ProcessやFeatureの全体像が育つ構造とする。

---

# 2. 抽象と具体の往復を理解の中心にする

このプロダクトは、

> 「コード1行ずつ理解できれば全体も理解できる」

とは考えない。

コード上の具体から、

```text
Symbol
↓
Process
↓
Feature
↓
アプリ全体
```

へ登り、

再び、

```text
Feature
↓
Process
↓
Symbol
↓
Source Code
```

へ降りる。

ユーザーが今見ているコードについて、

> これは何のFeatureに属するのか
> どのProcessの一部なのか
> どのDataを扱っているのか

を常に確認できる状態を作る。

---

# 3. 良い責務分割によって、人間の理解まで分断させない

保守しやすい設計では、責務が分離されるほどFileやModuleは増える。

これはソフトウェア設計上は望ましくても、人間側では、

> 次はどのFileを見るのか
> このFunctionはどこだったか
> このDIはどこから来たのか
> 以前調べた箇所をまた検索する

という負荷を生む。

このプロダクトは、責務分離そのものを否定するのではなく、

> **分散したコードの意味的な連続性を再構築する。**

ことを目的とする。

---

# 4. 検索する環境から、意味をリンクで辿る環境へ変える

コードを理解するたびに検索Queryを再構築させない。

点のCode画面では、Symbolや式にSemantic Linkを持たせ、

```text
定義
実装
Caller
Callee
DI元
Type
Data origin
Data destination
関連Process
```

などへ直接移動できるようにする。

目指すのは、

> **コードのWikipedia**

である。

ただしWikipediaをAIが自動生成するのではない。

リンクを辿りながら自分自身が理解を積み重ねるための環境とする。

---

# 5. Wikiを書く主体はユーザーである

AIが、

> 「このFunctionは○○です」

と完成した説明を最初から返すことを基本としない。

ユーザー自身が、

> これは何をしていると思うか
> なぜこの依存があると思うか
> 何のDataが流れていると思うか

を書き、自分自身のMental Modelを作る。

AIはその文章を代筆するのではなく、

> 不足している観点
> 実コードとの矛盾
> 確認した方がよい箇所
> 次に考える問い

を提示する。

したがって、

> **AIはWiki Writerではなく、Socratic Editor / Reviewerである。**

---

# 6. 探索の負荷は減らすが、思考の負荷は奪わない

このプロダクトでは、すべての認知負荷を減らすことを目的としない。

減らしたいのは、

* どのFileを見るか探す
* 同じSymbolを再検索する
* Definitionを再び探す
* 依存先を記憶しておく
* 前に見た場所へ戻る
* 大量Fileの中から関連箇所を探索する

といった負荷である。

一方、

* これは何を意味するか
* なぜこのProcessが必要か
* どのDataが流れているか
* なぜこのDependencyが存在するか
* ここを変えると何が起こるか

については、ユーザー自身に考えてもらう。

> **学習に必要な摩擦は残し、学習に不要な摩擦を消す。**

---

# 7. Data Flowをコード理解の中心に置く

Process名を覚えることより、

> **そのProcess間を何のDataが移動し、どこで何に変化するか**

を理解することを重視する。

例えば、

```text
Receive
   │ LoginInput
   ▼
Validate
   │ ValidatedLoginInput
   ▼
Identify User
   │ User
   ▼
Verify
   │ AuthenticationResult
   ▼
Create Session
```

という理解である。

Process骨格はある程度システムが提供してよい。

一方、Data Edgeについてはユーザー自身の記録比率を高くする。

---

# 8. Process Templateは「答え」ではなく足場である

Create、Read、Update、Authenticationなど、多くのアプリで共通するProcessについては、初期理解用Templateを用意する。

目的は、

> 毎回「入力→検証→保存」のような一般構造をゼロから考えさせない

ことである。

ただしTemplateには、

> 何をするか

だけを含め、

> どのDataか
> どのSymbolか
> どのFileか
> どのFrameworkか

までは決めない。

AIはTemplateを完成させる主体ではなく、

> **実コードとTemplateとの差分**

を提示する。

---

# 9. Process同士の関係からDependencyを理解する

Processの順序とDependencyを別世界として扱わない。

例えば、

```text
Validation
   │ ValidatedUserInput
   ▼
User生成
```

なら、

User生成ProcessはValidationの出力に依存している。

点で確認したSymbol間Relationを、

```text
Symbol
↓
Process
↓
Feature
```

へ集約する。

これによって、

* 点ではCode Dependency
* 線ではProcess Dependency
* 面ではFeature Dependency

として、同じ関係を異なる抽象度から理解できる。

---

# 10. 変更影響はDependency理解の応用とする

「ここを変更すると何が起こるか」を、AIの推測だけで答えさせない。

まず、

> 何とつながっているか
> どのDataに依存しているか
> どのProcessが後続するか

を理解する。

その上で、

> **この変更がRelationを通じてどこへ伝播するか**

を予測する。

変更影響予測は、Data FlowとDependency理解の到達点として扱う。

---

# 11. 構造的事実・AI推定・User Mental Modelを混同しない

Feature Contextには異なる種類の知識が存在する。

**Code Fact**

Git、AST、LSP、静的解析等から確認された構造。

**AI Interpretation**

AIによる意味・責務・Process等の推定。

**User Context**

ユーザー自身の説明、Memo、意味付け、理解。

これらを同じ「事実」として保存しない。

特にAI推定には、

> AI推定であること
> 根拠となったSource
> 推定確度

を明示する。

---

# 12. AIの確度を偽精密に扱わない

AI推定について、

> 87%正しい

のような数字は原則用いない。

代わりに、

```text
高
中
低
```

程度で扱う。

確度はContext量だけではなく、

* Source Evidenceの強さ
* Call/Data Graphとの整合
* Contextの充足度
* 解釈の曖昧さ

から判断する。

---

# 13. AIにできること・できないことをPromptではなく構造で決める

AIに、

> 「User Memoを書き換えないでください」

と依頼するだけでは不十分である。

そもそもAIがUser Contextを書き換えられない構造にする。

```text
Code Fact Store
AI Proposal Store
User Context Store
```

を分離する。

AIはUser Contextを参照できても、更新Capabilityを持たない。

AIには、

```text
update_user_memo()
update_user_explanation()
set_understood()
```

のようなToolそのものを与えない。

> **禁止をPromptで実現するのではなく、Capabilityを与えないことで実現する。**

---

# 14. SYSTEM・AI・USERの責務を分離する

基本的な役割は、

```text
SYSTEM
構造的事実を取得・更新する

AI
候補・問い・意味推定を生成する

USER
Mental Modelを構築・修正する
```

とする。

AIがユーザーの理解を書き換えることも、ユーザーがCode Factを直接書き換えることも基本的に許さない。

---

# 15. AI ProposalとUser Contextを分離する

AIが、

> 「MFA Processが追加されている可能性があります」

と考えた場合、その情報をUser Wikiへ直接反映しない。

AI Proposalとして保存する。

ユーザーが確認し、

> 自分の理解として採用する

ことで初めてUser Contextへ反映する。

User Memoや自分の説明については、AI Proposalからのワンクリック文章置換すら基本的に行わず、自分で書き直すことを重視する。

---

# 16. User Contextには間違える自由を残す

Mental Model形成の途中では、ユーザーが誤った理解を書くこともある。

それを禁止しない。

代わりに、

```text
UNVERIFIED
CONSISTENT
QUESTIONABLE
CONTRADICTED
STALE
```

などの状態を持たせる。

AIは正解文章へ自動修正するのではなく、

> 「この記述と実コードには矛盾がある可能性があります」

とSource Evidenceを提示する。

ユーザー自身が再確認して修正する。

---

# 17. 一度得た理解を捨てず、再利用する

同じFeatureについて新しいProcessを学ぶたびにRepositoryをゼロからAI解析しない。

一度得た、

* Feature概要
* Process
* Symbol
* Data
* Relation
* Source Evidence
* User Context

を**Feature Context**として保存する。

次回は、

> Feature Context + 今回対象のProcess

から開始する。

> **一度獲得した理解を、次の理解の足場として再利用する。**

---

# 18. Feature ContextはAIキャッシュではなく知識基盤である

Feature Contextは単なるToken節約ではない。

役割は、

* AI Context Cache
* Navigation Index
* User Mental Model
* Change Detection Baseline
* 学習履歴

である。

したがって、Feature Context自身も、

```text
Structural Context
Semantic Context
User Context
Provenance Context
```

へ分離する。

---

# 19. Repository全文をAIへ送らない

AIはRepository全体を自由探索しない。

まずローカルで、

* Symbol
* Route
* Call
* Import
* Type
* Data
* Test
* Git

などをIndex化する。

AIには圧縮されたSemantic Contextから渡す。

必要な場合だけ、

```text
Summary
↓
Symbol
↓
Signature
↓
AST Block
↓
Function Body
```

へ段階的に具体化する。

---

# 20. Semantic LinkはAI ContextのPointerでもある

Semantic Linkは人間が移動するためだけのものではない。

例えば、

```text
[UserRepository]
```

というLinkは、

> UserRepository全文をContextへ含める

という意味ではない。

> **必要になった場合にその情報を取得できるPointer**

として使う。

これにより、Wikipediaのように必要なリンクだけ展開する。

---

# 21. AIが読むコードは「File単位」ではなく「疑問単位」

AIが、

> DI元を確認したい

ならDI binding周辺だけ読む。

> Data Transformationを確認したい

なら該当AST Blockだけ読む。

> Callerを確認したい

なら直接Caller周辺だけ読む。

> **File全文を読むことを基本動作にしない。**

正確性に必要な場合だけContextを広げる。

---

# 22. 構造とData FlowをKeyword一致より優先する

関連File候補を探す際、

```text
auth
user
login
```

のような文字列一致だけに頼らない。

優先するのは、

1. Entry Pointとの構造距離
2. Call Graph接続
3. Data Flow接続
4. Framework Relation
5. Type Relation
6. Test Evidence
7. Semantic Link
8. Keyword / Semantic similarity

である。

> **名前より、実際につながっていることを強い根拠とする。**

---

# 23. Contextは必要なときだけ広げる

最初はCurrent Nodeと1-hop程度を見る。

不足する場合だけ、

```text
1-hop
↓
2-hop
↓
Source Evidence
```

と増やす。

AI自身には無制限のContext探索権限を与えない。

Context Managerを必ず介する。

---

# 24. Gitは「時間」の軸である

Gitを面・線・点と同列の画面階層にはしない。

Gitは、

> **面・線・点が時間によってどう変化したか**

を見るために利用する。

commit IDには、人間が認識しやすいSemantic Labelを付与できる。

---

# 25. コード変更と理解更新を別イベントとして扱う

コードが変更されたからといって、ユーザーの理解が自動的に更新されたことにはしない。

```text
Code Model
最新版

User Mental Model
旧状態
```

という状態を許容する。

コード変更時には、

> 「この理解の根拠コードが変わっています」

と通知する。

ユーザーが再度確認して初めて理解側を更新する。

---

# 26. AgeとStalenessを分ける

古い情報には二種類ある。

**Age**

最後に確認してから時間が経っている。

**Staleness**

根拠となるコードが変更されている。

時間が経っただけで「間違った情報」とは扱わない。

---

# 27. Repositoryはread-onlyで扱う

アプリがLocal Directoryを読む場合、

> ユーザーが明示的に選択したProject Root

のみを対象とする。

Source Repositoryは原則read-only。

Wiki、Memo、理解状態などはアプリ側に保存する。

---

# 28. `.gitignore`はApplication Ignore Policyとして扱う

`.gitignore`に最終的に一致するPathは、

> Gitでtrackedかどうかにかかわらず、

アプリでは原則読み込まない。

さらにSecret、Credential等について独自Security Ignore Rulesを持つ。

---

# 29. Local ReadとAI Transmissionを分離する

Repositoryをアプリがローカルで読むことと、

> External AIへSource Codeを送ること

を同じ権限として扱わない。

```text
Local Read Permission
≠
AI Transmission Permission
```

とする。

AIへ送るContextは別のPolicyで判断する。

---

# 30. Repository内容を信頼しない

Source Code、README、Commentなどに書かれている文章はAIへの命令として扱わない。

Repository内容は、

> **解析対象となるUntrusted Data**

である。

AIにShellやFilesystemへの自由なアクセス権を与えない。

---

# 31. 「すべてを理解する」ことを目標にしない

Repository全体について、

> 理解度73%

のような完全性指標を主要目標にしない。

ユーザー自身が、

> 今回理解したいFeature / Process

をScopeとして設定する。

その範囲で、

* 役割
* Data Flow
* Dependency
* Change Impact

などを確認する。

> **理解には深さと範囲があり、すべてを同じ深度まで学ぶ必要はない。**

---

# 32. Navigationそのものを悪としない

Semantic Linkを辿ることは学習行動なので、

> Navigation回数が少ないほど良い

とはしない。

減らしたいのは、

* 同じSymbolのRepeated Search
* 一度調べた場所の再探索
* 無目的なFile往復
* 目的のSymbolへ到達するまでの余分な探索

である。

> **迷わず辿るNavigationは促進し、迷子Navigationを減らす。**

---

# 33. 独立アプリであること自体が思想の一部

このプロダクトは既存IDEのExtensionではない。

独立Applicationとして、

```text
面
↕
線
↕
点
```

を視覚的に切り替えながら理解する体験を中心にする。

コードEditor画面も、このアプリの「点」を構成する理解画面である。

---

# 34. 言語非依存を思想とする

プロダクト思想として、

> TypeScriptコード理解アプリ

にはしない。

Feature、Process、Data Flow、Dependency、Symbolという概念は言語を超えて扱えるようにする。

ただしMVPでは技術的都合から対応言語を限定してよい。

> **思想上のLanguage Agnosticと、実装上のSupported Languageを分離する。**

---

# 35. プロダクトを肥大化させない

このアプリは、

* AI Coding Agent
* IDE
* Git Client
* Notion
* Static Analysis Platform
* Security Scanner
* LMS

を統合する製品ではない。

中心はあくまで、

> **自分自身がコードのMental Modelを構築するための理解環境**

である。

新しい機能を追加する際は、

> 「面・線・点の理解を助けるか」
> 「探索負荷を減らすか」
> 「ユーザー自身の思考を奪わないか」

で判断する。

---

# プロダクト思想を短くまとめると

> **コードをAIに説明してもらうのではなく、自分で説明できる状態を作る。**

> **検索して覚えるのではなく、意味をリンクで辿り、自分の知識として残す。**

> **機械には構造的事実を扱わせ、AIには候補・問い・推論を扱わせ、人間には意味付けと理解を残す。**

> **コードを点だけで読まず、線で流れを理解し、面で全体との関係を理解する。**

> **一度作ったMental Modelを使い捨てず、コードの変化に合わせて自分自身で更新していく。**

そして最も抽象度の高い一文にすると、

> **AIコーディング時代に、人間がコードの所有権ではなく「理解の所有権」を取り戻すためのプロダクト。**

### 曖昧点・今後の表現上の注意

「AIが補助する」という表現だけでは役割が広すぎるため、要件では **Analyze / Propose / Question / Verify / Never Mutate User Context** のようにAI Capabilityを具体化すると、思想と実装のずれを防ぎやすくなります。また「Wikipedia」は分かりやすい比喩ですが、製品上は「AI生成ドキュメント」と誤解されやすいため、**自分自身が育てるSemantic Knowledge Layer**という意味を併記する方が正確です。

### 根拠・参考資料

* Ko, Myers, Coblenz & Aung, *An Exploratory Study of How Developers Seek, Relate, and Collect Relevant Information during Software Maintenance Tasks*, IEEE Transactions on Software Engineering, 2006. コード理解における探索、Navigation、関連情報保持の負荷を観察。
* Sillito, Murphy & De Volder, *Asking and Answering Questions during a Programming Change Task*, IEEE Transactions on Software Engineering, 2008. 開発者が変更作業中にコード位置・依存・関係について繰り返し行う情報探索を整理。
* Chi et al., *Self-Explanations: How Students Study and Use Examples in Learning to Solve Problems*, Cognitive Science, 1989. 自己説明によるMental Model形成の基礎研究。
* Chi & Wylie, *The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes*, Educational Psychologist, 2014. 学習者自身が意味や関係を生成するconstructive activityの重要性を整理。
* Roediger & Karpicke, *Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention*, Psychological Science, 2006. 再読だけでなく自力で想起することが長期保持へ寄与することを示した研究。
* Alanazi, Gharibi & Lee, *Facilitating Program Comprehension with Call Graph Multilevel Hierarchical Abstractions*, Journal of Systems and Software, 2021. 大規模コード構造を複数の抽象度から理解する方式を検討。
* Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, Transactions of the ACL, 2024. LLMへ大量Contextを投入するだけでは情報利用が保証されないことを示した研究。
* Zhang et al., *RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation*, EMNLP, 2023. Repository全体ではなく関連Contextを反復取得する方式を提案。
* Saltzer & Schroeder, *The Protection of Information in Computer Systems*, Proceedings of the IEEE, 1975. Least Privilege、Complete Mediation等、AI Capabilityをシステム側で制約する今回の思想にも通じるアクセス制御原則。
