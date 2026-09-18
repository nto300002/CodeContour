# POC-004 Static Reference 結果

Issue #5（P0-12）のStatic Reference Analyzer結果を記録する。

| 区分 | 結果 | 根拠 |
| --- | --- | --- |
| TP | PASS | Function、Class、Method、Variable、Interface、Type Alias、renamed importをProject内Definitionへ解決する。`service.run()`は`<file>` File Scopeから`Service.run`のDefinition rangeへ到達する。 |
| FP | PASS | Declaration、コメント、文字列、computed property、外部SymbolをProject内確定Referenceにしない。 |
| FN | UNKNOWN | Runtime dispatch、reflection、dynamic import、computed propertyの対象はPoC-0で確定しない。 |
| UNKNOWN | PASS | 未解決・動的対象をReference IRへ確定出力しない。 |
| Security | PASS | `.gitignore`、Root外、Root外Symlink由来の実装FileをCompiler Hostが読取対象にせず、Project内Referenceを生成しない。 |

## Issue Review

### 1. Acceptance

- [x] P0-12のReference元・対象Symbol・evidenceLocationを返す
- [x] Required Fixture TestがGreen（同名Symbol、Interface Type Reference、Definition range照合を含む）
- [x] 外部・動的・未解決対象をProject内確定Referenceにしない

### 2. Correctness

- `from`は最も近いFunction / Method / Variable Symbolを保持し、トップレベルでは`<file>` File Scopeを保持する。
- `to`はCheckerで一意に解決できるProject内Definitionだけを保持する。
- 同名SymbolはqualifiedName、relativePath、rangeで区別する。

### 3. Architecture

- Compiler HostはRepository Readerの許可済みApplication FileとDeclaration Fileだけを読取対象とする。

### 4. Scope

- Runtime dispatch、reflection、dynamic importはPoC-0対象外とする。

### 5. Result

GO
