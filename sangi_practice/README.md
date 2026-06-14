# sangi_practice（運用メモ・先生用）

サンギハッカソン対策の練習問題（Exercode 形式）一式です。学生向けの概要・問題一覧は [index.md](index.md) を参照してください。

## フォルダ構成

```
sangi_practice/
  index.md                       … 問題カタログ＋学習の進め方（学生向け）
  README.md                      … このファイル（運用メモ）
  .gitattributes                 … この配下を改行コード LF に固定
  sangi_practice_01 〜 _12/       … 各問題（12 問）
    sangi_practice_NN.problem.md  … 問題文（末尾に学習アドバイス）
    templates/                    … 受験者に渡す雛形（main.c / main.cpp / Main.java）
    model_answers/                … 模範解答（c / cpp / java）
    test_cases/                   … example_*.in/.out（例・表示用）, test_*.in/.out（採点用）
  _verify/                        … 検証ツール（※ Exercode へはアップロード不要）
    harness.py / run_tests.bat
```

## 検証のしかた

模範解答が「3 言語ともコンパイル成功 & 全テスト通過 & 3 言語の出力が一致」するかを自動チェックできます。

```
sangi_practice\_verify\run_tests.bat            … 全 12 問を検証
sangi_practice\_verify\run_tests.bat 03 10      … 番号を指定して検証
sangi_practice\_verify\run_tests.bat --gen      … C 模範解答から .out を作り直して検証
```

- C / C++ は Visual Studio の `cl`、Java は `javac`/`java` を使います。`run_tests.bat` 内の `vcvars64.bat` のパスは、お使いの Visual Studio に合わせて調整してください（現在は VS 18 Community 想定）。
- `.out` は C 模範解答の出力から生成し、C++ と Java の出力もそれに一致することを確認しています（3 つの独立実装が一致 ＝ 期待値の正しさの裏づけ）。

## Exercode へのアップロード

- アップロードするのは各 `sangi_practice_NN/` フォルダ（problem.md / templates / model_answers / test_cases）です。
- `_verify/`・`README.md`・`index.md`・`.gitattributes` は**アップロード不要**（手元の管理・検証用）。
- 採点は「空白・改行区切りの単語単位比較（浮動小数点は誤差許容）」を前提に作っています。

## 仕様の補足

- 1 セット ＝ 12 問 / 300 点（LV1×3・LV2×4・LV3×2・LV4×2・LV5×1）。
- 各問テストケースは 6 個（example 2 + test 4）。境界値・最大ケースを含みます。
- 模範解答の C は、関数先頭で変数宣言する書き方（VS でそのまま通る形）に揃えています。
- 出力記号はすべて半角です。
