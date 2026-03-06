import { PieceValues } from "./game.js";

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function getColor(piece) {
  return piece?.[0] ?? null;
}

function getType(piece) {
  return piece?.[1] ?? null;
}

function applyMoveToBoard(board, move, promotionChoice = null) {
  const simulation = cloneBoard(board);
  const moving = simulation[move.fromRow][move.fromCol];
  simulation[move.fromRow][move.fromCol] = null;
  simulation[move.toRow][move.toCol] = moving;

  if (moving?.[1] === "p" && move.toRow === 4) {
    simulation[move.toRow][move.toCol] = `b${promotionChoice ?? "r"}`;
  }

  return simulation;
}

function evaluateMove(game, move) {
  const state = game.getState();
  const target = state.board[move.toRow][move.toCol];
  const moving = state.board[move.fromRow][move.fromCol];
  const boardAfter = applyMoveToBoard(state.board, move, "r");

  let score = 0;

  if (target) {
    score += (PieceValues[getType(target)] ?? 0) * 8;
  }

  if (game.isInCheck("w", boardAfter)) {
    score += 3;
  }

  const enemyMoves = game.generateAllLegalMoves("w", boardAfter);
  const movedSquareAttacked = enemyMoves.some((m) => m.toRow === move.toRow && m.toCol === move.toCol);
  if (movedSquareAttacked) {
    score -= (PieceValues[getType(moving)] ?? 0) * 2;
  }

  const centerBonus = [
    [2, 1],
    [2, 2],
    [1, 1],
    [1, 2],
  ];
  if (centerBonus.some(([r, c]) => r === move.toRow && c === move.toCol)) {
    score += 0.5;
  }

  return score + Math.random() * 0.2;
}

export function chooseBotMove(game) {
  const legalMoves = game.generateAllLegalMoves("b");
  if (!legalMoves.length) return null;

  const scored = legalMoves
    .map((move) => ({
      move,
      score: evaluateMove(game, move),
    }))
    .sort((a, b) => b.score - a.score);

  const { advantage } = game.evaluateMaterialScore();
  // Player advantage > 0 means white is ahead. Bot should respond by playing better.
  const goodMoveProbability = Math.max(0.25, Math.min(0.9, 0.6 + advantage * 0.08));

  const chooseGoodMove = Math.random() < goodMoveProbability;

  if (chooseGoodMove) {
    return {
      ...scored[0].move,
      promotionChoice: "r",
    };
  }

  const weakerPool = scored.slice(Math.floor(scored.length * 0.45));
  const fallbackPool = weakerPool.length ? weakerPool : scored;
  const randomChoice = fallbackPool[Math.floor(Math.random() * fallbackPool.length)].move;

  return {
    ...randomChoice,
    promotionChoice: "n",
  };
}
