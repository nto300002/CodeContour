# UI-005 Repository Setup 結果

Issue #21 の SCR-002 Repository Setup を実装した結果を記録する。

## Decision

- Renderer は用途限定の `window.codeContour.repositorySetup` だけを利用し、Node / Electron API、汎用IPC、filesystem能力を公開しない。
- Main Process の `validate` は既存の `loadTypeScriptProject` を唯一の安全検証正本として利用する。Root外Path、実体Symlink、tsconfig、extends連鎖、`node_modules`、`.gitignore`の判定を二重実装しない。
- `Start initial analysis` は検証成功結果がある場合だけ有効化する。Cancelは画面遷移だけを行い、入力値や仮Projectを永続化しない。

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 検証完了まで次へ進めない | PASS | 検証成功時だけ `Start initial analysis` を有効化する。 |
| Root外Symlink、Path Traversal、node_modules、.gitignore方針を表示 | PASS | Safety checksに明示し、実検証はRepository Readerのfail-closed policyを利用する。 |
| 失敗理由をField単位で表示 | PASS | Root / tsconfigごとのError Envelopeをそれぞれの入力直後に表示する。 |
| キャンセル時に未保存Formを永続化しない | PASS | Form stateはRenderer local stateのみ。CancelはProject Hubへ戻り、Project追加・保存を行わない。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Form validation Unit Test | PASS — 未検証時の無効化、成功時の有効化、Field Error、Cancelを確認。 |
| File picker boundary Integration Test | PASS — PreloadがRoot / tsconfig pickerとvalidateの3 APIだけを公開し、MainがRepository Readerを利用することを確認。 |
| 有効／無効登録 E2E Test | PASS — 有効設定はInitial Analysis、無効設定はSetupに留まることを確認。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-005実装 | 判断 |
| --- | --- | --- | --- |
| File picker | ローカルRootとtsconfigを選ぶ | Main Processのnative dialogを用途限定Preload API経由で呼び出す。手入力後にも同じ検証を行う | 安全境界を維持して一致。 |
| 推定規模 | 登録前に対象規模を把握する | 検証済みApplication File数を `Estimated files` として表示 | LOC推定は解析開始後の計測であり、このScreenでは対象外。 |
| 登録確定 | Setup中断では未登録 | Cancel時はFormを保存せず、Project Hubへ仮Cardを追加しない | UI-004のProject登録境界と一致。 |
| 視覚デザイン | UI Mockは参考資料 | テキスト、Field Error、ARIAを優先する最小UI | 配色・レイアウト調整は機能要件外。 |

## Result

GO
