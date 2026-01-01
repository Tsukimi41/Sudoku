#include <emscripten/emscripten.h>

extern "C"{
    EMSCRIPTEN_KEEPALIVE
    int isValid(int* board, int row, int col, int num){
        //int index = row * 9 + col;
        
        for(int i=0;i<9;i++){
            //行の確認 || 列での確認
            if(board[i * 9 + col]==num || board[row * 9 + i] == num) return 0;
        }
        //3x3確認
        int startRow = (row / 3) * 3, startCol = (col / 3) * 3;
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                if(board[(startRow + i) * 9 + startCol + j]== num)return 0;
            }
        }
        return 1; //1:valid, 0:NG
    }
    EMSCRIPTEN_KEEPALIVE
    int solve(int* board){//1:solved, 0:unsolved
        for(int i=0;i<9;i++){
            for(int j=0;j<9;j++){
                if(board[i*9 + j]==0){
                    for(int k=1;k<=9;k++){
                        if(isValid(board, i, j, k)){
                            board[i*9 + j]=k;
                            if(solve(board)){
                                return 1;
                            }
                            else{
                                board[i*9 + j]=0;
                            }
                        }
                    }
                    return 0;
                }
            }
        }
        return 1;
    }
}