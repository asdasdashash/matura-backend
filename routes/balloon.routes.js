const express = require('express');
const router = express.Router();
const { games, getUserById, updateUserBalance } = require('../models/users');

// Start a new balloon game
router.post('/start', async (req, res) => {
  try {
    const { userId, betAmount, multiplier } = req.body;
    
    // Validation
    if (!userId || !betAmount || !multiplier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (multiplier < 1.1 || multiplier > 2) {
      return res.status(400).json({ error: 'Multiplier must be between 1.1 and 2.0' });
    }
    
    if (betAmount <= 0) {
      return res.status(400).json({ error: 'Bet amount must be positive' });
    }
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct bet from balance
    const newBalance = user.balance - betAmount;
    await updateUserBalance(userId, newBalance);
    
    // Create game session
    const sessionId = Date.now().toString() + Math.random().toString(36);
    games[sessionId] = {
      userId,
      betAmount,
      multiplier,
      currentMultiplier: 1,
      potentialWinnings: betAmount,
      active: true,
      gameType: 'balloon'
    };
    
    res.json({
      sessionId,
      currentMultiplier: 1,
      potentialWinnings: betAmount,
      newBalance
    });
  } catch (error) {
    console.error('Error starting balloon game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Pump the balloon
router.post('/pump', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !games[sessionId]) {
    return res.status(400).json({ error: 'Invalid session' });
  }
  
  const game = games[sessionId];
  
  if (!game.active) {
    return res.status(400).json({ error: 'Game is not active' });
  }
  
  // Server-side probability calculation
  const winProbability = 1 / game.multiplier;
  const randomValue = Math.random();
  
  console.log('Balloon pump - Win probability:', winProbability, 'Random:', randomValue);
  
  if (randomValue < winProbability) {
    // Player survives this pump
    game.currentMultiplier *= game.multiplier;
    game.potentialWinnings = Math.round(game.betAmount * game.currentMultiplier * 100) / 100;
    
    res.json({
      success: true,
      popped: false,
      currentMultiplier: game.currentMultiplier,
      potentialWinnings: game.potentialWinnings
    });
  } else {
    // Balloon popped - player loses
    game.active = false;
    
    res.json({
      success: true,
      popped: true,
      currentMultiplier: game.currentMultiplier,
      potentialWinnings: 0
    });
  }
});

// Cashout
router.post('/cashout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !games[sessionId]) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    const game = games[sessionId];
    
    if (!game.active) {
      return res.status(400).json({ error: 'Game is not active' });
    }
    
    if (game.currentMultiplier <= 1) {
      return res.status(400).json({ error: 'Cannot cashout at base multiplier' });
    }
    
    // Add winnings to balance
    const user = await getUserById(game.userId);
    const newBalance = user.balance + game.potentialWinnings;
    await updateUserBalance(game.userId, newBalance);
    
    game.active = false;
    
    res.json({
      success: true,
      winnings: game.potentialWinnings,
      newBalance
    });
  } catch (error) {
    console.error('Error cashing out:', error);
    res.status(500).json({ error: 'Failed to cashout' });
  }
});

module.exports = router;