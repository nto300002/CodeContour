# MVP Scope・受入条件・実装順

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

```text
Status: FIXED
Decision: MVP-2026-09-16
```

> 本文書はCodeContour MVPの正規仕様である。ほかの文書とMVP範囲が矛盾する場合は、本文書を優先する。

## 1. MVPで検証する問い

MVPで検証する問いを次の1つに固定する。

> **複数ファイルに分散したコードについて、Feature → Process → Symbolを往復し、Data Flowと自分の説明を記録することで、従来よりMental Modelを作りやすくなるか。**

MVPの製品範囲は、コードを自分で理解し、その理解をコード変更後も維持するところまでとする。

```text
MVP:
理解する
理解を記録する
コード変更後に理解の鮮度を確認する

POST-MVP:
学習成果を蓄積する
能力を評価する
GitHubへ実績を残す
外部公開する
```

## 2. MVP Core

| 領域 | MVPで提供する範囲 |
| --- | --- |
| OS | macOSのみ |
| Language | TypeScriptのみ。TS / TSXを対象とする |
| Framework | Framework固有Adapterなし |
| Desktop | Electron + React + TypeScript |
| Analyzer | TypeScript Compiler API |
| Repository | Local Git Repositoryを1件ずつ扱う |
| Security | Root制限、`.gitignore`、Security Ignore、read-only |
| Structural Index | File / Symbol / Import / Definition / direct Call / Type |
| 面 | Feature Map |
| Feature | Userによる手動作成 + 根拠の強いSYSTEM Candidate |
| 線 | Feature → Process → Symbol |
| Process | Template選択 + User編集 |
| Data Flow | Userによる手動作成 |
| 点 | Read-only Code Viewer |
| Navigation | Definition / Caller / Callee / Type / Related Process |
| Semantic Link | Userによる作成・保存・再利用 |
| User Explanation | 作成・保存・明示操作によるVerification |
| AI | User Explanation Verificationのみ |
| Git | Working Tree / HEAD差分による局所的なSTALE判定 |
| Local保存 | SQLite |
| AI方式 | Cloud APIのみ |
| AI送信 | Verificationに必要なSymbol周辺だけ |
| Error State | UNKNOWN / STALE / CONTRADICTEDを分離 |

プロダクト思想はLanguage Agnosticを維持する。TypeScript限定はMVPの実装上の選択であり、製品思想の制約ではない。

## 3. Feature Candidate

MVPではFeatureをユーザーが手動作成できることを基本とする。

```text
Feature
├ Userが手動作成
└ SYSTEM Candidate
   └ 根拠が明確なEntry Pointからのみ生成
```

SYSTEM Candidateの対象候補は次のとおりとする。

- Route
- Page
- Controller相当のEntry Point
- exportされた主要Handler

AIによるRepository全体のFeature推定はMVP外とする。Candidateはユーザーが採用、Renameして採用、または非表示にする。SYSTEMやAIが直接`CONFIRMED`へ変更してはならない。

## 4. Process Template

次の7種類とCustomをMVPへ含める。

```text
Create
Read
Update
Delete / State Change
Authentication
External Integration
Event / Background
Custom
```

MVPの操作は次に限定する。

```text
Templateを選択
↓
UserがProcessを追加・削除・Rename・並べ替え
```

AIによるTemplateとの差分分析、Process生成、Split / Merge ProposalはMVP外とする。

## 5. 面：Feature Map

MVPでは次を提供する。

- Feature Node表示
- Feature追加
- 名前変更
- Archive
- Feature選択
- 簡単なRelation
- STALE表示
- Feature選択から線への移動

次はMVP外とする。

- 高度な自動Layout
- 大規模Graph最適化
- AIによるFeature Relation推定
- Feature Dependencyの自動集約
- Historical Feature Map

## 6. 線：Process / Data Flow

MVPで最も重視する領域とする。

```text
Feature
↓
Process
↓
Data Flow
↓
Related Symbol
```

MVPでは次を提供する。

- Processの追加・削除・Rename・順序変更
- Data Nameの入力
- Transformationの任意入力
- Evidence Symbolの関連付け
- Related Symbolの登録

Data FlowのMVP状態は次に限定する。

```text
UNVERIFIED
EVIDENCED
STALE
```

Data Flow自体に対するAIの`QUESTIONABLE / CONTRADICTED`判定はMVP外とする。

## 7. 点：Code Viewer

Code Viewerは次の3ペインを基本とする。

```text
左: File / Symbol Tree
中央: Read-only Source
右: Symbol Inspector
```

MVP Navigationは次のとおりとする。

- Definition
- Caller
- Callee
- Type
- Related Process
- Semantic Link

解析不能な関係は推測で補わず`UNKNOWN`として表示する。

次はMVP外とする。

- 高度なDI Source解析
- Data Origin / Destinationの自動追跡
- Framework Runtime Binding推定

## 8. User Explanation Verification

User ExplanationはMVPの中核機能とする。AIを使用するMVP機能は、User Explanation Verificationのみに限定する。

```text
コードを見る
↓
自分の説明を書く
↓
保存
↓
UNVERIFIED
↓
[コードと照合する]
↓
VERIFYING
↓
CONSISTENT / QUESTIONABLE / CONTRADICTED
```

次の規則を守る。

- 保存だけではAI Verificationを実行しない
- Userの明示操作でのみAIへ送信する
- 説明本文の編集後は`UNVERIFIED`へ戻す
- AIはUser Explanation本文を変更できない
- AIは結果、根拠、確認すべき箇所だけを提示する
- AI停止中でもVerification以外のLocal機能を利用できる

次のAI機能はMVP外とする。

- AI Feature検出
- AI Process生成
- AI Data Flow生成
- AI Dependency生成
- AI Radar

## 9. Git / STALE

MVPではWorking TreeとHEADの差分だけを扱う。

```text
Symbol content hash
Signature
関連Evidence
↓ 変更
UserExplanation / DataFlow Evidence
↓
STALE
```

目的は、関連Symbolが変更された場合に、対応するExplanationまたはData Flowだけを`STALE`にすることである。ユーザーが再確認した後、`CURRENT`へ戻せるようにする。

次はMVP外とする。

- Historical Commit選択
- Before / After
- Relevant History
- Previous / Next Relevant Commit
- Semantic Commit Label
- rebaseの高度な追跡
- 過去Feature Map

## 10. SourceAnchor

最終データモデルの`SourceAnchor → SymbolOccurrence × Snapshot`は維持するが、MVPのAnchor Matchingは次の情報を中心に簡略化する。

```text
qualifiedName
relativePath
signatureHash
```

Rename / Move後に自動解決できない場合は`ORPHANED`とし、ユーザーが再接続できるようにする。高度なRename / Move / rebase追跡はMVP外とする。

## 11. Local Storage

MVPの正本はLocal SQLiteへ保存する。

対象には少なくとも次を含む。

```text
Feature
Process
DataFlow
Memo
UserExplanation
SemanticLink
SourceAnchor
Evidence
```

MarkdownはExport形式として位置付ける。`.codecontour` Backup / Restore、Migration UI、Cloud SyncはMVP外とする。

## 12. Desktop / Analyzer / AI技術

MVPの技術選択を次のように固定する。

```text
Desktop: Electron
UI: React + TypeScript
Analyzer: TypeScript Compiler API
Local Storage: SQLite
AI: Cloud API
```

Tauri、Local Model、Tree-sitterによる多言語抽象層はMVP後に再検討する。

AI Verificationへ渡すContextは次の最小範囲を基本とする。

```text
User Explanation
Current Symbol
Signature
Function body
直接Caller / Callee
必要なType
```

Repository全文を送信しない。将来の拡張に備えてContext BuilderのInterfaceは分離する。

## 13. MVP外として凍結する設計

次の設計は破棄せず、`DESIGNED / POST-MVP`として凍結する。

| 機能 | 状態 |
| --- | --- |
| Learning Session / Record / Calendar | DESIGNED / POST-MVP |
| GitHub Learning Log / GitHub認証 | DESIGNED / POST-MVP |
| Engineering Evidence / Radar / Skill Rubric | DESIGNED / POST-MVP |
| Public Snapshot / Profile / Web Viewer | DESIGNED / POST-MVP |
| Account / Login / Cloud Sync | DESIGNED / POST-MVP |
| Advanced Historical Git | DESIGNED / POST-MVP |
| Windows | DESIGNED / POST-MVP |
| Python / PHP | DESIGNED / POST-MVP |
| Framework Adapter | DESIGNED / POST-MVP |
| Backup UI | DESIGNED / POST-MVP |

上記に対応するEntityやSequenceは削除しない。MVPの実装対象、依存関係、受入条件から除外する。

## 14. 継続する非目標

次はMVP後の拡張対象にも含めず、引き続き非目標とする。

- Source Code編集
- AIコード生成・自動修正
- AI Coding Agent
- Terminal / Debugger
- Source RepositoryへのGit write
- Repository全体のAI自動Wiki
- Runtime Trace
- CI/CD解析
- Cloud / Infrastructure Dependency解析
- 本格SAST
- Architecture採点
- チーム共同編集
- XP / Badge / Ranking
- Source CodeへのMemo書込み
- AIによる任意File探索
- AIによるShell実行

## 15. MVP E2E

MVPで成立させる主要E2Eを次の1本に固定する。

```text
Local TypeScript Repositoryを開く
↓
Structural Index生成
↓
Featureを作る / SYSTEM Candidateを採用
↓
Featureを選択
↓
Process Templateを選択・編集
↓
Data Flowを自分で記録
↓
Related Symbolを登録
↓
Code Viewerで実コードを見る
↓
Definition / Caller / Callee / Typeを辿る
↓
Semantic Linkを保存
↓
User Explanationを書く
↓
[コードと照合する]
↓
Verification結果を見る
↓
後日コードが変更される
↓
関連Explanation / DataFlowだけSTALEになる
↓
再確認してCURRENTへ戻す
```

このE2Eが快適で有用であることをMVP成功の中心条件とする。

## 16. MVP Completion Criteria

| ID | 受入条件 |
| --- | --- |
| MVP-01 | macOSでLocal TypeScript Repositoryを登録できる |
| MVP-02 | Repository Root外を解析しない |
| MVP-03 | `.gitignore`対象をIndex / AI Contextから除外できる |
| MVP-04 | 100k LOC以下の代表Repositoryで初期Indexが60秒以内に完了する |
| MVP-05 | Function / Class / Method / Type / ImportをIndexできる |
| MVP-06 | 静的に確定できる直接Call Relationを取得できる |
| MVP-07 | Featureを作成・選択できる |
| MVP-08 | Process TemplateからFlowを作成・編集できる |
| MVP-09 | Process間へData Flowを手動登録できる |
| MVP-10 | ProcessへSymbolを関連付けられる |
| MVP-11 | Code ViewerでDefinition / Caller / Callee / Typeを辿れる |
| MVP-12 | Semantic Linkを保存・再利用できる |
| MVP-13 | User Explanationを保存できる |
| MVP-14 | User Explanationの保存だけではAI Verificationが実行されない |
| MVP-15 | `コードと照合する`の明示操作でAI Verificationを実行できる |
| MVP-16 | AIがUser Explanation本文を変更できない |
| MVP-17 | AI停止中でもすべてのLocal機能を利用できる |
| MVP-18 | 関連Symbol変更時だけExplanation / Data FlowをSTALEにできる |
| MVP-19 | STALE内容を再確認してCURRENTへ戻せる |
| MVP-20 | アプリ再起動後もUser ContextをSQLiteから復元できる |

MVPはMVP-01からMVP-20を満たし、主要E2EをUser Testできる状態になった時点で完成と判定する。

## 17. PoC-0

MVP実装前にTypeScript Structural AnalyzerのPoC-0を実施する。PoC-0では完成UIを作らない。

```text
TypeScript Repository
↓
Structural Index
↓
Function一覧
↓
Call Relation
↓
簡易Feature
↓
Process
↓
Symbol / Codeへ移動
```

PoC-0の成功条件は、代表Repositoryに対して`Feature → Process → Symbol / Code`の最小Navigationが成立し、MVP-04からMVP-06の実現可能性を確認できることである。

## 18. 推奨実装順

```text
Phase 0: TypeScript Structural Analyzer PoC
↓
Phase 1: Local Project + SQLite
↓
Phase 2: Code Viewer + Symbol Navigation
↓
Phase 3: Feature Map
↓
Phase 4: Process / Data Flow
↓
Phase 5: Semantic Link / User Explanation
↓
Phase 6: AI Verification
↓
Phase 7: Git STALE
↓
MVP User Test
```

AIなしでも面・線・点がコード理解に役立つかを途中で検証できる順序とする。

## 19. MVP成功後の拡張順

```text
Post-MVP 1: Historical Git / Change Impact
↓
Post-MVP 2: Learning Session / Record
↓
Post-MVP 3: GitHub Learning Log
↓
Post-MVP 4: Engineering Evidence / Radar
↓
Post-MVP 5: Public Snapshot / Public Profile
↓
Post-MVP 6: Windows / Python / PHP / Framework Adapter
```

OSと言語対応は需要に応じて前倒しできる。ただしMVP Completion Criteria自体は変更しない。MVP範囲を変更する場合は、本Decisionとは別の明示的なDecision Recordを必要とする。
