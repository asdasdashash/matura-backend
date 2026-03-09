const express = require('express');
const router = express.Router();
const { games, getUserById, updateUserBalance } = require('../models/users');
const cardsData = require('../data/cardsData.json');

// Start a new card game
router.post('/start', async (req, res) => {
  try {
    const { userId, betAmount } = req.body;
    
    if (!userId || !betAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    
    // Shuffle and select 6 random cards
    const shuffled = [...cardsData.cards].sort(() => Math.random() - 0.5);
    const drawnCards = shuffled.slice(0, 6);
    
    // Add 50% chance for golden cards (FOR TESTING)
    const cardsWithGolden = drawnCards.map(card => ({
      ...card,
      isGolden: Math.random() < 0.05  // 50% chance for testing
    }));
    
    // Create game session
    const sessionId = Date.now().toString() + Math.random().toString(36);
    games[sessionId] = {
      userId,
      betAmount,
      drawnCards: cardsWithGolden,
      active: true,
      gameType: 'cardgame'
    };
    
    // Return hidden cards
    const hiddenCards = cardsWithGolden.map((card, index) => ({
      id: index,
      clicked: false,
      imagePath: null,
      isGolden: false  // Hide golden status until reveal
    }));
    
    res.json({
      sessionId,
      cards: hiddenCards,
      newBalance
    });
  } catch (error) {
    console.error('Error starting card game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Reveal cards
router.post('/reveal', async (req, res) => {
  try {
    const { sessionId, selectedIndices } = req.body;
    
    if (!sessionId || !games[sessionId]) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    if (!selectedIndices || selectedIndices.length !== 3) {
      return res.status(400).json({ error: 'Must select exactly 3 cards' });
    }
    
    const game = games[sessionId];
    
    if (!game.active) {
      return res.status(400).json({ error: 'Game is not active' });
    }
    
    // Calculate values with golden multiplier
    let plCardValue = 0;
    let opCardValue = 0;
    
    game.drawnCards.forEach((card, index) => {
      const cardValue = card.isGolden ? card.cardValue * 2 : card.cardValue;
      
      if (selectedIndices.includes(index)) {
        plCardValue += cardValue;
      } else {
        opCardValue += cardValue;
      }
    });
    
    // Determine winner
    let gameResult = '';
    let winAmount = 0;
    
    if (plCardValue > opCardValue) {
      gameResult = 'Won';
      winAmount = game.betAmount * 2;
    } else if (opCardValue > plCardValue) {
      gameResult = 'Lost';
      winAmount = 0;
    } else {
      gameResult = 'Draw';
      winAmount = game.betAmount;
    }
    
    // Update balance
    const user = await getUserById(game.userId);
    const newBalance = user.balance + winAmount;
    await updateUserBalance(game.userId, newBalance);
    
    game.active = false;
    
    // Reveal cards with golden status and correct image path
    const revealedCards = game.drawnCards.map(card => ({
      ...card,
      imagePath: card.isGolden ? card.goldenImagePath : card.imagePath
    }));
    
    res.json({
      gameResult,
      winAmount,
      plCardValue,
      opCardValue,
      cards: revealedCards,
      newBalance
    });
  } catch (error) {
    console.error('Error revealing cards:', error);
    res.status(500).json({ error: 'Failed to reveal cards' });
  }
});

module.exports = router;