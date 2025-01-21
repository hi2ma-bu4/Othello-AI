class Othello {
	constructor() {
		this.aiMemory = {};
		this.animationDuration = 500;
		this.waitTurn = 100;
		this.isAIPlaying = false;
		this.interval = null;
		this.winStats = { black: 0, white: 0 }; // 勝敗数を記録

		document.getElementById("startAIvsAI").addEventListener("click", () => {
			this.resetGame();
			this.startAIvsAI();
		});

		this.resetGame();
	}

	initBoard() {
		this.board[3][3] = "white";
		this.board[3][4] = "black";
		this.board[4][3] = "black";
		this.board[4][4] = "white";
	}

	resetGame() {
		// 盤面を初期状態にリセット
		if (this.interval) clearInterval(this.interval);
		this._isEnd = false;
		this.board = Array(8)
			.fill(null)
			.map(() => Array(8).fill(null));
		this.initBoard(); // 初期配置のセット
		this.currentPlayer = "black"; // プレイヤーを黒にリセット
		this.renderBoard(); // 盤面を再描画
		this.updateInfo(); // 情報を更新
	}

	isGameOver() {
		// 盤面が埋まっているかチェック
		const isBoardFull = this.board.every((row) => row.every((cell) => cell !== null));

		// 黒と白のどちらも有効な手がない場合をチェック
		const blackHasMoves = this.getAllValidMoves("black").length > 0;
		const whiteHasMoves = this.getAllValidMoves("white").length > 0;

		return isBoardFull || (!blackHasMoves && !whiteHasMoves) || this._isEnd;
	}

	renderBoard() {
		const boardElement = document.getElementById("board");

		// 初回のみ盤面を生成
		if (!boardElement.hasChildNodes()) {
			for (let row = 0; row < 8; row++) {
				for (let col = 0; col < 8; col++) {
					const cell = document.createElement("div");
					cell.classList.add("cell");
					cell.dataset.row = row;
					cell.dataset.col = col;

					// 予測値を表示する要素を追加
					const prediction = document.createElement("div");
					prediction.classList.add("prediction");
					cell.appendChild(prediction);

					boardElement.appendChild(cell);
				}
			}
		}

		// セルの状態をリセットし、必要な情報を更新
		let highlightCells = [];
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				const cell = boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
				const prediction = cell.querySelector(".prediction");

				// セルの状態をリセット
				cell.classList.remove("black", "white", "highlight");
				prediction.textContent = ""; // 予測値をリセット

				if (this.board[row][col]) {
					// 黒か白の石を表示
					cell.classList.add(this.board[row][col]);
				} else if (this.isValidMove(row, col, this.currentPlayer)) {
					// 有効な手をハイライト
					cell.classList.add("highlight");
					highlightCells.push({ row, col }); // highlight対象のセルを保存
					cell.addEventListener("click", () => this.makeMove(row, col));
				}
			}
		}

		let maxPrediction = -Infinity; // 最も高い確率を格納する変数
		let maxPredictionStyle = null; // 最も高い確率のセルを格納する変数

		// `highlight` セルの予測確率を正規化して合計が100%になるようにする
		if (highlightCells.length > 0) {
			const totalPrediction = Math.max(
				highlightCells.reduce((sum, { row, col }) => {
					const key = `${row},${col}`;
					return sum + (this.aiMemory[key] || 0);
				}, 0),
				1
			);

			highlightCells.forEach(({ row, col }) => {
				const key = `${row},${col}`;
				const normalizedProbability = ((this.aiMemory[key] || 0) / totalPrediction) * 100;
				const cell = boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
				const prediction = cell.querySelector(".prediction");
				prediction.textContent = `${normalizedProbability.toFixed(1)}%`;
				prediction.style.color = "";

				if (normalizedProbability > maxPrediction) {
					maxPrediction = normalizedProbability;
					maxPredictionStyle = prediction.style;
				}

				// ハイライトされたセルにスコアを加算
				const score = this.evaluateMove(row, col);
				this.learnUserPattern(row, col, score); // スコアを学習
			});

			if (maxPredictionStyle) {
				maxPredictionStyle.color = "red";
			}
		}
	}

	isValidMove(row, col, player) {
		if (this.board[row][col]) return false;
		const opponent = player === "black" ? "white" : "black";
		const directions = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
			[-1, -1],
			[-1, 1],
			[1, -1],
			[1, 1],
		];
		for (const [dx, dy] of directions) {
			let x = row + dx,
				y = col + dy,
				hasOpponent = false;
			while (x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === opponent) {
				hasOpponent = true;
				x += dx;
				y += dy;
			}
			if (hasOpponent && x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === player) {
				return true;
			}
		}
		return false;
	}

	makeMove(row, col) {
		if (!this.isValidMove(row, col, this.currentPlayer)) return;

		this.board[row][col] = this.currentPlayer;
		this.flipPieces(row, col, this.currentPlayer);
		this.currentPlayer = this.currentPlayer === "black" ? "white" : "black";
		this.renderBoard();
		this.updateInfo();

		if (this.isGameOver()) {
			this.endGame();
		} else if (this.currentPlayer === "white" && !this.isAIPlaying) {
			this.isAIPlaying = true;
			setTimeout(() => {
				this.aiMove();
				this.isAIPlaying = false;
			}, this.waitTurn);
		}
	}

	flipPieces(row, col, player) {
		const opponent = player === "black" ? "white" : "black";
		const directions = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
			[-1, -1],
			[-1, 1],
			[1, -1],
			[1, 1],
		];
		const flipped = [];
		for (const [dx, dy] of directions) {
			let x = row + dx,
				y = col + dy,
				cellsToFlip = [];
			while (x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === opponent) {
				cellsToFlip.push([x, y]);
				x += dx;
				y += dy;
			}
			if (x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === player) {
				flipped.push(...cellsToFlip);
				cellsToFlip.forEach(([fx, fy]) => {
					this.board[fx][fy] = player;
				});
			}
		}

		// アニメーションの追加
		const boardElement = document.getElementById("board");
		flipped.forEach(([fx, fy]) => {
			const cell = boardElement.querySelector(`.cell[data-row="${fx}"][data-col="${fy}"]`);
			cell.classList.add("flip");
			setTimeout(() => cell.classList.remove("flip"), this.animationDuration);
		});
	}

	learnUserPattern(row, col, score) {
		const key = `${row},${col}`;
		if (this.aiMemory[key]) {
			// 既存のスコアに加算して履歴を更新
			this.aiMemory[key] += score;
		} else {
			// 初めての手ならスコアをそのまま記録
			this.aiMemory[key] = score;
		}
	}

	aiMove() {
		let bestMove = null;
		let bestScore = -Infinity;

		const validMoves = this.getAllValidMoves(this.currentPlayer);

		for (const move of validMoves) {
			const score = this.aiMemory[`${move.row},${move.col}`] || 0;
			if (score > bestScore) {
				bestScore = score;
				bestMove = move;
			}
		}
		if (bestMove) {
			this.makeMove(bestMove.row, bestMove.col);
		}
	}

	evaluateMove(row, col) {
		const opponent = this.currentPlayer === "black" ? "white" : "black";
		let score = 0;
		let capturedCells = 0; // 取得したセル数

		// 角に置ける場合は高スコア
		if ((row === 0 && col === 0) || (row === 0 && col === 7) || (row === 7 && col === 0) || (row === 7 && col === 7)) {
			score += 100;
		}

		// 辺に置ける場合は追加スコア
		if (row === 0 || row === 7 || col === 0 || col === 7) {
			score += 10;
		}

		// 相手の石を囲い込む手と取得セル数
		const directions = [
			[-1, 0], // 上
			[1, 0], // 下
			[0, -1], // 左
			[0, 1], // 右
			[-1, -1], // 左上
			[-1, 1], // 右上
			[1, -1], // 左下
			[1, 1], // 右下
		];

		let opponentTotalCapture = 0; // 相手の取得可能セル数

		for (const [dx, dy] of directions) {
			let x = row + dx,
				y = col + dy;
			let opponentCount = 0;
			let cellsToCapture = 0;

			// 相手の石を数える
			while (x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === opponent) {
				opponentCount++;
				x += dx;
				y += dy;
			}

			// 自分の石が現れた場合に囲い込める
			if (opponentCount > 0 && x >= 0 && x < 8 && y >= 0 && y < 8 && this.board[x][y] === this.currentPlayer) {
				cellsToCapture = opponentCount; // この方向でひっくり返せるセル数をカウント
				score += cellsToCapture * 5; // 相手の石を囲い込む手は得点が高い
				capturedCells += cellsToCapture; // 取得セル数を加算
			}

			// 相手の取得可能セル数を加算
			opponentTotalCapture += opponentCount;
		}

		// 相手が取得可能なセル数が少ないほど高得点になるように調整
		if (opponentTotalCapture > 0) {
			score += (1 / opponentTotalCapture) * 50; // 相手の取得可能枚数が少ないほどスコアが増える
		}

		// 取得セル数によるスコアの追加（取得セル数が多ければスコアが上がる）
		score += capturedCells * 2;

		return score;
	}

	passTurn() {
		// 現在のターンのプレイヤーを切り替える
		this.currentPlayer = this.currentPlayer === "black" ? "white" : "black";
	}

	updateInfo() {
		document.getElementById("current-player").textContent = `現在のプレイヤー: ${this.currentPlayer === "black" ? "黒" : "白"}`;
		const prediction = Object.entries(this.aiMemory)
			.map(([key, value]) => `${key}: ${value}`)
			.join(", ");
		document.getElementById("ai-prediction").textContent = `AI予測: ${prediction}`;
	}

	startAIvsAI() {
		let interval;

		const aiPlay = () => {
			const validMoves = this.getAllValidMoves(this.currentPlayer);
			if (validMoves.length > 0) {
				if (this.currentPlayer === "black") {
					// 黒のAIはランダムな手を選ぶ
					const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
					this.makeMove(randomMove.row, randomMove.col);
				} else {
					// 白のAIは最適な手を選ぶ
					const bestMove = this.getBestMove(validMoves);
					this.makeMove(bestMove.row, bestMove.col);
				}
			} else {
				this.passTurn(); // 有効な手がない場合はパス
			}
		};

		// AIのターンを1秒おきに進める
		this.interval = setInterval(aiPlay, this.waitTurn * 2);
	}

	getBestMove(validMoves) {
		// 最適な手を評価するロジック
		let bestMove = null;
		let bestScore = -Infinity;
		for (let move of validMoves) {
			const score = this.evaluateMove(move.row, move.col);
			if (score > bestScore) {
				bestScore = score;
				bestMove = move;
			}
		}
		return bestMove;
	}

	getAllValidMoves(player) {
		const validMoves = [];
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				if (this.isValidMove(row, col, player)) {
					validMoves.push({ row, col });
				}
			}
		}
		return validMoves;
	}

	endGame() {
		// 黒と白の石の数をカウント
		const blackCount = this.board.flat().filter((cell) => cell === "black").length;
		const whiteCount = this.board.flat().filter((cell) => cell === "white").length;

		// 勝敗を判定してカウントを更新
		let message = "";
		if (blackCount > whiteCount) {
			this.winStats.black++;
			message = "黒の勝ち！";
		} else if (whiteCount > blackCount) {
			this.winStats.white++;
			message = "白の勝ち！";
		} else {
			message = "引き分け！";
		}
		//console.log(message);

		// 勝敗数を更新
		this.updateWinStats();

		// ゲームをリセット
		const e = this._isEnd;
		this.resetGame();
		if (!e) {
			this.startAIvsAI();
		}
	}

	updateWinStats() {
		const winStatsElement = document.getElementById("win-stats");
		winStatsElement.textContent = `黒の勝ち: ${this.winStats.black} | 白の勝ち: ${this.winStats.white}`;
	}
}

document.addEventListener("DOMContentLoaded", () => {
	window.othello = new Othello();
});
