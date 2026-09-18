# POC-009 Process Source Symbol Links 結果

Issue #10（P0-19）のProcess → Project Symbol関連付け結果を記録する。

| 区分 | 結果 | 根拠 |
| --- | --- | --- |
| Domain | PASS | Symbol IndexのProject内SymbolをProcessへ`processSymbolLinks`として保存する。 |
| Idempotency | PASS | 同じProcess／Symbolの再関連付けは既存Linkを返し、重複保存しない。 |
| Guard | PASS | 存在しないProcess、`EXTERNAL`／`UNKNOWN`、Symbol Index許可集合にない偽造`PROJECT` Symbolを保存しない。 |
| Persistence | PASS | JSON保存後、別StoreからLinkを再読込できる。 |
| Process View | PASS | Symbol名・kind・relativePathを選択Processの表示項目として返す。 |
| Navigation | PASS | 保存済みAnchorからDefinitionのrelativePathとrangeを返す。 |

## Issue Review

### 1. Acceptance

- [x] ProcessとProject内Symbolを関連付けて保存できる
- [x] Process ViewへSymbol名・kind・relativePathを表示できる
- [x] Definition Locationへ移動できる
- [x] EXTERNAL／UNKNOWNをProject Source Anchorとして保存しない

### 2. Correctness

- Linkは`processId + symbolId`で冪等に扱う。
- relativePathとrangeの安全条件に加え、Symbol Indexのid・Definition Locationと一致するProject SymbolだけをNavigation可能として保存する。

### 3. Scope

- SourceAnchor再解析マッチング、SQLite Canonical Model、AI推薦は対象外とする。

### 4. Result

GO — `npm test`（70件）、`npm run typecheck`、`git diff --check`がGreen。レビュー完了。
