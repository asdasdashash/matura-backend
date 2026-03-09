const User = require('./User');

const games = {}; // Keep games in memory for now

// Helper function to get user by ID
async function getUserById(userId) {
  return await User.findById(userId);
}

// Helper function to update user balance
async function updateUserBalance(userId, newBalance) {
  await User.findByIdAndUpdate(userId, { balance: newBalance });
}

module.exports = {
  games,
  getUserById,
  updateUserBalance,
  User
};