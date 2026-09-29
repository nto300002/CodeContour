# POC-003 Import / Re-export Closeout 結果

Issue #4（P0-10 / P0-11）とIssue #16のCloseout結果を記録する。

## Decision

**Aを採用する。** PoC-0では、`IMPORTS` Relationがrelative import、paths alias、barrel export、chained re-exportを経由してProject内の最終Definitionへ到達できることをもって、Import / Export / Re-export解析（P0-10）を満たす。`EXPORTS` Relationを独立したAnalyzer IRとして生成することはPOST-PoC-0とする。

この範囲ではExportはImport先の解決経路として扱う。Export関係そのものを探索・表示・保存する要件が生じた場合に限り、独立IRの必要Field、Resolution State、Fixtureを設計する。

## Gate結果

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| P0-10 Import / Export / Re-export | PASS | relative、paths alias、default / named import、barrel export、chained re-exportを最終Project Definitionへ解決する。 |
| P0-11 Definition Location | PASS | `relativePath = src/domain.ts` と、Definition rangeから切り出すSource本文が`source = 1`であることをFixtureで照合する。 |

## Required Evidence

| ケース | 結果 |
| --- | --- |
| relative import | `PROJECT / RESOLVED` |
| paths alias | `PROJECT / RESOLVED` |
| default / named import | `PROJECT / RESOLVED` |
| barrel / chained re-export | `PROJECT / RESOLVED`。最終Definitionへ到達する。 |
| external import | `EXTERNAL`として区別し、Project Definitionを付与しない。 |
| unresolved module | `UNKNOWN / UNRESOLVED_ALIAS`。`RESOLVED`へ昇格させない。 |
| existing moduleのmissing export | `PROJECT / UNKNOWN / MISSING_EXPORT`。Definitionを付与しない。 |
| existing external packageのmissing export | `EXTERNAL / UNKNOWN / MISSING_EXPORT`。Project Definitionを付与しない。 |
| Root外・Ignore対象 | Repository Readerの許可集合外であり、Project Definitionとして表示しない。 |

## False Positive / UNKNOWN

False Positiveは検出していない。未解決moduleとmissing exportは、Definitionを推測せず`UNKNOWN`とreasonを保存する。外部Symbolは`EXTERNAL`として表示し、Project内Source Navigationの対象にしない。

## Issue Review

### 1. Acceptance

- [x] Issue #4のRequired Fixture TestがGreen
- [x] P0-10・P0-11の結果を保存した
- [x] Export / Re-export方針をAとして確定した

### 2. Correctness

- 誤った確定情報を生成していないか：未解決・missing export・外部SymbolへProject Definitionを付与しない。
- UNKNOWNとして残したケース：unresolved module、Project / external moduleのmissing export。
- 既知の制限：`EXPORTS` Relationの独立IR化、循環exportの専用Fixture、Bundler固有aliasはPOST-PoC-0。

### 3. Architecture

- Repository Readerの許可済みApplication FileだけをProject Definition候補にする。

### 4. Scope

- `EXPORTS` Relationの独立IRは実装しない。P0-12以降のReference / Call解析は変更しない。

### 5. Findings

- TypeScript Checkerはbarrel / chained re-exportの最終Symbolへ到達できるため、PoC-0のNavigation目的に独立`EXPORTS` IRは不要である。
- Export関係自体の可視化・検索・保存が要件化した時点で、独立IRを再評価する。

### 6. Result

GO
