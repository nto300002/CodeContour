# PoC-0 正式仕様

[ドキュメント一覧](README.md) | [固定MVP](mvp-scope.md) | [設計思想](product-principles.md)

```text
Status: FIXED
Decision: POC-0-2026-09-16
```

> 本文書はPoC-0の正規仕様である。ほかの文書とPoC-0の範囲・成功条件が矛盾する場合は、本文書を優先する。

## 1. 正式目的

> **TypeScriptの静的解析結果を、手動で作成したFeature・Process・Data Flowへ接続し、Feature → Process → Symbol → Source Codeを自然に往復できるかを検証する。**

PoC-0は製品を完成させる工程ではない。次の組み合わせが技術的・操作的に成立するかを確認する工程である。

```text
TypeScript解析技術
+ CodeContour固有の最小Vertical Slice
```

PoC-0では次の5問へ回答する。

1. TypeScript Repositoryから必要なSymbol、Call、Typeを十分正確に取得できるか。
2. 取得した情報から、次に見るべきSymbolをDefinition / Caller / Calleeとして辿れるか。
3. Feature → Process → Symbolを実際のSource Codeへ接続できるか。
4. Process間のData FlowへコードEvidenceを関連付けられるか。
5. 実用規模に近いRepositoryでも現実的な性能傾向を示すか。

## 2. 構成

PoC-0は次の4ブロックで構成する。

```text
A. Repository Reader
↓
B. TypeScript Structural Analyzer
↓
C. Minimal Understanding Model
↓
D. Minimal Viewer / Navigation
```

技術構成は次を基本とする。

```text
Node.js
+ TypeScript
+ TypeScript Compiler API
+ React
```

Desktop packagingは検証対象ではないため、Node Local Server + localhost React UIでよい。ElectronはPoC-0成功後に導入する。

PoC-0の保存は`analysis-result.json`と`user-model.json`程度の簡易形式でよい。SQLiteはMVP本実装で導入する。

## 3. Repository Reader

### 3.1 入力単位

PoC-0では、すでにLocalに存在する1 Repository内の1つの`tsconfig.json`を解析単位とする。

```text
Repository Root
+ Target tsconfig.json
```

複数の`tsconfig.json`が存在しても自動統合しない。ユーザーまたはTest Harnessが対象を1つ指定する。

### 3.2 読取対象

- Repository Root内のFile
- 指定したtsconfig Projectに含まれる`.ts` / `.tsx`
- TypeScript Compilerが型・Module解決に必要とする外部宣言

### 3.3 最低限のSecurity Boundary

- Canonical Pathを検証する
- Root外へのPath Traversalを禁止する
- Symlinkはreal pathでRoot内か確認する
- `.gitignore`を適用する
- `.git`をApplication Indexから除外する
- `node_modules`をApplication Indexから除外する
- Security Ignore Rulesを最低限適用する

### 3.4 対象外

- GitHub clone / GitHub API
- Remote Repository
- Archive Upload
- 複数Repository Workspace
- 複数tsconfigの統合解析
- Project References
- npm / yarn / pnpm Workspace固有統合
- 高度なMonorepo解析
- 別tsconfig間のCall Graph

## 4. TypeScript Project解決

独自の文字列検索ではなく、TypeScript Compiler APIのProject設定解決を利用する。

少なくとも次を反映する。

```text
extends
compilerOptions
baseUrl
paths
moduleResolution
include
exclude
files
types
typeRoots
```

Import AliasやRe-exportは、指定したProject設定の範囲内で解決する。

## 5. node_modules / 外部Type境界

`node_modules`はCodeContourの理解対象としてIndexしない。一方、TypeScript Compilerが型・Moduleを解決するために必要な`.d.ts`等の読取りは許可する。

| 用途 | node_modules |
| --- | --- |
| TypeScript Compilerの型・Module解決 | 許可 |
| Application Symbol Index | 対象外 |
| Feature / Process候補 | 対象外 |
| File Tree / Code Viewer | 対象外 |
| 検索 | 対象外 |
| User Semantic Link | 対象外 |
| AI Context | 対象外 |

外部Library Symbolは、呼出先を解決できてもProject内Source Navigationの対象にしない。

```text
targetScope:
PROJECT / EXTERNAL
```

例：

```text
bcrypt.compare
targetScope = EXTERNAL
resolution = RESOLVED
```

## 6. Structural Analyzer

### 6.1 File

各Fileについて最低限、次を取得する。

```text
relativePath
language
contentHash
parseStatus
```

### 6.2 Symbol

対象Symbolは次に絞る。

- Function
- Class
- Method
- Interface
- Type Alias
- function-likeまたはexportedを中心とするVariable

最低限の中間表現は次のとおりとする。

```text
Symbol

id
kind
name
qualifiedName
relativePath
range
signature
```

### 6.3 Relation

最低限、次を取得する。

- Import / Export / Re-export
- Definition
- 静的Reference
- Explicit Call
- Caller / Callee
- Type / Signature

中間表現は次を基本とする。

```text
Relation

from
to
type
evidenceLocation
resolution
targetScope
```

Relation Typeは次に限定する。

```text
IMPORTS
REFERENCES
CALLS
TYPE_USES
```

Type / Signatureでは、少なくともparameter、returnType、variable type、interface / type referenceを確認する。Data Flowの自動推定は行わない。

### 6.4 Resolution State

`RESOLVED / INFERRED / UNKNOWN`を正式な状態として区別する。

#### RESOLVED

TypeScript Compiler APIによって対象Symbolを一意に特定できた状態。

#### INFERRED

静的根拠は存在するが一意に確定できない状態。通常の確定Call Graphへ混ぜず、推定Relationとして分離表示する。

#### UNKNOWN

安全にRelationを生成できない状態。Computed Propertyなど実行時情報が必要な場合に使用する。

名前が一致するSymbolを検索しただけで`RESOLVED`にしてはならない。誤ったRelationを作るより`UNKNOWN`を優先する。

### 6.5 Analyzer対象外

- 高度なDI解決
- React Component Tree
- Next.js Route特別解析
- Decorator意味解析
- Runtime Binding
- Dynamic Importの完全追跡
- `eval` / Reflection
- Webpack / Vite Build解析
- DB Schema / ORM Relation
- API Schema
- Test Coverage

これらはFramework Adapter以降の検証対象とする。

## 7. Minimal Understanding Model

Analyzerだけで終了せず、CodeContour固有の面・線・点へ接続する。

### 7.1 Feature

USERが手動作成する。PoC-0では`id`と`name`程度でよい。Feature Candidate自動生成は行わない。

### 7.2 Process

Feature内へUSERが手動作成する。Process Templateは`Authentication`と`Custom`など2種類程度でよく、7種類すべてのUIは不要とする。

### 7.3 Process → Symbol

ProcessとSymbolはN:Mで手動関連付けできるようにする。

```text
Process
N:M
Symbol
```

### 7.4 Data Flow

Data Flowは中心価値の検証に必要なためPoC-0へ含める。最低限のFieldは次のとおりとする。

```text
fromProcess
toProcess
dataName
evidenceSymbol
```

Transformation、Verification、Freshnessなどの本番仕様はPoC-0では実装しなくてよい。

## 8. Minimal Viewer

CLIだけでは操作の自然さを検証できないため、最低限のReact UIを作成する。

### 8.1 Feature View

Feature一覧と選択を提供する。Graph Mapは不要で、List表示でよい。

### 8.2 Process View

選択したFeatureのProcess Flow、Data Name、Evidence Symbol、Related Symbolsを表示する。

### 8.3 Code View

選択したSymbolについて次を表示する。

```text
Definition
Caller
Callee
Type / Signature
Read-only Source Code
```

UIから次の往復ができることを必須とする。

```text
Feature
↓
Process
↓
Symbol
↓
Source Code
```

## 9. Semantic Link

User Semantic LinkはPoC-0の必須Gateへ含めず、Stretch Goalとする。

```text
P0-S01:
Symbol間Semantic Linkを保存し、
保存したLinkから再Navigationできる
```

未達でもPoC-0は成功可能とする。

## 10. Fixture

Fixtureは解析しやすいコードだけでなく、解析限界を意図的に含むAuthentication Repositoryとする。

| Case | 期待 |
| --- | --- |
| 通常Function Call | RESOLVED |
| Class Method Call | RESOLVED |
| Arrow Function | 取得可否と挙動を記録 |
| Import Alias | RESOLVED |
| Re-export | RESOLVEDを目標 |
| Interface | Symbol / Type取得 |
| Type Alias | Symbol / Type取得 |
| Generic Type | Type解決確認 |
| async / Promise | Signature取得 |
| Optional Chaining | Call解析確認 |
| Overload | Occurrence / Definition挙動確認 |
| 外部Library Call | EXTERNALとして扱う |
| Computed Property Call | 原則UNKNOWN |
| Dynamic Import | 対象外またはUNKNOWN |

Fixtureとは別に正解データを保持する。

```text
expected-symbols.json
expected-relations.json
```

正解データには期待するfrom / to、Relation Type、Resolution State、targetScopeを記録する。

## 11. 必須Gate

| ID | 必須Gate |
| --- | --- |
| P0-01 | Local Repository Rootを指定できる |
| P0-02 | 対象`tsconfig.json`を1つ指定できる |
| P0-03 | Repository Root外をApplication Indexへ入れない |
| P0-04 | `.gitignore`を適用できる |
| P0-05 | tsconfigのextends / baseUrl / paths / moduleResolutionを反映できる |
| P0-06 | `.ts` / `.tsx`対象Fileを取得できる |
| P0-07 | Functionを取得できる |
| P0-08 | Class / Methodを取得できる |
| P0-09 | Interface / Type Aliasを取得できる |
| P0-10 | Import / Export / Re-exportを解析できる |
| P0-11 | Definitionへ到達できる |
| P0-12 | 静的Referenceを取得できる |
| P0-13 | Explicit Callを取得できる |
| P0-14 | Caller / Calleeを取得できる |
| P0-15 | Type / Signatureを取得できる |
| P0-16 | RESOLVED / INFERRED / UNKNOWNを区別できる |
| P0-17 | Featureを手動作成できる |
| P0-18 | Processを手動作成できる |
| P0-19 | ProcessへSymbolを関連付けられる |
| P0-20 | Data FlowへEvidence Symbolを関連付けられる |
| P0-21 | Feature → Process → Symbol → SourceをUIで往復できる |
| P0-22 | 固定CommitのSmall / Medium実Repositoryで、代表Scopeの監査を通し致命的な解析停止を起こさない |

PoC-0の必須実装GateはP0-01からP0-22とする。P0-S01は合否へ含めない。

## 12. 致命的な解析失敗

個別Symbolを解決できず`UNKNOWN`になることは失敗ではない。次の状態を致命的な解析失敗とする。

- 通常のRepositoryをTypeScript Programとして構築できない
- 一部の`UNKNOWN`や解析Errorにより全Index生成が停止する
- 解析Error 1件でMinimal Viewer全体が利用不能になる
- 外部Library型が解決できないだけでApplication Symbolを取得できなくなる

部分失敗を許容し、利用可能なFactと`UNKNOWN`を返せることを確認する。

## 13. Repository規模と性能試験

### 13.1 Small Repository

```text
1k〜5k LOC
```

必須。基本動作、Fixtureとの一致、Precision / Recallを重点確認する。

### 13.2 Medium Repository

```text
10k〜30k LOC
```

必須。実用規模に近い性能傾向、部分失敗、操作の自然さを確認する。

### 13.3 Optional Stress Test

```text
約100k LOC
```

適切なRepositoryを用意できる場合のみ実施する。Index時間、Memory、File数、Symbol数、Relation数、UNKNOWN数を記録するが、60秒以内をPoC-0の合格条件にしない。

`100k LOC以下 / 初回Index 60秒以内`はMVP本実装の性能受入条件として維持する。

## 14. 計測

### 14.1 精度

少なくとも次を記録する。

```text
Expected
True Positive
False Positive
False Negative
Precision
Recall
UNKNOWN
```

False PositiveとFalse Negativeは構文・原因別に分類する。PoC-0ではTier A 98%等をGateにしないが、存在しないRelationを確定表示するFalse Positiveを特に重く扱う。

PoC-0の実Repository精度は、Repository内の**全Relation精度**を主張しない。固定Commitごとに事前定義する代表Scopeの監査結果を正式なGateとする。監査契約は次の形式で保存する。

```json
{
  "repository": "owner/name",
  "commit": "fixed commit SHA",
  "auditScopes": [
    { "type": "CALLS", "from": "stable caller identity" }
  ],
  "expectedRelations": []
}
```

`auditScopes`は非空で、`type / from`を持つ。`expectedRelations`が空であってもScopeは監査され、Scope内のactual RelationはFPとして検出する。各expected RelationはScopeに属し、`type / from / resolution / syntaxCategory`を持つ。測定RunnerはRepository・Commitの一致、contract hash、FP 0、FN 0、期待UNKNOWNのreason一致をfail-closedで検証する。

代表Scopeはランダム抽出しない。Small / Mediumを合わせたPoC-0の監査ポートフォリオとして、次の軸をFixtureと固定Commitの実Repository Scopeで必須化する。

| 軸 | 必須ケース |
| --- | --- |
| Relation種別 | Import、Value Reference、Type Reference、Call |
| Resolution | RESOLVED、INFERRED、UNKNOWN |
| Import形態 | relative、paths alias、external、missing export |
| Call形態 | direct、instance/static、interface contract、dynamic/unresolved |
| Security Boundary | Ignore、Root外、symlink、external `.d.ts` |
| Repository規模 | Small、Medium |

Security Boundaryと、対象Repositoryに存在しない構文のケースは専用Fixtureで確認する。実Repositoryのmanifestは、そのRepositoryで実在する代表Scopeだけを監査し、未監査範囲をReportへ残す。

### 14.2 性能

少なくとも次を記録する。

```text
LOC
File count
Index time
Peak memory
Symbol count
Relation count
UNKNOWN count / ratio
```

### 14.3 操作・設計判断

次はPass / Failと分離して記録する。

- TypeScript Compiler APIの使いやすさ
- 中間表現をMVPへ再利用できるか
- Caller / Callee Navigationの自然さ
- Feature → Process → Symbolの自然さ
- Data Flow Evidence登録の操作感
- Analyzer InterfaceをMVPへ昇格できるか

## 15. Go / No-Go

### 15.1 Go

- TypeScript Compiler APIで必要なStructural Factを取得できる
- False Relationを抑制できる
- 解決不能な関係を安全に`UNKNOWN`へ移せる
- Feature → Process → Symbol → Sourceが実Repositoryでも自然に使える
- Data Flow Evidenceをコードへ接続できる
- Medium Repositoryで現実的な性能傾向を示す
- 固定CommitのSmall / Medium実Repositoryが`COMPLETE`または理由付き`PARTIAL`で終了し、事前定義した代表ScopeでFP / FNが0である
- UNKNOWNは期待するreasonを保持し、Root外・Ignore・外部SymbolをProject Relationへ誤昇格しない

### 15.2 Conditional Go

中核は成立するが、Re-export、Optional Chaining、一部構文、100k LOC性能などに制限がある状態。制限事項をMVPへ明記し、解決時期を定めたうえで進行できる。

### 15.3 No-Go / Analyzer再設計

- 通常CallでもFalse Positiveが多い
- `paths`利用時にDefinitionが大量に切れる
- 実RepositoryのCaller / Calleeが大半`UNKNOWN`になる
- Medium Repositoryで現実的でない時間またはMemoryを要する
- 中間表現が面・線・点へ自然に接続できない

No-Goの場合はTypeScript Compiler API単独方式、中間表現、Project読込方式を再検討する。

## 16. 正式IN

```text
Local Repository Reader
1 tsconfig Project
tsconfig resolution
.gitignore / 最低限Security Boundary
TypeScript Compiler API

File / Symbol
Definition / Reference
Import / Export / Re-export
Explicit Call / Caller / Callee
Type / Signature

RESOLVED / INFERRED / UNKNOWN
PROJECT / EXTERNAL境界

Manual Feature
Manual Process
Process → Symbol
Manual Data Flow
Data Flow → Evidence Symbol

Minimal Feature View
Minimal Process View
Read-only Code Viewer

Fixture / 正解データ
Small / Medium Repository Test
精度計測 / 性能計測
```

## 17. 正式OUT

```text
Semantic Link（Stretch Goal）
AI / User Explanation / AI Verification
Git STALE / Historical Git
Feature Candidate自動生成
Framework Adapter
Electron / SQLite
Windows / Python / PHP
Learning / Radar
GitHub / Public / Authentication
Cloud / Backup
Graph DB / Vector DB / Embedding
```

## 18. PoC-1 / PoC-2との境界

```text
PoC-0
Structural Analyzer
+ Feature / Process / Symbol
+ Data Flow Evidence
+ Minimal UI

PoC-1
User Explanation
+ Explicit AI Verification
+ AI Context Boundary

PoC-2
Working Tree / HEAD Change
+ Change Packet
+ Evidence Dependency
+ Partial STALE
+ Reverification
```

PoC-0は、PoC-1またはPoC-2が不成立でも独立して評価・再利用できる構造とする。

## 19. 完了時に残す成果物

- PoC実装
- Fixture Repository
- `expected-symbols.json`
- `expected-relations.json`
- Small / Medium Repositoryの計測結果
- Optional Stress Test結果（実施した場合）
- P0-01〜P0-22の結果
- P0-S01の結果（実施した場合）
- 既知の制限事項
- Go / Conditional Go / No-Go Decision

## 20. 固定後の一文

> **単一のTypeScript ProjectをCompiler APIで安全に解析し、確定可能な構造事実とUNKNOWNを区別しながら、ユーザーがFeature・Process・Data FlowへSymbol Evidenceを関連付け、Feature → Process → Symbol → Sourceを実Repository上で往復できることを確認する。**
