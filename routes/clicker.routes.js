const express = require('express');
const router = express.Router();
const { getUserById, updateUserBalance } = require('../models/users');

// Track click sessions to prevent cheating
const clickSessions = {};

// Track IPs to prevent abuse
const ipClickTracker = {};

// Middleware to block automated requests
router.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Block curl, wget, and other automation tools
  const blockedAgents = ['curl', 'wget', 'python', 'postman', 'insomnia', 'httpie'];
  const isBlocked = blockedAgents.some(agent => 
    userAgent.toLowerCase().includes(agent.toLowerCase())
  );
  
  if (isBlocked) {
    return res.status(403).json({ error: 'Automated requests are not allowed' });
  }
  
  // Must have a browser-like user agent
  if (!userAgent.includes('Mozilla') && !userAgent.includes('Chrome')) {
    return res.status(403).json({ error: 'Invalid client' });
  }
  
  next();
});

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
    const ip = req.ip || req.connection.remoteAddress;
    
    clickSessions[sessionId] = {
      userId,
      clicks: 0,
      startTime: Date.now(),
      lastClickTime: 0,
      active: true,
      ip: ip
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
    const ip = req.ip || req.connection.remoteAddress;
    
    // Verify IP matches session
    if (session.ip !== ip) {
      return res.status(403).json({ error: 'IP mismatch detected' });
    }
    
    if (!session.active) {
      return res.status(400).json({ error: 'Session is not active' });
    }

    const now = Date.now();

    // ANTI-CHEAT 1: Minimum 400ms between clicks
    if (session.lastClickTime && (now - session.lastClickTime) < 400) {
      return res.status(429).json({ error: 'Clicking too fast! Slow down.' });
    }

    // ANTI-CHEAT 2: Max 100 clicks per session
    if (session.clicks >= 100) {
      session.active = false;
      return res.status(400).json({ 
        error: 'Maximum clicks reached! Cash out your earnings.',
        totalClicks: session.clicks,
        totalEarned: session.clicks * 50
      });
    }

    // ANTI-CHEAT 3: Session expires after 2 minutes
    if (now - session.startTime > 2 * 60 * 1000) {
      session.active = false;
      return res.status(400).json({ 
        error: 'Session expired. Please cash out.',
        totalClicks: session.clicks,
        totalEarned: session.clicks * 50
      });
    }

    // ANTI-CHEAT 4: IP-based rate limiting (max 150 clicks per minute globally)
    if (!ipClickTracker[ip]) {
      ipClickTracker[ip] = { clicks: 0, resetTime: now + 60000 };
    }
    
    if (now > ipClickTracker[ip].resetTime) {
      ipClickTracker[ip] = { clicks: 0, resetTime: now + 60000 };
    }
    
    ipClickTracker[ip].clicks++;
    
    if (ipClickTracker[ip].clicks > 150) {
      return res.status(429).json({ error: 'Too many clicks from this IP. Wait a minute.' });
    }

    session.clicks++;
    session.lastClickTime = now;

    // Each click gives 50 coins
    const earnedAmount = 50;

    res.json({
      success: true,
      earnedAmount,
      totalClicks: session.clicks,
      totalEarned: session.clicks * 50
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
    const ip = req.ip || req.connection.remoteAddress;
    
    // Verify IP matches
    if (session.ip !== ip) {
      return res.status(403).json({ error: 'IP mismatch detected' });
    }
    
    const totalEarned = session.clicks * 50;

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