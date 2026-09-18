# POC-005 Explicit Call / Caller / Callee 結果

Issue #6（P0-13 / P0-14）のCall Analyzer結果を記録する。

| 区分 | 結果 | 根拠 |
| --- | --- | --- |
| TP | PASS | 直接Function、import、instance / static Method、async Function、nested / multiple caller、再帰Callを`CALLS`として取得する。Project内CalleeはqualifiedName、relativePath、Definition rangeでNavigationできる。 |
| FP | PASS | computed property Call、call signatureを持たないCallback、`.gitignore`対象、Root外、Root外Symlink由来の実装Fileを確定Callにしない。 |
| FN | UNKNOWN | runtime dispatch、reflection、dynamic import、computed propertyはPoC-0でCalleeを確定しない。 |
| UNKNOWN | PASS | Compiler APIがCall signatureを確定できないCallはRelationを生成せず、誤った`RESOLVED`へ昇格しない。 |
| External | PASS | 許可済みnode_modules `.d.ts`の実Call signatureだけを`EXTERNAL / RESOLVED`とし、Project内Calleeは付与しない。 |
| Security | PASS | Compiler HostはRepository Readerが許可したApplication / Declaration File、Repository内node_modules `.d.ts`、TypeScript標準ライブラリだけを読取可能にする。 |

## Overloadの記録

Overload Callは1件の`CALLS`として取得する。CalleeはTypeScript Checkerが返す宣言側SymbolへNavigationする。実装本体への独自推論はせず、誤ったImplementationを確定しない。

## Issue Review

### 1. Acceptance

- [x] Function / Method Callから`CALLS`、Caller、Callee、evidenceLocationを取得する
- [x] Project内CalleeのDefinition rangeへNavigationできる
- [x] 外部Library Callを`EXTERNAL`として扱う
- [x] direct / instance / static / imported / async / optional / nested / dynamic / callbackのFixture TestがGreen
- [x] 再帰・overload・未解決Calleeが解析全体を停止させない

### 2. Correctness

- Callerは最も近いFunction / Method Symbolを保持し、トップレベルCallは`<file>` File Scopeを保持する。
- CalleeはCheckerがCall signatureとDefinitionを確認できるProject内Symbolだけを保持する。
- computed property、未解決Import、callableでないCallbackは`RESOLVED` Relationを生成しない。

### 3. Architecture

- Compiler HostはRepository Readerの許可済みFileをBoundaryとして強制する。
- 外部Packageは許可済み`.d.ts`だけを型解決に使用し、実装`.js` / `.ts`は読まない。

### 4. Scope

- Runtime dispatch、reflection、dynamic importの完全追跡はPoC-0対象外とする。

### 5. Result

GO — `npm test`（46件）、`npm run typecheck`、`git diff --check`がGreen。レビュー完了。
