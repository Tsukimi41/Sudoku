import { createSignal, For, onMount, Show, onCleanup } from 'solid-js'
import { SudokuEngine } from "./logic/SudokuEngine";
import './App.css'

type SudokuState = 'LOADING' | 'READY' | 'SOLVING' | 'SOLVED' | 'ERROR' | 'UNSOLVABLE';

type HistoryState = {
  board: number[];
  initialMask: boolean[];
  status: SudokuState;
};

function App() {
  const engine = new SudokuEngine;

  const [board, setBoard] = createSignal<number[]>(new Array(81).fill(0));
  const [initialMask, setInitialMask] = createSignal<boolean[]>(new Array(81).fill(false));// ユーザー入力のデータを選別・保護するためのフィルター。マスキング。
  const[status, setStatus] = createSignal<SudokuState>('LOADING')
  const [selectedCell, setSelectedCell] = createSignal<number | null>(null);
  
  const [history, setHistory] = createSignal<HistoryState[]>([{
    board: new Array(81).fill(0),　// 初期状態を履歴の1ページ目として入れておく
    initialMask: new Array(81).fill(false),
    status: 'READY' // ロード完了後を想定
  }]);
  const [historyIndex, setHistoryIndex] = createSignal(0);

  //履歴
  const saveHistory = (
    newBoard: number[], 
    newMask: boolean[], 
    newStatus: SudokuState, 
    overwrite = false //trueは初期化用。履歴を追加せず現在のページを書き換える
  ) => {
    const currentHist = history();
    const idx = historyIndex();

    if (overwrite) {
      // 現在のページを上書き
      const updatedHistory = [...currentHist];
      updatedHistory[idx] = { 
        board: [...newBoard], 
        initialMask: [...newMask], 
        status: newStatus 
      };
      setHistory(updatedHistory);
    } else {
      // 新しいページを追加（未来の履歴は切り捨てる）
      const historyUpToNow = currentHist.slice(0, idx + 1);
      const newState: HistoryState = {
        board: [...newBoard],      // 配列は必ずコピーして保存
        initialMask: [...newMask], // これを忘れると過去も変わってしまう
        status: newStatus
      };
      setHistory([...historyUpToNow, newState]);
      setHistoryIndex(idx + 1);
    }
  };

  //UNDO
  const handleUndo = () => {
    const idx = historyIndex();
    if (idx > 0) {
      const prevIdx = idx - 1;
      const prevState = history()[prevIdx];
      
      // 状態を復元
      setBoard([...prevState.board]);
      setInitialMask([...prevState.initialMask]);
      setStatus(prevState.status);
      setHistoryIndex(prevIdx);
      setSelectedCell(null); // 選択解除
    }
  };

  const handleRedo = () => {
    const idx = historyIndex();
    if (idx < history().length - 1) {
      const nextIdx = idx + 1;
      const nextState = history()[nextIdx];

      // 状態を復元
      setBoard([...nextState.board]);
      setInitialMask([...nextState.initialMask]);
      setStatus(nextState.status);
      setHistoryIndex(nextIdx);
      setSelectedCell(null);
    }
  };

  // 初期化
  onMount(async () => {
    // タイムアウト付きの初期化処理
    const initEngine = async () => {
      try {
        // 5秒以内に初期化できなければエラーとする
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        
        await Promise.race([
          engine.init(),
          timeoutPromise
        ]);
        
        setStatus('READY');
        // 初期状態保存
        saveHistory(new Array(81).fill(0), new Array(81).fill(false), 'READY', true);
      } catch (e) {
        console.error("Initialization failed:", e);
        setStatus('ERROR');
      }
    };

    await initEngine();
    const handleKeyDown = (e: KeyboardEvent) => {
      // 計算中は操作を受け付けない
      if (status() === 'SOLVING') return;

      // 1. 数字入力 (1-9)
      if (e.key >= '1' && e.key <= '9') {
        handleInput(parseInt(e.key));
        return;
      }

      // 2. 削除 (Backspace, Delete, 0)
      if (['Backspace', 'Delete', '0'].includes(e.key)) {
        handleInput(0);
        return;
      }

      // 3. カーソル移動 (矢印キー) - PCユーザーのための「最高」のUX
      const current = selectedCell();
      if (current === null) return; // 選択中でなければ移動もしない

      if (e.key === 'ArrowUp' && current >= 9) {
        e.preventDefault(); // ブラウザのスクロール防止
        setSelectedCell(current - 9);
      }
      if (e.key === 'ArrowDown' && current < 72) {
        e.preventDefault();
        setSelectedCell(current + 9);
      }
      if (e.key === 'ArrowLeft' && current % 9 !== 0) {
        e.preventDefault();
        setSelectedCell(current - 1);
      }
      if (e.key === 'ArrowRight' && current % 9 !== 8) {
        e.preventDefault();
        setSelectedCell(current + 1);
      }

      // 4. 選択解除 (Escape)
      if (e.key === 'Escape') {
        setSelectedCell(null);
      }
      
      // 5. Undo/Redo ショートカット (Ctrl+Z, Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    // イベントリスナー登録
    window.addEventListener('keydown', handleKeyDown);

    // お片付け（必須）
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });


  
  //マスが選択されたとき
  const handleCellClick = (index: number) => {
    if(status() === 'SOLVING') return;
    setSelectedCell(prev => prev === index? null :index);
  }
// キーパッド入力処理
  const handleInput = (num: number) => {
    const idx = selectedCell();
    if (idx === null) return;

    const currentBoard = [...board()];
    const currentMask = [...initialMask()];

    //値が変わっていないなら何もしない
    if (currentBoard[idx] === num) return;

    //盤面の更新
    currentBoard[idx] = num;
    setBoard(currentBoard);

    // マスク更新
    // 0が入力されたら false、数字ならtrue
    //0を入れた時に正しくユーザー入力の解除として扱う
    currentMask[idx] = num !== 0;
    setInitialMask(currentMask);

    // 3. 履歴に保存
    saveHistory(currentBoard, currentMask, status());
  };

  // 計算実行
  const handleSolve = async () => {
    if (status() !== 'READY' && status() !== 'SOLVED' && status() !== 'UNSOLVABLE') return;
    
    setStatus('SOLVING');
    
    // UIのレンダリングを待つための微小な遅延
    await new Promise(r => setTimeout(r, 50));

    const currentBoard = board();
    const result = engine.solve(currentBoard);

    if (result) {
      // 演出: 一瞬待ってから結果を表示
      setTimeout(() => {
        setBoard(result);
        setStatus('SOLVED');
        setSelectedCell(null); // 選択解除
        saveHistory(result, initialMask(), 'SOLVED');
      }, 300);
    } else {
      setStatus('UNSOLVABLE');
      saveHistory(currentBoard, initialMask(), 'UNSOLVABLE');
    }
  };

  // リセット
  const handleClear = () => {
    const emptyBoard = new Array(81).fill(0);
    const emptyMask = new Array(81).fill(false);
    
    setBoard(emptyBoard);
    setInitialMask(emptyMask);
    setStatus('READY');
    setSelectedCell(null);

    saveHistory(emptyBoard, emptyMask, 'READY');
  };

  //retry 答えだけ消す
  const handleResetAnswer = () => {
    const resetBoard = board().map((val, i) => initialMask()[i] ? val : 0);
    
    setBoard(resetBoard);
    setStatus('READY');

    saveHistory(resetBoard, initialMask(), 'READY');
  };

  return (
    <div class="app-container">
      <header class="header">
        <h1>Solid Sudoku</h1>
        <div class="status-badge">
          {status() === 'LOADING' && "Loading Engine..."}
          {status() === 'READY' && "Ready to Solve"}
          {status() === 'SOLVING' && "Computing..."}
          {status() === 'SOLVED' && "Solved!"}
          {status() === 'UNSOLVABLE' && "No Solution Found"}
          {status() === 'ERROR' && "Engine Error"}
        </div>
      </header>

      <div class="sudoku-board">
        <For each={board()}>
          {(num, index) => {
            const isSelected = () => selectedCell() === index();
            const isInitial = () => initialMask()[index()];
            const isSolved = () => status() === 'SOLVED' && !isInitial() && num !== 0;
            
            return (
              <div
                class={`cell ${isSelected() ? 'active' : ''} ${isInitial() ? 'initial' : ''} ${isSolved() ? 'solved' : ''}`}
                // スマホでの反応速度向上のためonPointerDownを使用
                onPointerDown={(e) => {
                  e.preventDefault(); //スクロールや選択を防止
                  handleCellClick(index());
                }}
                style={{
                  "animation-delay": isSolved() ? `${(index() % 9 + Math.floor(index() / 9)) * 30}ms` : '0ms'
                }}
              >
                {/*0の場合は薄い点を表示*/}
                {num !== 0 ? num : <span style={{ opacity: 0.2, "pointer-events": "none" }}>・</span>}
              </div>
            );
          }}
        </For>
      </div>

      <div class="controls">
        <button 
          class="btn btn-primary" 
          onClick={handleSolve}
          disabled={status() === 'LOADING' || status() === 'SOLVING'}
        >
          {status() === 'SOLVING' ? '...' : 'Solve'}
        </button>
        <button class="btn btn-secondary" onClick={handleResetAnswer}>Retry</button>
        <button class="btn btn-secondary" onClick={handleClear}>Clear</button>
      </div>

      {/* Undo / Redo ボタン */}
      <div class="controls" style={{ "margin-top": "-10px" }}>
        <button 
          class="btn btn-secondary" 
          onClick={handleUndo} 
          disabled={historyIndex() <= 0 || status() === 'SOLVING'}
        >
          ↶ Undo
        </button>
        <button 
          class="btn btn-secondary" 
          onClick={handleRedo} 
          disabled={historyIndex() >= history().length - 1 || status() === 'SOLVING'}
        >
          ↷ Redo
        </button>
      </div>

      <div class="keypad">
        <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9]}>
          {(num) => (
            <button 
              class="key" 
              // ここも onPointerDown で高速化
              onPointerDown={(e) => {
                e.preventDefault();
                handleInput(num);
              }}
            >
              {num}
            </button>
          )}
        </For>
        <button 
          class="key key-clear" 
          onPointerDown={(e) => {
            e.preventDefault();
            handleInput(0);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default App;