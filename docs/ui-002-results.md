# UI-002 Routing 結果

Issue #18のScreen / View / Recovery routingについて、固定仕様とUI Mockを照合した結果を記録する。

## Routing Decision

- SCR-001〜SCR-007はhash routeとして直接遷移できる。Workspace routeは`#/workspace`である。
- VIEW-101〜103はSCR-004内部のStateであり、独立routeを持たない。View切替はWorkspace Shellを再生成しない。
- Verification Resultは独立routeを持たず、後続のCode Viewer Inspector状態とする。
- Project未選択はProject Hubへ、Repository切断はRepository Reconnectへ安全にFallbackする。GuardはRoute Stateだけを返し、Project / User Contextを変更しない。
- Reconnect成功時は保持した`returnPath`へ戻る。returnPathがない場合はProject Hubへ戻る。

## Route Table

| Screen | Route |
| --- | --- |
| SCR-001 Project Hub | `#/projects` |
| SCR-002 Repository Setup | `#/repository/setup` |
| SCR-003 Initial Analysis | `#/analysis` |
| SCR-004 Understanding Workspace | `#/workspace` |
| SCR-005 Repository Reconnect | `#/repository/reconnect` |
| SCR-006 Global Settings | `#/settings` |
| SCR-007 Project Settings | `#/project/settings` |

## 受け入れ結果

| 要件 | 結果 | 証跡 |
| --- | --- | --- |
| 7 Screensへ直接遷移 | PASS | Route tableが7 Screenとhash routeを1対1で定義する。 |
| View切替でShellを再生成しない | PASS | happy-dom E2EでWorkspace Shell DOM nodeの同一性を検証する。 |
| Verification Resultを独立Routeにしない | PASS | Route tableにVerification Resultを含めない。 |
| Guard失敗でUser Contextを変更しない | PASS | Pure Guardがfallback / returnPathだけを返し、入力Context不変をUnit Testで確認する。 |

## Required Tests

| Test | 結果 |
| --- | --- |
| Route table Unit Test | PASS — 7 Screen、Workspace Viewの独立route不在、不正route fallbackを確認。 |
| Guard / Fallback Integration Test | PASS — Project未選択、Repository切断、returnPath復元、Context不変を確認。 |
| View切替 / returnPath E2E Test | PASS — Project選択→Workspace→Code Viewer→Reconnect→Code Viewer復帰をhappy-domで確認。 |

## UI Mockとの差異レビュー

| 項目 | UI Mock / 固定仕様 | UI-002実装 | 判断 |
| --- | --- | --- | --- |
| Screen遷移 | 7つの独立Screen | hash routeで7 Screenを分離 | 一致。Electronのfile loadと相性がよく、外部Router依存を増やさない。 |
| Workspace View | SCR-004内の抽象度切替 | 同一Shell内のState切替 | 一致。Viewの独立URLは持たない。 |
| Reconnect | Recovery後にreturnPathへ戻る | Route GuardがreturnPathを保持し、Reconnect後に復元 | 一致。実Repository再接続の検証はUI-012（#28）で接続する。 |
| 不正Route表示 | 固定UIなし | Project HubへFallback | 安全な最小Fallback。ユーザー向けError表示はUI-003（#19）で扱う。 |
| Screen固有内容 | 各Mockの詳細UI | placeholder | UI-002の対象外。各Screen Issueで実装する。 |

## Result

GO
