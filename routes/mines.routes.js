const express = require('express');
const router = express.Router();
const { games, getUserById, updateUserBalance } = require('../models/users');

// Start a new mines game
router.post('/start', async (req, res) => {
  try {
    const { userId, betAmount, mineNum } = req.body;
    
    if (!userId || !betAmount || !mineNum) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.balance < betAmount) return res.status(400).json({ error: 'Insufficient balance' });
    
    // 1. DEDUCT BET (Round to 2 decimals)
    const newBalance = Math.round((user.balance - betAmount) * 100) / 100;
    await updateUserBalance(userId, newBalance);
    
    const minePositions = new Set();
    while (minePositions.size < mineNum) {
      const pos = Math.floor(Math.random() * 25) + 1;
      minePositions.add(pos);
    }
    
    const sessionId = Date.now().toString() + Math.random().toString(36);
    games[sessionId] = {
      userId,
      betAmount: Number(betAmount),
      mineNum: Number(mineNum),
      minePositions: Array.from(minePositions),
      revealedCells: [],
      safeCellsRevealed: 0,
      currentMultiplier: 1.0,
      active: true,
      gameType: 'mines'
    };
    
    res.json({
      sessionId,
      currentMultiplier: 1.0,
      newBalance: Number(newBalance.toFixed(2)) // Ensure 2 decimals
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Reveal a cell (The "Reveal" Logic)
router.post('/reveal', (req, res) => {
  const { sessionId, cellId } = req.body;
  const game = games[sessionId];
  
  if (!game || !game.active) return res.status(400).json({ error: 'Invalid session' });
  
  const isMine = game.minePositions.includes(Number(cellId));
  
  if (isMine) {
    game.active = false;
    res.json({ isMine: true, gameOver: true, minePositions: game.minePositions, potentialWinnings: 0 });
  } else {
    // 1. Increment FIRST
    game.safeCellsRevealed++; 
    game.revealedCells.push(cellId);
    
    // 2. Calculate multiplier based on the NEW count
    const totalCells = 25;
    const safeCells = totalCells - game.mineNum;
    
    // Logic: The more safe cells are GONE, the higher the risk for the NEXT click
    const baseMultiplier = totalCells / (safeCells - game.safeCellsRevealed + 1);
    
    // Round to 2 decimals
    game.currentMultiplier = Math.round(Math.pow(baseMultiplier, 0.95) * 100) / 100;
    
    // Calculate winnings based on the NEW multiplier
    const potentialWinnings = Math.round(game.betAmount * game.currentMultiplier * 100) / 100;
    
    res.json({
      isMine: false,
      currentMultiplier: game.currentMultiplier,
      potentialWinnings: potentialWinnings, // Send the fresh value
      safeCellsRevealed: game.safeCellsRevealed
    });
}
});

// Cashout
router.post('/cashout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const game = games[sessionId];
    
    if (!game || !game.active) return res.status(400).json({ error: 'Invalid session' });
    
    // 3. FINAL WINNINGS (2 decimals)
    const winnings = Math.round(game.betAmount * game.currentMultiplier * 100) / 100;
    
    const user = await getUserById(game.userId);
    const newBalance = Math.round((user.balance + winnings) * 100) / 100;
    await updateUserBalance(game.userId, newBalance);
    
    game.active = false;
    
    res.json({
      success: true,
      winnings: Number(winnings.toFixed(2)),
      minePositions: game.minePositions,
      newBalance: Number(newBalance.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cashout' });
  }
});

module.exports = router;