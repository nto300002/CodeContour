# POC-010 Data Flow Evidence 結果

Issue #11（P0-20）のData FlowとEvidence Symbol関連付け結果を記録する。

| 区分 | 結果 | 根拠 |
| --- | --- | --- |
| TP | PASS | 同一Feature内のProcess A → Bへlabel付きData Flowを保存する。 |
| Guard | PASS | 自己循環、未存在Process、空label、EXTERNAL／UNKNOWN Evidenceを拒否する。 |
| Evidence | PASS | 実Symbol Index出力だけをEvidenceとして保存し、重複追加は冪等に扱う。 |
| Persistence | PASS | Data Flow／Evidenceを`user-model.json`へ保存し、別Storeから再読込できる。 |
| UI / Navigation | PASS | `EVIDENCED`状態をView Projectionへ返し、EvidenceからDefinition Locationへ移動できる。 |
| E2E | PASS | Repository Reader → Symbol Index → Data Flow Evidence → 保存／再読込をFixtureで確認する。 |

## Issue Review

### 1. Acceptance

- [x] from / to / labelを持つData Flowを保存・表示できる
- [x] Project内SymbolをEvidenceとして保存し、Definitionへ移動できる
- [x] Evidenceを追加したData Flowを`EVIDENCED`として表示できる

### 2. Correctness

- EvidenceはSymbol Indexの許可集合に一致するProject Symbolだけを保存する。
- `UNKNOWN`と`EXTERNAL`をProject Source Evidenceへ昇格しない。

### 3. Scope

- Data Flow自動推定、Runtime値追跡、Git STALE伝播は対象外とする。

### 4. Result

GO — `npm test`（74件）、`npm run typecheck`、`git diff --check`がGreen。レビュー完了。
