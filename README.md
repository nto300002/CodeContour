# CodeContour

> AIコーディング時代に、人間が「理解の所有権」を取り戻すためのローカルデスクトップアプリ。

CodeContour（コード・コンター）は、AIによって生成・変更されたコードを、開発者自身が理解し、説明し、変更後もMental Modelを維持するためのプログラム理解支援ツールです。

コードを単独のFileやSymbolとして読むだけでなく、次の3階層を往復して理解します。

```text
面: Feature Map
↕
線: Process / Data Flow
↕
点: Symbol / Source Code
```

Gitは、この3階層に重ねる「時間軸」として扱います。

## Status

```text
Current phase: Specification fixed / PoC-0 and Architecture Spike ready
Runnable application: Not implemented yet
Target MVP OS: macOS
Target MVP language: TypeScript / TSX
```

MVPのプロダクト境界、実装境界、PoC-0、技術要件、開発要件は固定済みです。現在は、TypeScript解析の成立性を検証するPoC-0と、Analyzer ExecutorおよびSQLite Driverを選定するArchitecture Spikeへ進む段階です。

- [Open Issues](https://github.com/nto300002/CodeContour/issues)
- [PoC-0 Issues #2–#13](https://github.com/nto300002/CodeContour/issues?q=is%3Aissue%20state%3Aopen%20POC-)
- [Architecture Spike Issues #14–#15](https://github.com/nto300002/CodeContour/issues?q=is%3Aissue%20state%3Aopen%20SPIKE-)
- [Documentation index](docs/README.md)

## Why CodeContour

AIコーディングでは実装速度が上がる一方、次の負荷が人間側に残ります。

- 複数Fileへ分散した処理を追う
- 次に見るべきSymbolを探し続ける
- Data FlowやDependencyを頭の中で保持する
- コードを責務やFeatureの意味へ翻訳する
- 一度理解した箇所を再び調べ直す
- コード変更後に、自分の理解が古くなっていないか確認する

CodeContourは探索とNavigationの負荷を減らしますが、意味付けや説明をAIへ丸投げしません。

> コードをAIに説明してもらうのではなく、自分で説明できる状態を作る。

## MVPで検証すること

MVPで検証する問いは1つです。

> 複数ファイルに分散したコードについて、Feature → Process → Symbolを往復し、Data Flowと自分の説明を記録することで、従来よりMental Modelを作りやすくなるか。

### MVPの中心フロー

```text
Local TypeScript Repositoryを開く
↓
Structural Indexを生成する
↓
Featureを作成・選択する
↓
ProcessとData Flowを記録する
↓
ProcessへSource Symbolを関連付ける
↓
Definition / Caller / Callee / Typeを辿る
↓
Semantic LinkとUser Explanationを保存する
↓
明示操作でコードとの整合性を確認する
↓
コード変更後、関連する理解だけSTALEとして再確認する
```

### MVP Scope

| 領域 | MVP |
| --- | --- |
| Application | Electronによる独立Desktop App |
| OS | macOS |
| Language | TypeScript / TSX |
| Repository | Local Git Repositoryを1件ずつ扱う |
| Analyzer | TypeScript Compiler API |
| 面 | Feature Map |
| 線 | Feature → Process → Symbol、手動Data Flow |
| 点 | Read-only Code Viewer |
| Navigation | Definition / Caller / Callee / Type |
| User Context | Feature、Process、Data Flow、Semantic Link、Explanation |
| Git | Working Tree / HEAD差分による局所的なSTALE判定 |
| AI | User Explanationの明示的なVerificationのみ |
| Storage | Local SQLite |

## Product Principles

### 人間・SYSTEM・AIの責務を分離する

```text
SYSTEM
→ File、Symbol、Import、Call、Typeなどの構造的事実

AI
→ Proposal、Question、Verification

USER
→ 意味付け、説明、Feature / Process / Data Flowの確定
```

AIはUser Contextや説明本文を直接変更しません。AI結果は候補またはVerification結果として扱い、反映前にSYSTEMがRevision、Snapshot、AnchorなどのGuardを確認します。

### User Contextを正本として守る

- Feature、Process、Data Flow、Memo、User Explanationはユーザーの理解として永続化する
- SourceAnchorはSnapshotを跨ぐ安定Identityとして保持する
- 再生成可能な解析Cacheが壊れてもUser Contextを失わない
- 再解析に失敗しても現在のActive Snapshotを維持する

### Local ReadとAI Transmissionを分離する

Repositoryを開く許可は、Source CodeをAIへ送信する許可ではありません。AIへ送る場合も、Verificationに必要なSymbol周辺だけをContextとして構築します。

## Technical Architecture

```text
Renderer: React + TypeScript
  ↓ 用途別Typed API
Preload
  ↓ validated IPC
Electron Main
  ├ Command / Guard / Human Write Gateway
  ├ DB Service Interface
  ├ CredentialStore Interface
  ├ AI Provider Interface
  └ Analyzer Executor Interface
```

主要な技術選択：

- Electron + React + TypeScript + Vite
- Electron Forge
- TypeScript Compiler API
- CodeContour独自Analyzer IR
- SQLite + Drizzle
- ZodによるIPC入出力検証
- ZustandはSelectionなどのUI状態に限定
- macOS Keychain AdapterによるCredential管理

次の物理実装はArchitecture Spikeで確定します。

| Decision | Candidates | Tracking |
| --- | --- | --- |
| Analyzer Executor | `utilityProcess` / Worker Thread | [#14](https://github.com/nto300002/CodeContour/issues/14) |
| SQLite Driver | `better-sqlite3` / `node:sqlite` | [#15](https://github.com/nto300002/CodeContour/issues/15) |
| macOS Architecture | arm64 onlyを推奨。Intel Testerを含む場合はx64も対象 | Decision required |

## Security Boundary

MVPでは以下を必須とします。

- Repositoryはread-onlyで扱う
- Canonical Pathを検証し、Root外アクセスを拒否する
- `.gitignore`とSecurity Ignore Rulesを適用する
- Repository内容をUntrusted Inputとして扱う
- RendererへFilesystem、SQLite、raw `ipcRenderer`を公開しない
- `sandbox = true`
- `contextIsolation = true`
- `nodeIntegration = false`
- IPCの入力・出力とsenderを検証する
- Credential本文をSQLiteへ保存しない
- Source全文、Prompt全文、AI Context Payload全文をログへ保存しない

## PoC-0

PoC-0では、次のVertical Sliceが技術的・操作的に成立するかを検証します。

```text
Repository Reader
↓
TypeScript Structural Analyzer
↓
Manual Feature / Process / Data Flow
↓
Evidence Symbol
↓
Feature → Process → Symbol → Source Navigation
```

PoC-0はNode Local Server + React UIで実施でき、ElectronとSQLiteは対象外です。これらは独立したArchitecture Spikeで検証します。

必須Gateは[P0-01〜P0-22](docs/poc-0-spec.md#11-必須gate)です。存在しないRelationを確定表示するFalse Positiveを特に重く評価します。

## Development Workflow

TDDを「すべてを細かいUnit Testから作ること」ではなく、振る舞いを先に固定し、後戻りコストの高い境界を自動テストで守る方法として採用します。

```text
Issue
↓
Acceptance Criteria
↓
最小Behavior Test
↓
RED
↓
Implementation
↓
GREEN
↓
Refactor
↓
Integration / E2E
↓
Review
```

Issueは「ファイルを作る」単位ではなく、ユーザーまたはDomain上の検証可能な1振る舞いで分割します。

### Test Layers

| Layer | 主対象 |
| --- | --- |
| Domain Test | Command / Guard / State Transition |
| Analyzer Fixture Test | TypeScript解析と期待値 |
| Persistence Integration Test | SQLite / Transaction / Snapshot |
| Architecture Test | Electron / IPC / Security Boundary |
| E2E Acceptance Test | 主要ユーザーフロー |

詳細は[Development Requirements](docs/development-requirements.md)を参照してください。

## Roadmap

```text
PoC-0
+
Architecture Spike
↓
ADR-001 Analyzer Executor Selection
ADR-002 SQLite Driver Selection
↓
MVP Vertical Slice
↓
MVP User Test
```

MVP成功後に、Historical Git、Learning Record、Engineering Evidence、Public Snapshot、対応言語・OS拡張を再評価します。

## Documentation

| Document | Purpose |
| --- | --- |
| [Documentation index](docs/README.md) | 文書一覧、読む順序、優先順位 |
| [Product Principles](docs/product-principles.md) | 最上位の設計思想と判断基準 |
| [Product Requirements](docs/product-requirements.md) | 面・線・点、Process、Data Flow、Semantic Link |
| [MVP Scope](docs/mvp-scope.md) | 固定MVP、受入条件、実装順 |
| [MVP Implementation Boundaries](docs/mvp-implementation-boundaries.md) | 状態、権限、Snapshot、SQLite保存境界 |
| [Technical Requirements](docs/technical-requirements.md) | Electron、IPC、DB、Analyzer、Security |
| [PoC-0 Specification](docs/poc-0-spec.md) | PoC-0のIN / OUT、Gate、Fixture、Go / No-Go |
| [Architecture Spike Plan](docs/architecture-spike-plan.md) | ExecutorとSQLite Driverの選定Gate |
| [Development Requirements](docs/development-requirements.md) | TDD、Issue、Test、CI、Definition of Done |

仕様が矛盾する場合の優先順位は[Documentation index](docs/README.md#文書の優先順位)に従います。

## Non-goals

CodeContourはIDEやAI Coding Agentを目指しません。少なくともMVPでは、次を対象外とします。

- Source Code編集
- AIによるコード生成・自動修正
- Terminal / Debugger
- Source RepositoryへのGit write
- Repository全体のAI自動Wiki
- Runtime Trace
- CI/CD、Cloud Infrastructure、本格SASTの解析
- チーム共同編集
- Account / Cloud Sync
- WindowsおよびTypeScript以外の言語

---

> 機械には構造的事実を扱わせ、AIには候補・問い・推論を扱わせ、人間には意味付けと理解を残す。
