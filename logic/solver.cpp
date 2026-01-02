#include <emscripten/emscripten.h>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    int isValid(int* board, int row, int col, int num) {
        for (int i = 0; i < 9; i++) {
            if (board[i * 9 + col] == num || board[row * 9 + i] == num) return 0;
        }
        int startRow = (row / 3) * 3, startCol = (col / 3) * 3;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[(startRow + i) * 9 + startCol + j] == num) return 0;
            }
        }
        return 1;
    }

    // 内部用の再帰関数（indexを受け取る）
    int solveRecursive(int* board, int index) {
        if (index == 81) return 1; // 全て埋まった

        int row = index / 9;
        int col = index % 9;

        // 既に数字が入っているなら次へ
        if (board[index] != 0) {
            return solveRecursive(board, index + 1);
        }

        // 数字を入れてみる
        for (int k = 1; k <= 9; k++) {
            if (isValid(board, row, col, k)) {
                board[index] = k;
                if (solveRecursive(board, index + 1)) return 1;
                board[index] = 0; // バックトラック
            }
        }
        return 0; // 解けなかった
    }

    int isBoardValid(int* board) {
        for (int i = 0; i < 81; i++) {
            if (board[i] != 0) {
                int temp = board[i];
                board[i] = 0; // 一旦空にする
                
                int row = i / 9;
                int col = i % 9;
                if (!isValid(board, row, col, temp)) {
                    board[i] = temp;
                    return 0; // 重複あり（不正な盤面）
                }
                board[i] = temp; // 戻す
            }
        }
        return 1;
    }

    // JSから呼ばれるエントリポイント
    EMSCRIPTEN_KEEPALIVE
    int solve(int* board) {
        // 事前チェック
        if (!isBoardValid(board)) {
            return 0; // 計算せずに「解なし」を返す
        }
        // 2. 解く
        return solveRecursive(board, 0);// 0番目のマスから開始
    }
}