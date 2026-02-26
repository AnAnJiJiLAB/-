/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, Bomb, RefreshCw, Timer, Trophy, Settings2, ShieldAlert, Zap, Target } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Types ---

type Difficulty = 'easy' | 'medium' | 'hard';

interface GameSettings {
  rows: number;
  cols: number;
  mines: number;
}

const SETTINGS: Record<Difficulty, GameSettings> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

type GameStatus = 'playing' | 'won' | 'lost' | 'ready';

// --- Components ---

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [status, setStatus] = useState<GameStatus>('ready');
  const [mineCount, setMineCount] = useState(SETTINGS.easy.mines);
  const [time, setTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize board
  const initBoard = useCallback((diff: Difficulty = difficulty) => {
    const { rows, cols, mines } = SETTINGS[diff];
    const newGrid: Cell[][] = [];

    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        });
      }
      newGrid.push(row);
    }

    setGrid(newGrid);
    setStatus('ready');
    setMineCount(mines);
    setTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    initBoard();
  }, [initBoard]);

  // Timer logic
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Place mines (after first click to ensure safety)
  const placeMines = (initialGrid: Cell[][], firstRow: number, firstCol: number) => {
    const { rows, cols, mines } = SETTINGS[difficulty];
    const newGrid = [...initialGrid.map(r => [...r])];
    let minesPlaced = 0;

    while (minesPlaced < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      if (
        (Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1) ||
        newGrid[r][c].isMine
      ) {
        continue;
      }

      newGrid[r][c].isMine = true;
      minesPlaced++;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (newGrid[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].isMine) {
              count++;
            }
          }
        }
        newGrid[r][c].neighborMines = count;
      }
    }

    return newGrid;
  };

  const revealCell = (r: number, c: number) => {
    if (status === 'lost' || status === 'won' || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    let currentGrid = [...grid.map(row => [...row])];
    
    if (status === 'ready') {
      currentGrid = placeMines(currentGrid, r, c);
      setStatus('playing');
    }

    const revealRecursive = (row: number, col: number, visited: Set<string>) => {
      const key = `${row},${col}`;
      if (
        row < 0 || row >= SETTINGS[difficulty].rows ||
        col < 0 || col >= SETTINGS[difficulty].cols ||
        currentGrid[row][col].isRevealed ||
        currentGrid[row][col].isFlagged ||
        visited.has(key)
      ) return;

      visited.add(key);
      currentGrid[row][col].isRevealed = true;

      if (currentGrid[row][col].neighborMines === 0 && !currentGrid[row][col].isMine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            revealRecursive(row + dr, col + dc, visited);
          }
        }
      }
    };

    if (currentGrid[r][c].isMine) {
      currentGrid.forEach(row => row.forEach(cell => {
        if (cell.isMine) cell.isRevealed = true;
      }));
      setStatus('lost');
      setGrid(currentGrid);
      return;
    }

    revealRecursive(r, c, new Set());
    setGrid(currentGrid);

    const { rows, cols, mines } = SETTINGS[difficulty];
    let revealedCount = 0;
    currentGrid.forEach(row => row.forEach(cell => {
      if (cell.isRevealed) revealedCount++;
    }));

    if (revealedCount === rows * cols - mines) {
      setStatus('won');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#ffffff', '#333333']
      });
    }
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === 'lost' || status === 'won' || grid[r][c].isRevealed) return;

    const newGrid = [...grid.map(row => [...row])];
    const cell = newGrid[r][c];
    cell.isFlagged = !cell.isFlagged;
    setGrid(newGrid);
    setMineCount(prev => cell.isFlagged ? prev - 1 : prev + 1);
  };

  const getNumberColor = (num: number) => {
    const colors = [
      '',
      'text-red-500',
      'text-red-400',
      'text-red-300',
      'text-zinc-400',
      'text-zinc-500',
      'text-zinc-600',
      'text-zinc-700',
      'text-zinc-800',
    ];
    return colors[num] || 'text-red-500';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 scanline relative">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-2xl mb-12 flex flex-col items-start border-l-4 border-red-600 pl-6"
      >
        <div className="flex items-center gap-4 mb-2">
          <Zap className="text-red-600 fill-red-600" size={32} />
          <h1 className="text-5xl font-black tracking-tighter text-white italic uppercase">
            ROG <span className="text-red-600">Minesweeper</span>
          </h1>
        </div>
        <p className="text-zinc-500 font-bold tracking-[0.2em] text-xs uppercase">Republic of Gamers // Tactical Unit</p>
      </motion.div>

      {/* Game Container */}
      <div className="rog-border glow-red">
        <motion.div 
          layout
          className="rog-container p-6 md:p-10 relative overflow-hidden"
        >
          {/* Stats Bar */}
          <div className="flex items-center justify-between mb-10 gap-8">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-red-600 mb-2">Threats</span>
                <div className="flex items-center gap-3 text-3xl font-mono font-black text-white bg-black/50 px-4 py-2 border-b-2 border-red-600/50">
                  <ShieldAlert size={24} className="text-red-600" />
                  {String(mineCount).padStart(3, '0')}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-red-600 mb-2">Uptime</span>
                <div className="flex items-center gap-3 text-3xl font-mono font-black text-white bg-black/50 px-4 py-2 border-b-2 border-red-600/50">
                  <Timer size={24} className="text-red-600" />
                  {String(time).padStart(3, '0')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-4 transition-all border border-zinc-800 hover:border-red-600 hover:text-red-600 ${showSettings ? 'bg-red-600 text-white border-red-600' : 'bg-zinc-900 text-zinc-400'}`}
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                <Settings2 size={24} />
              </button>
              <button
                onClick={() => initBoard()}
                className="p-4 bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                <RefreshCw size={24} className={status === 'playing' ? 'animate-spin-slow' : ''} />
              </button>
            </div>
          </div>

          {/* Settings Dropdown */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-8"
              >
                <div className="grid grid-cols-3 gap-4 p-2 bg-black/50 border border-zinc-800">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDifficulty(d);
                        setShowSettings(false);
                      }}
                      className={`py-3 px-4 text-xs font-black uppercase tracking-widest transition-all italic ${
                        difficulty === d 
                          ? 'bg-red-600 text-white' 
                          : 'text-zinc-500 hover:text-red-500'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div 
            className="minesweeper-grid gap-2"
            style={{ 
              gridTemplateColumns: `repeat(${SETTINGS[difficulty].cols}, minmax(0, 1fr))`,
              width: difficulty === 'hard' ? 'min(90vw, 900px)' : 'min(90vw, 500px)'
            }}
          >
            {grid.map((row, r) => (
              row.map((cell, c) => (
                <motion.div
                  key={`${r}-${c}`}
                  whileHover={!cell.isRevealed ? { scale: 1.08, zIndex: 10, filter: 'brightness(1.2)' } : {}}
                  whileTap={!cell.isRevealed ? { scale: 0.92 } : {}}
                  onClick={() => revealCell(r, c)}
                  onContextMenu={(e) => toggleFlag(e, r, c)}
                  className={`
                    cell rog-cell flex items-center justify-center cursor-pointer text-lg font-black transition-all duration-150
                    ${cell.isRevealed 
                      ? (cell.isMine ? 'bg-red-600 text-white glow-red' : 'bg-zinc-800/50 border border-zinc-700/50') 
                      : 'bg-zinc-900 border border-zinc-800 hover:border-red-600/50 shadow-[inset_0_0_10px_rgba(255,0,0,0.05)]'}
                  `}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? (
                      <Bomb size={20} className="animate-pulse" />
                    ) : (
                      cell.neighborMines > 0 && (
                        <span className={`${getNumberColor(cell.neighborMines)} text-glow-red italic`}>
                          {cell.neighborMines}
                        </span>
                      )
                    )
                  ) : (
                    cell.isFlagged && <Target size={18} className="text-red-600 drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]" />
                  )}
                </motion.div>
              ))
            ))}
          </div>

          {/* Status Overlay */}
          <AnimatePresence>
            {(status === 'won' || status === 'lost') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-10 p-8 flex flex-col items-center text-center bg-black/80 border-t-2 border-red-600 backdrop-blur-md"
              >
                {status === 'won' ? (
                  <>
                    <div className="w-20 h-20 bg-red-600 text-white rounded-none flex items-center justify-center mb-6 glow-red rotate-45">
                      <Trophy size={40} className="-rotate-45" />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">Mission Accomplished</h2>
                    <p className="text-zinc-400 mb-8 font-bold tracking-widest text-xs uppercase">Target Neutralized // Area Secured</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-zinc-900 border-2 border-red-600 text-red-600 rounded-none flex items-center justify-center mb-6 glow-red rotate-45">
                      <Bomb size={40} className="-rotate-45" />
                    </div>
                    <h2 className="text-4xl font-black text-red-600 mb-2 uppercase italic tracking-tighter">System Failure</h2>
                    <p className="text-zinc-400 mb-8 font-bold tracking-widest text-xs uppercase">Critical Damage // Unit Lost</p>
                  </>
                )}
                <button
                  onClick={() => initBoard()}
                  className="w-full py-4 px-8 bg-red-600 text-white font-black uppercase italic tracking-[0.2em] hover:bg-red-700 transition-all shadow-lg shadow-red-600/40 flex items-center justify-center gap-3"
                  style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                >
                  <RefreshCw size={24} />
                  Re-Engage
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] flex gap-8">
        <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-600 rotate-45"></span> LMB: Reveal</span>
        <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-600 rotate-45"></span> RMB: Target</span>
      </div>
    </div>
  );
}
