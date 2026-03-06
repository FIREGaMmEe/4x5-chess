const BOARD_ROWS = 5;
const BOARD_COLS = 4;

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  k: 100,
};

const START_POSITION = [
  ["br", "bn", "bb", "bk"],
  ["bp", "bp", "bp", "bp"],
  [null, null, null, null],
  ["wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wk"],
];

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

function getColor(piece) {
  return piece ? piece[0] : null;
}

function getType(piece) {
  return piece ? piece[1] : null;
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

export class MiniChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = cloneBoard(START_POSITION);
    this.turn = "w";
    this.status = "playing";
    this.winner = null;
    this.lastMove = null;
    this.pendingPromotion = null;
  }

  getState() {
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      lastMove: this.lastMove,
      pendingPromotion: this.pendingPromotion,
    };
  }

  getPieceAt(row, col) {
    return this.board[row][col];
  }

  generateLegalMovesForSquare(row, col) {
    const piece = this.getPieceAt(row, col);
    if (!piece || getColor(piece) !== this.turn) return [];
    const pseudo = this.generatePseudoMoves(row, col, this.board);
    return pseudo.filter((move) => this.isMoveLegal(move));
  }

  generateAllLegalMoves(color = this.turn, board = this.board) {
    const moves = [];
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        const piece = board[r][c];
        if (!piece || getColor(piece) !== color) continue;
        const pseudo = this.generatePseudoMoves(r, c, board);
        for (const move of pseudo) {
          if (this.isMoveLegal(move, board, color)) moves.push(move);
        }
      }
    }
    return moves;
  }

  move(fromRow, fromCol, toRow, toCol, promotionChoice = null) {
    if (this.status !== "playing") return { ok: false, reason: "Game is over." };

    const legalMoves = this.generateLegalMovesForSquare(fromRow, fromCol);
    const move = legalMoves.find((candidate) => candidate.toRow === toRow && candidate.toCol === toCol);
    if (!move) return { ok: false, reason: "Illegal move." };

    this.applyMove(move);

    const movedPiece = this.board[toRow][toCol];
    const needsPromotion = getType(movedPiece) === "p" && (toRow === 0 || toRow === BOARD_ROWS - 1);

    if (needsPromotion) {
      if (promotionChoice) {
        this.promotePawn(toRow, toCol, promotionChoice);
      } else {
        this.pendingPromotion = { row: toRow, col: toCol, color: getColor(movedPiece) };
        return { ok: true, needsPromotion: true };
      }
    }

    this.completeTurn();
    return { ok: true, move };
  }

  promotePawn(row, col, choice) {
    const validChoices = ["r", "b", "n"];
    if (!validChoices.includes(choice)) return false;
    const piece = this.board[row][col];
    if (!piece || getType(piece) !== "p") return false;
    this.board[row][col] = `${getColor(piece)}${choice}`;
    this.pendingPromotion = null;
    this.completeTurn();
    return true;
  }

  applyMove(move) {
    const piece = this.board[move.fromRow][move.fromCol];
    this.board[move.fromRow][move.fromCol] = null;
    this.board[move.toRow][move.toCol] = piece;
    this.lastMove = move;
  }

  completeTurn() {
    this.turn = opposite(this.turn);
    const currentInCheck = this.isInCheck(this.turn);
    const legalMoves = this.generateAllLegalMoves(this.turn);

    if (legalMoves.length === 0) {
      if (currentInCheck) {
        this.status = "checkmate";
        this.winner = opposite(this.turn);
      } else {
        this.status = "stalemate";
        this.winner = null;
      }
      return;
    }

    if (currentInCheck) {
      this.status = "check";
    } else {
      this.status = "playing";
    }
  }

  isMoveLegal(move, board = this.board, color = this.turn) {
    const simulation = cloneBoard(board);
    const piece = simulation[move.fromRow][move.fromCol];
    if (!piece || getColor(piece) !== color) return false;

    simulation[move.fromRow][move.fromCol] = null;
    simulation[move.toRow][move.toCol] = piece;

    return !this.isInCheck(color, simulation);
  }

  isInCheck(color, board = this.board) {
    let kingPosition = null;

    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        const piece = board[r][c];
        if (piece === `${color}k`) {
          kingPosition = { row: r, col: c };
          break;
        }
      }
      if (kingPosition) break;
    }

    if (!kingPosition) return true;

    const enemy = opposite(color);
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        const piece = board[r][c];
        if (!piece || getColor(piece) !== enemy) continue;
        const attacks = this.generatePseudoMoves(r, c, board, true);
        if (attacks.some((move) => move.toRow === kingPosition.row && move.toCol === kingPosition.col)) {
          return true;
        }
      }
    }
    return false;
  }

  generatePseudoMoves(row, col, board = this.board, forAttackMap = false) {
    const piece = board[row][col];
    if (!piece) return [];

    const color = getColor(piece);
    const type = getType(piece);

    switch (type) {
      case "p":
        return this.generatePawnMoves(row, col, color, board, forAttackMap);
      case "r":
        return this.generateSlidingMoves(row, col, color, board, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
      case "b":
        return this.generateSlidingMoves(row, col, color, board, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
      case "n":
        return this.generateKnightMoves(row, col, color, board);
      case "k":
        return this.generateKingMoves(row, col, color, board);
      default:
        return [];
    }
  }

  generatePawnMoves(row, col, color, board, forAttackMap) {
    const dir = color === "w" ? -1 : 1;
    const moves = [];
    const forwardRow = row + dir;

    if (!forAttackMap && inBounds(forwardRow, col) && !board[forwardRow][col]) {
      moves.push({ fromRow: row, fromCol: col, toRow: forwardRow, toCol: col });
    }

    for (const dc of [-1, 1]) {
      const nr = row + dir;
      const nc = col + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (forAttackMap) {
        moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
      } else if (target && getColor(target) !== color) {
        moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
      }
    }

    return moves;
  }

  generateSlidingMoves(row, col, color, board, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
        } else {
          if (getColor(target) !== color) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  generateKnightMoves(row, col, color, board) {
    const deltas = [
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [1, -2],
      [-1, 2],
      [-1, -2],
    ];

    return deltas
      .map(([dr, dc]) => ({ nr: row + dr, nc: col + dc }))
      .filter(({ nr, nc }) => inBounds(nr, nc))
      .filter(({ nr, nc }) => !board[nr][nc] || getColor(board[nr][nc]) !== color)
      .map(({ nr, nc }) => ({ fromRow: row, fromCol: col, toRow: nr, toCol: nc }));
  }

  generateKingMoves(row, col, color, board) {
    const moves = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (!target || getColor(target) !== color) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc });
        }
      }
    }
    return moves;
  }

  evaluateMaterialScore() {
    let white = 0;
    let black = 0;

    for (const row of this.board) {
      for (const piece of row) {
        if (!piece) continue;
        const val = PIECE_VALUES[getType(piece)] ?? 0;
        if (getColor(piece) === "w") white += val;
        else black += val;
      }
    }

    return { white, black, advantage: white - black };
  }
}

export const PieceValues = PIECE_VALUES;
export const BoardShape = { rows: BOARD_ROWS, cols: BOARD_COLS };
