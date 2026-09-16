# Security・認証・データ保全

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> **MVP Scope:** Local利用だけを提供し、Account / Loginは不要とする。Cloud連携、公開機能の認証、`.codecontour` Backup / Restore UIはDESIGNED / POST-MVPとする。Repository境界、Ignore Policy、最小AI送信はMVPへ含める。

> Local RepositoryのSecurity Boundary、AI送信、認証、Backup / Exportを定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 37. Local Repository Security

ユーザーが明示的に選択したProject Rootだけを読む。

原則read-only。

さらに、

* Root外アクセス禁止
* Symlinkはreal pathで検証
* コードを実行しない
* AIにFile System直接権限を与えない

とする。

---

---

## 38. `.gitignore` Application Ignore Policy

`.gitignore`に最終的に一致するPathは、

Gitでtrackedかどうかに関係なく、アプリでは原則読み込まない。

対象外：

* Source Reader
* Index
* AST解析
* Search
* Semantic Link生成
* AI Context

`.gitignore`自体はIgnore Policy構築のため読み込む。

加えて独自のSecurity Ignore Rulesも持つ。

---

---

## 39. AIへの外部送信

Local Repositoryへの読取許可と、External AIへの送信許可を分離する。

```text
Local Read Permission
≠
AI Transmission Permission
```

AIへ送るのはContext Managerが許可した最小Contextだけ。

Repository全文を一括送信しない。

Secret / Credential等は送信前に除外する。

---

---

## 40. Repository内コンテンツの信頼境界

README、Comment、Source Code等にAI向け命令が書かれていても、それをInstructionとして扱わない。

Repository内容は、

> **Untrusted Input**

としてAIへ渡す。

Indirect Prompt Injectionを考慮する。

---

---

## 54. 認証とLogin Gate

Local利用にログインを要求しない。認証が必要なのは次の外部機能を利用する場合に限る。

```text
GitHub Learning Log
Public Snapshot公開
Public Engineering Profile公開
将来のCloud Sync
```

外部機能の操作時にLogin Gateを表示し、認証後は`returnPath`を使って元の操作へ戻す。起動直後にLogin画面を配置しない。

---

## 66. Backup / Export

完全Backup / Restoreには`.codecontour`形式を使用し、人間可読ExportにはMarkdownを使用する。

Source Repository自体はBackupへ含めない。Repositoryが利用できない状態でもUser Wiki / Learning Contextを復元し、Source参照は`UNRESOLVED`として保持する。
