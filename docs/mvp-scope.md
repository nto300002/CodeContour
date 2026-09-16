# MVP Scope・対応範囲・非機能目標

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> MVPの対応OS・言語・Framework、非目標、未決事項、性能目標を定義します。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 41. MVPの非目標

明示的にMVP外とする。

* Source Code編集
* AIコード生成
* AI自動修正
* AI Coding Agent
* Terminal
* Debugger
* Source RepositoryへのGit write操作
* Repository全体のAI自動Wiki
* 完全自動Feature確定
* 完全自動Process確定
* 巨大Function-level Graph
* Runtime Trace
* CI/CD解析
* Cloud / Infrastructure Dependency
* 本格SAST
* Architecture採点
* チーム共同編集
* Role / Permission
* コメント・Mention
* XP / Badge / Ranking
* 汎用Wiki
* 汎用Memoアプリ
* AIによる完全Curriculum生成
* Source CodeへのMemo書込み
* Repository全文のLLM一括送信
* AIによる任意File探索
* AIによるShell実行

---

---

## 42. 言語について

プロダクト思想としては**言語非依存**とする。

ただしMVPですべての言語を解析可能にするわけではない。

```text
Product Principle:
Language Agnostic

MVP:
Supported Languagesを限定
```

と分ける。

MVPのCore LanguageはTypeScript、Python、PHPとする。Framework-aware解析はReact、Next.js、Django、FastAPI、CakePHP、Laravelを対象とする。

---

---

## 44. 現時点で残っている主な要件決定事項

ここまでで思想と主要要件はかなり固まっています。

今後決める必要があるのは主に以下です。

| 項目                    | 状態                      |
| --------------------- | ----------------------- |
| MVP対応言語               | TypeScript / Python / PHPに確定 |
| 対応OS                  | macOS / Windowsに確定。LinuxはMVP外 |
| Feature作成・編集仕様        | 詳細未決                    |
| 面の初期Feature生成方法       | 詳細未決                    |
| Process Template正式一覧  | 7種類 + Customに確定          |
| Process Primitive正式一覧 | 確定                      |
| Relation Type正式一覧     | Structural / Semanticともに確定 |
| Data Flow入力UI         | データ項目・所有権は確定、操作詳細は未決 |
| Symbol候補ranking条件     | 方針確定、重み未決               |
| AI Context Budget     | PoC事項                   |
| Graphの抽象化UI           | 未決                      |
| Memo付与可能単位            | Symbol中心、Expression等は未決 |
| Understanding State   | 独立軸モデルに確定               |
| Feature Context保存形式   | Projection / Chunk / Snapshot方針に確定、物理形式は未決 |
| Context履歴保存期間         | 未決                      |
| Git過去commit学習UI       | First Parent・Relevant History方針は確定、操作詳細は未決 |
| Local保存方法             | 技術設計事項                  |
| AIモデル                 | 未決・詳細設計事項               |

つまり、**「何を作るか」はかなり固まり、「具体的にどう操作させるか」を決める段階**まで来ています。

---

## 45. 確定要件追補

本章以降は、その後の設計議論で確定した要件をまとめた追補である。前章までの記述と矛盾する場合は、本追補を優先する。

---

### 45.1 MVP対応範囲

| 項目 | 確定内容 |
| --- | --- |
| 対応OS | macOS / Windows。LinuxはMVP外 |
| Core Language | TypeScript / Python / PHP |
| Framework-aware | React / Next.js / Django / FastAPI / CakePHP / Laravel |
| 解析Tier | Tier A: Deterministic、Tier B: Framework-aware、Tier C: Inferred / Dynamic |
| Tier A精度目標 | Precision 98%以上、Recall 95%以上 |
| Tier B精度目標 | Precision 95%以上、Recall 85%以上 |

精度目標はPoCで検証する目標値である。誤検出より`UNKNOWN`を優先し、`UNKNOWN`を一級状態として扱う。

---

## 67. 非機能目標

代表Repositoryの想定規模と応答時間の設計目標を次のように定める。

```text
代表Repository:
100k LOC以下
10k files以下

Code表示:
500ms以下

面 ↔ 線 ↔ 点:
300ms以下

Symbol Search:
1s以下

Semantic Link:
500ms以下

初回Structural Index:
60s以下
```

AI処理の待機によって、非AI操作をBlockingしない。
