const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

require('dotenv').config();


// Middleware
app.use(express.json());
app.use(cors({
  origin: '*'
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/casino')
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Serve static files (card images)
app.use('/cards', express.static(path.join(__dirname, 'data')));

// Import routes
const balloonRoutes = require('./routes/balloon.routes');
const balanceRoutes = require('./routes/balance.routes');
const cardgameRoutes = require('./routes/cardgame.routes');
const minesRoutes = require('./routes/mines.routes');
const clickerRoutes = require('./routes/clicker.routes');

// Use routes
app.use('/api/balloon', balloonRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/cardgame', cardgameRoutes);
app.use('/api/mines', minesRoutes);
app.use('/api/clicker', clickerRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);