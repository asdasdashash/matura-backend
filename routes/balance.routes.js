const express = require('express');
const router = express.Router();
const { getUserById, updateUserBalance } = require('../models/users');

// Get user balance

router.get('/leaderboard', async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get top 3 users sorted by balance
    const topUsers = await User.find()
      .sort({ balance: -1 })
      .limit(3)
      .select('username balance');
    
    res.json({ leaderboard: topUsers });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ balance: user.balance });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Update balance
router.post('/update', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await updateUserBalance(userId, amount);
    const user = await getUserById(userId);
    
    res.json({ 
      success: true,
      balance: user.balance 
    });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Get top 3 richest users


module.exports = router;