import { BoardShape, MiniChessGame } from "./game.js";
import { chooseBotMove } from "./bot.js";

const PIECE_SYMBOLS = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bk: "♚",
};

class MiniChessUI {
  constructor(rootId = "minichess-app") {
    this.root = document.getElementById(rootId);
    this.boardEl = document.getElementById("board");
    this.turnIndicator = document.getElementById("turn-indicator");
    this.statusEl = document.getElementById("game-status");
    this.restartBtn = document.getElementById("restart-btn");

    this.modalEl = document.getElementById("modal");
    this.modalMessageEl = document.getElementById("modal-message");
    this.modalCloseBtn = document.getElementById("modal-close");

    this.promotionModal = document.getElementById("promotion-modal");
    this.promotionOptions = document.getElementById("promotion-options");
    this.toastStack = document.getElementById("toast-stack");

    this.game = new MiniChessGame();
    this.selected = null;
    this.validMoves = [];
    this.botThinking = false;

    this.bindEvents();
    this.renderBoard();
    this.updateStatus();
    this.showMessage("Game started! You are White. Click a white piece to begin.");
  }

  bindEvents() {
    this.restartBtn.addEventListener("click", () => this.restart());
    this.modalCloseBtn.addEventListener("click", () => this.hideMessage());
  }

  restart() {
    this.game.reset();
    this.selected = null;
    this.validMoves = [];
    this.botThinking = false;
    this.renderBoard();
    this.updateStatus();
    this.showMessage("Game restarted. White to move.");
  }

  renderBoard() {
    const state = this.game.getState();
    this.boardEl.innerHTML = "";

    for (let row = 0; row < BoardShape.rows; row += 1) {
      for (let col = 0; col < BoardShape.cols; col += 1) {
        const square = document.createElement("button");
        square.type = "button";
        square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
        square.dataset.row = String(row);
        square.dataset.col = String(col);

        const piece = state.board[row][col];
        if (piece) square.textContent = PIECE_SYMBOLS[piece] || "";

        if (this.selected && this.selected.row === row && this.selected.col === col) {
          square.classList.add("selected");
        }

        const isValid = this.validMoves.find((move) => move.toRow === row && move.toCol === col);
        if (isValid) {
          square.classList.add(state.board[row][col] ? "capture-move" : "valid-move");
        }

        const { lastMove } = state;
        if (lastMove && ((lastMove.fromRow === row && lastMove.fromCol === col) || (lastMove.toRow === row && lastMove.toCol === col))) {
          square.classList.add("last-move");
        }

        square.addEventListener("click", () => this.handleSquareClick(row, col));
        this.boardEl.appendChild(square);
      }
    }
  }

  handleSquareClick(row, col) {
    if (this.botThinking) return;

    const state = this.game.getState();
    if (state.status === "checkmate" || state.status === "stalemate") return;
    if (state.turn !== "w") return;

    if (state.pendingPromotion) return;

    const clickedPiece = this.game.getPieceAt(row, col);

    if (this.selected) {
      const chosenMove = this.validMoves.find((move) => move.toRow === row && move.toCol === col);
      if (chosenMove) {
        const result = this.game.move(this.selected.row, this.selected.col, row, col);
        if (result.ok && result.needsPromotion) {
          this.askPromotion("w", (choice) => {
            this.game.promotePawn(row, col, choice);
            this.afterMove();
          });
          this.renderBoard();
          this.updateStatus();
          return;
        }

        this.selected = null;
        this.validMoves = [];
        this.afterMove();
        return;
      }
    }

    if (clickedPiece && clickedPiece[0] === "w") {
      this.selected = { row, col };
      this.validMoves = this.game.generateLegalMovesForSquare(row, col);
    } else {
      this.selected = null;
      this.validMoves = [];
    }

    this.renderBoard();
  }

  afterMove() {
    this.renderBoard();
    this.updateStatus();
    this.notifyHooks();
    this.handleStatePopup();

    const state = this.game.getState();
    if (state.turn === "b" && state.status !== "checkmate" && state.status !== "stalemate") {
      this.playBotMove();
    }
  }

  playBotMove() {
    this.botThinking = true;
    this.updateStatus("Bot is thinking...");

    window.setTimeout(() => {
      const move = chooseBotMove(this.game);
      if (move) {
        const result = this.game.move(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promotionChoice);
        if (result.ok && result.needsPromotion) {
          this.game.promotePawn(move.toRow, move.toCol, move.promotionChoice || "r");
        }
      }

      this.botThinking = false;
      this.selected = null;
      this.validMoves = [];

      this.renderBoard();
      this.updateStatus();
      this.notifyHooks();
      this.handleStatePopup();
    }, 450 + Math.random() * 500);
  }

  handleStatePopup() {
    const state = this.game.getState();

    if (state.status === "check") {
      this.showToast({
        title: "Check",
        message: `${state.turn === "w" ? "White" : "Black"} king is under attack!`,
      });
      return;
    }

    if (state.status === "checkmate") {
      this.showMessage(`Checkmate! ${state.winner === "w" ? "White" : "Black"} wins. Restart to play again.`);
      return;
    }

    if (state.status === "stalemate") {
      this.showMessage("Stalemate! No legal moves available. Restart to play again.");
    }
  }

  updateStatus(extra = "") {
    const state = this.game.getState();
    this.turnIndicator.textContent = `Turn: ${state.turn === "w" ? "White" : "Black"}`;

    const base = {
      playing: "Playing",
      check: "Check",
      checkmate: "Checkmate",
      stalemate: "Stalemate",
    }[state.status] || "Ready";

    this.statusEl.textContent = extra ? `Status: ${extra}` : `Status: ${base}`;
  }

  showMessage(message) {
    this.modalMessageEl.textContent = message;
    this.modalEl.classList.remove("hidden");
  }

  hideMessage() {
    this.modalEl.classList.add("hidden");
  }

  askPromotion(color, onSelect) {
    this.promotionOptions.innerHTML = "";
    const choices = ["r", "b", "n"];

    choices.forEach((type) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = PIECE_SYMBOLS[`${color}${type}`];
      btn.addEventListener("click", () => {
        this.promotionModal.classList.add("hidden");
        onSelect(type);
      });
      this.promotionOptions.appendChild(btn);
    });

    this.promotionModal.classList.remove("hidden");
  }

  showToast({ title, message }) {
    if (!this.toastStack) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <div class="toast__icon">🏆</div>
      <div>
        <p class="toast__title">${title}</p>
        <p class="toast__message">${message}</p>
      </div>
    `;

    this.toastStack.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("fade-out");
      window.setTimeout(() => toast.remove(), 250);
    }, 2100);
  }

  notifyHooks() {
    const state = this.game.getState();
    const score = this.game.evaluateMaterialScore();

    if (typeof window.onScoreUpdate === "function") {
      window.onScoreUpdate(score);
    }

    if ((state.status === "checkmate" || state.status === "stalemate") && typeof window.onGameEnd === "function") {
      window.onGameEnd({
        status: state.status,
        winner: state.winner,
      });
    }
  }
}

new MiniChessUI();
