# Git・変更追跡・Staleness

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> Git時間軸、Incremental Update、AgeとStaleness、Learning Log Repository、STALE伝播を定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 24. Gitの役割

Gitは面・線・点と並列の理解階層ではなく、

> **それらが時間とともにどう変化したかを見る時間軸**

として利用する。

利用項目：

* HEAD
* commit
* diff
* changed symbols
* Semantic Commit Label
* Feature Contextの根拠commit
* Staleness判定

Gitへのwrite操作はMVPでは行わない。

---

---

## 25. Feature ContextのIncremental Update

コード変更時にFeature Context全体を再生成しない。

Git・静的解析からChange Packetを作る。

例：

```text
Changed:
AuthService.login()

Added:
MfaService.verify()

Relation:
PasswordVerify
→ MFA
→ Session
```

既存Feature ContextとChange PacketだけをAIへ渡し、

更新対象のProcess / Data / Relationを推論する。

---

---

## 26. AgeとStaleness

二つを分離する。

#### Age

```text
最終確認：72日前
```

時間が経過したことを示す。

#### Staleness

```text
⚠ この説明の根拠コードが変更されています
```

コード変更による陳腐化を示す。

Feature全体ではなくProcess / Symbol単位で部分的にStaleにできる。

---

---

## 49. GitとLearning Log Repository

Source Repositoryは引き続きread-onlyとし、Git writeを禁止する。

一方、CodeContour専用のLearning Log Repositoryには、ユーザーの明示操作に限りcommit / pushを許可する。

```text
Source Repository:
READ ONLY

Learning Log Repository:
WRITE ALLOWED by explicit user action
```

Git時間軸は次の3状態を正式にサポートする。

```text
Working Tree
HEAD
Historical Commit
```

Historical Commitはcheckoutせず、Git Objectから読み取る。MVPのBefore / After比較はFirst Parent基準とする。

Feature / Process / SymbolごとにRelevant Historyを提供し、Previous / Next Relevant Commitへ移動できるようにする。

---

## 62. Change PacketとSTALE伝播

Change Packetは次の種類を持つ。

```text
SYMBOL_ADDED
SYMBOL_REMOVED
SYMBOL_MOVED
SYMBOL_RENAMED
BODY_CHANGED
SIGNATURE_CHANGED
TYPE_CHANGED
CALL_RELATION_CHANGED
INJECTION_CHANGED
READ_WRITE_CHANGED
```

STALEは次の向きへ局所的に伝播する。

```text
Changed Code
↓
EvidenceBinding
↓
直接関連するUser Context
↓
Process等の局所Context
↓
Feature aggregate
```

Featureが`STALE`になったことを理由に、全子要素を`STALE`へ変更する逆伝播は行わない。Move / Rename後もSourceAnchorを再解決できた場合は`CURRENT`を維持できる。
