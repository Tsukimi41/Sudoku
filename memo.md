# memo 

### コンパイルの4ステップ

* プリプロセス (Preprocessing):

#include などの命令を処理します。実は、#include <iostream> は「そのファイルの中身をそのままここにコピペせよ」という単純な置換命令です。

* コンパイル (Compilation):

C++のコードを、一度「アセンブリ言語（CPUへの直接命令）」や「中間コード（LLVM IR）」に変換します。ここで文法エラー（Syntax Error）がチェックされます。

* アセンブル (Assembly):

人間が読めるアセンブリ言語を、機械語（バイナリ）のオブジェクトファイル（.o）に変換します。

* リンク (Linking):

複数の .o ファイルやライブラリを結合し、一つの実行ファイル（今回は .wasm）にします。関数の中身が見つからないエラー（Undefined Symbol）はここで起きます。


### int* board (ポインタ)
```C++
#include <emscripten/emscripten.h>

extern "C" {
    // int* board は、配列の先頭のアドレス（ポインタ）を受け取る
    EMSCRIPTEN_KEEPALIVE
    void increment_board(int* board, int size) {
        for (int i = 0; i < size; i++) {
            // board[i] は *(board + i) と同じ意味
            board[i] += 1;
        }
    }
}
```
* C++では、配列を関数に渡すとき、配列そのもの（コピー）を渡すと巨大すぎて遅くなります。
* 代わりに**メモリの何番地にデータがあるか（住所）**だけを渡します。これがポインタです。
* board[0] は「住所の場所にあるデータ」、board[1] は「住所の隣のデータ」を読み書きします。


### Wasmモジュールとは何か？（工場と製品）
solver.js が読み込まれると、それは単なる関数ではなく、工場（Factory）として機能します。 この工場が稼働（初期化）すると、以下のものを含む巨大なオブジェクトが生み出されます。これを「インスタンス（またはモジュール）」**と呼びます。

* HEAP32: C++と共有しているメモリ空間（巨大な配列）。

* _solve: C++で書いた関数への入り口。

* _malloc / _free: メモリ管理機能。

#### なぜ「1つあれば十分」なのか？ 
この工場を稼働させるには、Wasmファイルをダウンロードし、コンパイルし、メモリを確保するという「重い」コストがかかります。 数独を解くのに、工場を毎回建設する必要はありません。1つの工場を建てて、それを何度も使い回すのが最も効率的です。


### TypeScriptの型定義（検閲官）
TypeScriptは「コードを実行する前」にミスを見つけるための検閲官です。 TSは window オブジェクトの標準的な中身（alert や document など）を知っています。

しかし、Emscriptenが勝手に追加した createSudokuModule のことは知りません。 TS: 「おい、window.createSudokuModule なんて存在しないぞ！スペルミスか？」と激怒（コンパイルエラー）します。

これを黙らせるのが**「型定義の拡張（Declaration Merging）」**です。 「標準の Window 型には載ってないけど、僕のアプリではこれを使うから、辞書に追加しておいて」とTSに教える行為です。

``` Typescript
// 辞書への追加申請
declare global {
  interface Window {
    createSudokuModule: () => Promise<any>; // 「こういう関数があるよ」と教える
  }
}
```

## 関連図

### C++: solver.cpp

* ブラウザ内ではWasmに変換される。
* 計算。数独を解くアルゴリズムそのもの。

### Wasm: solver.wasm

* Wasmとは、ブラウザ上で高速にプログラムを動作させるためのバイナリフォーマットの一種。
* ブラウザ上で動作するために、C++のコードが変換されたもの。
* C、C++、Rustなどの言語で書かれたコードをコンパイルして利用可能。JavaScriptよりも高速に実行できる。
* JSからは直接手出しできない。唯一の窓口が Module オブジェクト。

### Typescript: SudokuEngine.ts

* JavaScriptを書くための設計図。実行前（コンパイル時）にミス(型エラー)を検知する検閲官。
* ブラウザで動くときは JavaScript に変換され、TypeScriptとしての自我は消滅する。

### フェーズ1：起動
Browser: URLを開く。

HTTP: index.html と app.js (ビルドされたTS) をダウンロード。

Solid.js (TS): SudokuEngine クラスを new する（まだ中身は空っぽ）。

SudokuEngine: init() が呼ばれる。

DOM: document.createElement("script") でタグ生成。

HTTP: タグを見て、裏で solver.js を取りに行く。

Promise: 「届くまで待つ（await）」状態になる。

Browser: solver.js 到着＆実行。window.createSudokuModule が爆誕。

Promise: onload が発火し、待機解除。

Module: 工場が稼働し、Wasmインスタンス（this.module）が完成。

### フェーズ2：実行
UI: ユーザーが「解く」ボタンを押す。

SudokuEngine: solve([0, 5, ...]) が呼ばれる。

Memory: _malloc でC++側の土地を確保。

HEAP32: JSの配列データを、確保した土地にコピー（.set）。

C++: _solve(ptr) が呼ばれ、猛烈な速度でバックトラック法を実行。

Memory: C++が計算結果をその土地に書き込む。

SudokuEngine: HEAP32 のその場所から、答え（数字の列）を吸い上げる（.subarray）。

Memory: _free で土地を更地に戻す。

UI: 戻ってきた答えを画面に表示する。