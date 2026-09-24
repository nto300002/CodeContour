# POC-006 Relation Resolution State 結果

Issue #7（P0-16）のResolution State分類結果を記録する。

| 区分 | 結果 | 根拠 |
| --- | --- | --- |
| RESOLVED | PASS | Compiler APIがDefinition / Call signature / exportを確認できるImport、Static Reference、Callだけを確定Relationとして出力する。 |
| INFERRED | PASS | Interface Memberを経由するCallは実装先を確定せず、宣言Contractへの限定推定として`DECLARED_INTERFACE_MEMBER`と`inferenceEvidence`を保持する。 |
| UNKNOWN | PASS | computed property、dynamic import、未解決callback、未解決alias、既存Moduleのmissing exportを、evidenceLocationとreason付きで保持する。 |
| FP | PASS | Root外・Ignore・Symlink由来のImportはProject Relationへ昇格せず、`UNKNOWN / UNRESOLVED_ALIAS`に留める。 |
| Failure isolation | PASS | 個々のRelationがUNKNOWNでもProgram全体の解析を停止しない。 |
| Metrics | PASS | Fixture期待値とAnalyzer出力を`type / from / to / resolution / reason / syntaxCategory`で照合し、TP / FP / FN / UNKNOWNとstate／reason別件数を集計できる。 |

## Fixture Metrics

| Fixture | TP | FP | FN | UNKNOWN | 構文・原因 |
| --- | ---: | ---: | ---: | ---: | --- |
| direct / Interface Member / computed property Call | 2 | 0 | 0 | 1 | `DIRECT_CALL`、`INTERFACE_MEMBER_CALL`、`COMPUTED_PROPERTY_CALL`。理由は`DECLARED_INTERFACE_MEMBER`、`DYNAMIC_PROPERTY_ACCESS`。 |

## Failure Reason

| reason | 意味 |
| --- | --- |
| `DYNAMIC_PROPERTY_ACCESS` | computed propertyなど実行時情報が必要 |
| `DECLARED_INTERFACE_MEMBER` | Interfaceの宣言Contractへの限定推定。実装先は確定しない |
| `MISSING_EXPORT` | Moduleは存在するが対象exportがない |
| `MISSING_INFERENCE_EVIDENCE` | 許可reasonでも、判断根拠が空または空白のみ |
| `UNRESOLVED_ALIAS` | Import alias / moduleの解決に失敗 |
| `UNRESOLVED_CALL_SIGNATURE` | Call signatureを確定できない |
| `UNSUPPORTED_SYNTAX` | PoC-0の対象外構文 |

## Issue Review

### 1. Acceptance

- [x] RESOLVED / INFERRED / UNKNOWNをIRで表現する
- [x] UNKNOWNにevidenceLocationとreasonを保持する
- [x] 許可済みInterface Member Callだけを根拠付きINFERREDとして保持する
- [x] UNKNOWNをRESOLVEDへ誤昇格させない
- [x] Fixture期待値とAnalyzer出力からTP / FP / FN / UNKNOWN、構文・reason別Metricsを取得する

### 2. Correctness

- Defaultは`UNKNOWN`であり、Compiler APIによる確定根拠がなければ`RESOLVED`にしない。
- `INFERRED`は許可済みreasonと空白でない根拠文字列の両方がある場合だけ生成できる。

### 3. Architecture

- 共通分類器をImport RelationとCall Relationで使用する。
- Compiler Hostの既存Security Boundaryは維持する。

### 4. Scope

- Probability scoreとAI補完はPoC-0の対象外とする。

### 5. Result

GO — `npm test`（56件）、`npm run typecheck`、`git diff --check`がGreen。レビュー完了。
