const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    await run(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [userId, email.toLowerCase(), passwordHash, name || null]
    );

    // Create default subscription (inactive)
    const subscriptionId = uuidv4();
    await run(
      `INSERT INTO subscriptions (id, user_id, status, plan_id, plan_name, machine_limit) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subscriptionId, userId, 'inactive', 'trial', 'Trial', 2]
    );

    // Log action
    await logAction(userId, 'USER_REGISTERED', { email }, req.ip, req.get('User-Agent'));

    // Generate JWT token
    const token = jwt.sign(
      { userId, email: email.toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Get user with subscription info
    const userWithSubscription = await getUserWithSubscription(userId);

    res.status(201).json({
      success: true,
      user: userWithSubscription,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Login user - This matches what your AuthService.authenticate() expects
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await get(
      'SELECT id, email, password_hash, name FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Log action
    await logAction(user.id, 'USER_LOGIN', { email }, req.ip, req.get('User-Agent'));

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Get user with subscription info
    const userWithSubscription = await getUserWithSubscription(user.id);

    res.json({
      success: true,
      user: userWithSubscription,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Validate token - This matches what your AuthService.validateCachedAuth() expects
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Get user with subscription info
    const userWithSubscription = await getUserWithSubscription(userId);

    if (!userWithSubscription) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: userWithSubscription
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Logout user (invalidate token - for future token blacklisting)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Log action
    await logAction(userId, 'USER_LOGOUT', {}, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Helper function to get user with subscription info
async function getUserWithSubscription(userId) {
  const query = `
    SELECT 
      u.id,
      u.email,
      u.name,
      s.status as subscription_status,
      s.current_period_end,
      s.cancel_at_period_end,
      s.plan_id,
      s.plan_name,
      s.machine_limit
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    WHERE u.id = ?
  `;

  const result = await get(query, [userId]);
  if (!result) return null;

  return {
    id: result.id,
    email: result.email,
    name: result.name,
    subscription: {
      status: result.subscription_status || 'inactive',
      currentPeriodEnd: result.current_period_end,
      cancelAtPeriodEnd: result.cancel_at_period_end || false,
      planId: result.plan_id || 'trial',
      planName: result.plan_name || 'Trial'
    },
    machineLimit: result.machine_limit || 2
  };
}

module.exports = router; 