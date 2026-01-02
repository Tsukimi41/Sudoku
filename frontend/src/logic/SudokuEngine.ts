/*
仕様書:
シングルトン管理: Wasmモジュールはアプリ内で1つあれば十分。

型定義: window オブジェクトに createSudokuModule があることをTypeScriptに教える。

初期化メソッド: solver.js を動的に読み込み、モジュールを初期化する。
*/


//型定義の拡張: windowにcreateSudokuModule が存在することをTypeScriptに宣言する。
declare global {
  interface Window {
    createSudokuModule: () => Promise<any>;
  }
}

export class SudokuEngine {
  private module: any = null;
  private memory: any = null; // C++側のメモリ空間(HEAP32)への参照

  // 初期化処理
  //initは特別な予約語ではない。setup() でも start() でも構わないが、慣習的に、初期化を行う関数をinitと呼ぶ。
  async init() {
    if (this.module) return; // 既にロード済みなら何もしない

    // scriptタグを作って public/wasm/solver.js を読み込む
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script"); //新しい <script> タグ（HTML要素）を生成。scriptは、JSを書くための輩。
      script.src = "/wasm/solver.js"; // publicフォルダはルート(/)になる
      script.onload = () => resolve();// スクリプトの読み込みが完了したとき(onload)に、Promiseは果たされた(resolve)と報告する
      script.onerror = () => reject(new Error("Failed to load solver.js"));
      document.body.appendChild(script); //createしたタグはまだ画面には配属されておらず、タグを、Webページの body（胴体）の末尾にくっつけろ（Append）という命令で初めてブラウザがスクリプトと認識する。
    });

    // ロードされた関数を実行してWasmを準備
    this.module = await window.createSudokuModule();
    this.memory = this.module.HEAP32; 
  }

  //盤面を受け取って解く関数
  //board: 長さ81の数値配列 (0-9)
  //戻り値: 解けた配列 (解けなければnull)
  solve(board: number[]): number[] | null {
    if (!this.module) throw new Error("Engine not initialized");

    // メモリ確保とデータのコピー
    //malloc関数は動的にメモリを確保する関数
    // C++側のメモリを確保 (intは4バイト × 81個)
    const byteCount = 81 * 4;
    const ptr = this.module._malloc(byteCount);

    //HEAP32: C++のメモリ全体を「32bit整数（int）」の配列として見ているもの。

    try {
      //JSの配列(board)を、C++のメモリ(HEAP32)にコピーする
      //this.module.HEAP32.set(配列, オフセット);
      //オフセットは ポインタ(ptr)/4（32bit = 4byte単位だから）
      const offset = ptr/4;
      this.module.HEAP32.set(board, offset);


      //C++の solve 関数を実行
      const result = this.module._solve(ptr);

      // 結果に応じてデータを書き戻す
      if (result === 1) {
        // C++のメモリから結果を取り出す
        // ヒント: this.module.HEAP32.subarray(...)
        const solvedArray = new Int32Array(
            this.module.HEAP32.buffer, 
            ptr, 
            81
        );
        // JSの普通の配列に変換して返す
        return Array.from(solvedArray);
      } else {
        return null; // 解けなかった
      }

    } finally {
      // メモリ解放 
      this.module._free(ptr);
    }
  }
}