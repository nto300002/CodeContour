# 根拠・参考資料

[ドキュメント一覧](README.md) | [設計思想](product-principles.md)

> 要件定義で参照した研究・設計原則をまとめます。
> 元文書の節番号は、議論・履歴との対応を追跡できるよう維持しています。

## 根拠・参考資料

* Ko, Myers, Coblenz & Aung, *An Exploratory Study of How Developers Seek, Relate, and Collect Relevant Information during Software Maintenance Tasks*, IEEE Transactions on Software Engineering, 2006. コード理解における探索・Navigation・関連情報保持の負荷を観察。
* Sillito, Murphy & De Volder, *Asking and Answering Questions during a Programming Change Task*, IEEE Transactions on Software Engineering, 2008. 開発者が変更作業時に必要とするコード位置・依存・関係に関する問いを体系化。
* Alanazi, Gharibi & Lee, *Facilitating Program Comprehension with Call Graph Multilevel Hierarchical Abstractions*, Journal of Systems and Software, 2021. 大規模コード構造を複数抽象度で提示するプログラム理解支援を検討。
* Chi & Wylie, *The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes*, Educational Psychologist, 2014. 自己説明など、学習者自身が知識を生成・構成する活動の重要性を整理。
* Chi et al., *Self-Explanations: How Students Study and Use Examples in Learning to Solve Problems*, Cognitive Science, 1989. 自己説明と理解形成の関係を分析。
* Roediger & Karpicke, *Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention*, Psychological Science, 2006. 自力での想起が長期保持に寄与することを示した研究。
* Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, Transactions of the ACL, 2024. 長いContextへすべての情報を投入しても有効利用が保証されず、関連Context選択が重要であることを示しています。
* Zhang et al., *RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation*, EMNLP, 2023. Repository全文ではなく関連Contextを反復的に取得する方式を提案。
* Saltzer & Schroeder, *The Protection of Information in Computer Systems*, Proceedings of the IEEE, 1975. Least PrivilegeやComplete Mediationなど、権限制御をシステム境界で強制する設計原則の基礎。

---
