# 配布方針: 低コスト段階導入

## 1. 目的

Apple Developer Programの費用を、外部ユーザーへ安全に配布する必要が生じるまで発生させない。同時に、未署名の配布物を一般利用者向けの安全な製品であるかのように扱わない。

## 2. 配布チャネルと許容範囲

| 段階 | 配布先 | 形式 | 署名 / notarization | 利用者への条件 | Apple費用 |
| --- | --- | --- | --- | --- | --- |
| D0: 開発 | 開発者本人 | ローカルBuild | 不要 | 開発環境だけで使用 | 不要 |
| D1: PoC技術者向け | 指定した技術者 | GitHub Actions ArtifactまたはGitHub Pre-releaseのzip | 不要 | Gatekeeper警告、未署名、限定用途を理解している | 不要 |
| D2: MVP User Test | 少人数の実ユーザー | versioned zip / dmg | 必須 | 通常のMac利用者が導入できる | Developer Program加入後 |
| D3: 一般公開 | GitHub Releases等 | versioned release asset | 必須 | 不特定多数が導入する | Developer Program加入後 |

GitHub Actions Artifactは一時検証用であり、標準では保持期限があります。継続して参照されるPoC配布物には、tagに紐付くGitHub Pre-release assetを使う。GitHub Releaseはtagを基準にバイナリを添付して配布できる。 [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) [Artifact保持期間](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts)

## 3. D1: 無料のPoC技術者向け一時配布

### 配布物に必須のもの

- `arm64`限定であることをファイル名とRelease Notesに明記する。
- `UNSIGNED-POC`と明記する。
- 対象Commit SHA、Node / Electron version、SQLite Driver、SHA-256を記載する。
- Gatekeeper警告が出る可能性、一般利用・業務利用を対象にしないことを記載する。
- インストール手順だけでなく、削除方法と問題報告先を記載する。
- Credential、実Repository、個人情報を配布物・log・reportに含めない。

### AIが実装する内容

1. Forgeで`arm64` zipを生成するrelease build scriptを追加する。
2. zipのSHA-256を生成し、release note templateへ出力する。
3. pre-release作成時だけassetをuploadするworkflowを追加する。
4. release noteに未署名警告と対象範囲を自動挿入する。
5. `npm test`、`npm run typecheck`、packaged smokeをrelease前Gateにする。

### 人間が行う内容

1. 配布対象の技術者と目的を限定する。
2. GitHub Pre-releaseをpublishする。
3. Release Notesの未署名警告を確認する。
4. 問題があればassetを削除またはpre-releaseを取り下げる。

## 4. D2 / D3: 署名済み配布への移行条件

次のいずれかが生じた時点で、Apple Developer Programへの加入と署名・notarization workflowを開始する。

- 技術者ではないMVP Userへ配布する。
- Gatekeeper警告なしの導入を求める。
- 継続利用、業務利用、または不特定多数への公開を行う。
- GitHub Releaseをstable / latestとして案内する。

移行後はDeveloper ID Applicationで署名し、notarization後にstapleした配布物に対して`codesign`、`spctl`、packaged smokeを実行する。未署名assetをD2 / D3へ昇格させない。

## 5. 実装順序

1. **現在**: CI上のDriver Spikeと未署名packaged smokeを維持する。
2. **PoC配布を実施すると決めた時**: D1用のForge make、checksum、pre-release workflow、release note templateを実装する。
3. **MVP User Testを開始すると決めた時**: Apple Developer Programへ加入し、Developer ID署名・notarization・staple workflowを実装する。
4. **一般公開前**: 署名済みrelease asset、検証結果、対象Commit、既知の制限をRelease Notesへ固定する。

## 6. コスト判断

- D0 / D1はApple Developer Programへ加入しないため、Appleの年額費用は発生しない。
- D2 / D3へ進む場合だけ、Apple Developer Program年額99 USD（地域により現地通貨）を費用として評価する。Developer IDとnotarizationは同プログラムに含まれる。 [Apple Developer Program](https://developer.apple.com/programs/enroll/)
- GitHub Actionsはpublic repositoryの標準runnerでは無料だが、private repositoryでは無料枠超過後に課金される場合がある。macOS runnerはLinuxより単価が高いため、D1のbuildはtag / 手動実行に限定し、毎pushでrelease assetを生成しない。 [GitHub Actions料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
