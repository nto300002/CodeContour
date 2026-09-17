# POC-001 Repository Reader 結果

Issue #2（P0-01〜P0-06）の実装・テスト結果を記録する。

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| P0-01 | PASS | Local Repository Rootをcanonical pathとして解決する。 |
| P0-02 | PASS | Root内の対象`tsconfig.json`を1件指定できる。 |
| P0-03 | PASS | Path Traversal、Root外`extends`、Root外SymlinkをApplication Indexへ入れず、除外理由を観測できる。 |
| P0-04 | PASS | `.gitignore`のglob規則、`.git`、`node_modules`をApplication Indexから除外する。 |
| P0-05 | PASS | TypeScript Compiler APIで`extends`、`compilerOptions`、`baseUrl`、`paths`、`moduleResolution`、`include`、`exclude`、`files`を解決する。 |
| P0-06 | PASS | `.ts` / `.tsx`の対象Fileを取得する。 |

保存済みFixtureと期待値は`test/fixtures/`に置く。テストは`npm test`、型検査は`npm run typecheck`で実行する。

## Issue Review

### 1. Acceptance

- [x] Acceptance Criteriaをすべて満たした
- [x] 必須TestがGreen（11件）
- [x] 既存Testを壊していない

### 2. Correctness

- 誤った確定情報を生成していないか：Root外PathとSecurity Ignore対象を索引へ入れない。
- UNKNOWNとして残したケース：本Issueは解析Relationを生成しないため、該当なし。
- 既知の制限：PoC-0ではRepository外の`tsconfig` package extendsをfail-closedで拒否する。

### 3. Architecture

- Write権限・Security Boundary違反：なし。Repositoryは読取りのみで、Root外Pathは拒否または明示的に除外する。
- 既存設計から変更した点：なし。

### 4. Scope

- Issue外に追加実装したもの：なし。
- POST-MVPへ送ったもの：複数tsconfig統合、Project References、外部設定packageの許可ポリシー。

### 5. Findings

- `tsconfig`の`extends`もRepository境界を越える読取り経路になるため、対象Fileと同じくcanonical pathで検証する必要がある。
- 除外だけでなく、`skippedFiles`で理由を返すことでSecurity上の読み飛ばしを観測可能にする。

### 6. Result

GO
