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