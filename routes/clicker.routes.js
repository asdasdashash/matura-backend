const express = require('express');
const router = express.Router();
const { getUserById, updateUserBalance } = require('../models/users');

// Track click sessions to prevent cheating
const clickSessions = {};

// Start clicking session
router.post('/start', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const sessionId = Date.now().toString() + Math.random().toString(36);
    clickSessions[sessionId] = {
      userId,
      clicks: 0,
      startTime: Date.now(),
      lastClickTime: Date.now()
    };
    
    res.json({
      sessionId,
      currentBalance: user.balance
    });
  } catch (error) {
    console.error('Error starting click session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Register a click
router.post('/click', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !clickSessions[sessionId]) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    const session = clickSessions[sessionId];
    const now = Date.now();
    
    // Anti-cheat: prevent too fast clicking (must be at least 50ms between clicks)
    if (now - session.lastClickTime < 500) {
      return res.status(400).json({ error: 'Clicking too fast!' });
    }
    
    // Anti-cheat: session expires after 5 minutes
    if (now - session.startTime > 5 * 60 * 1000) {
      delete clickSessions[sessionId];
      return res.status(400).json({ error: 'Session expired' });
    }
    
    session.clicks++;
    session.lastClickTime = now;
    
    // Each click gives 1 coin
    const earnedAmount = 50;
    
    res.json({
      success: true,
      earnedAmount,
      totalClicks: session.clicks
    });
  } catch (error) {
    console.error('Error registering click:', error);
    res.status(500).json({ error: 'Failed to register click' });
  }
});

// Cash out earnings
router.post('/cashout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !clickSessions[sessionId]) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    const session = clickSessions[sessionId];
    const totalEarned = session.clicks*50; // 1 coin per click
    
    // Add to user balance
    const user = await getUserById(session.userId);
    const newBalance = user.balance + totalEarned;
    await updateUserBalance(session.userId, newBalance);
    
    // Clean up session
    delete clickSessions[sessionId];
    
    res.json({
      success: true,
      earnedAmount: totalEarned,
      newBalance
    });
  } catch (error) {
    console.error('Error cashing out:', error);
    res.status(500).json({ error: 'Failed to cashout' });
  }
});

module.exports = router;