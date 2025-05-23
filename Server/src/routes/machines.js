const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { run, get, all } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();

// Register/validate machine - This matches what your SubscriptionService.validateMachineLimit() expects
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { machineId, machineInfo } = req.body;

    if (!machineId) {
      return res.status(400).json({
        success: false,
        error: 'Machine ID is required'
      });
    }

    // Get user's subscription and machine limit
    const subscription = await get(`
      SELECT machine_limit, status 
      FROM subscriptions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    // Check if subscription is active
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    if (!isActive) {
      return res.status(403).json({
        success: false,
        error: 'Subscription is not active'
      });
    }

    // Check if machine is already registered
    const existingMachine = await get(
      'SELECT id, is_active FROM machines WHERE user_id = ? AND machine_id = ?',
      [userId, machineId]
    );

    if (existingMachine) {
      // Update existing machine
      await run(`
        UPDATE machines 
        SET 
          machine_name = ?,
          os_version = ?,
          cpu_info = ?,
          hostname = ?,
          last_seen = CURRENT_TIMESTAMP,
          is_active = 1
        WHERE id = ?
      `, [
        machineInfo?.name || null,
        machineInfo?.osVersion || null,
        machineInfo?.cpuInfo || null,
        machineInfo?.hostname || null,
        existingMachine.id
      ]);

      await logAction(userId, 'MACHINE_UPDATED', { 
        machineId,
        machineInfo 
      }, req.ip, req.get('User-Agent'));

      return res.json({
        success: true,
        message: 'Machine updated successfully',
        machine: {
          id: existingMachine.id,
          machineId,
          isActive: true
        }
      });
    }

    // Count active machines
    const activeMachineCount = await get(
      'SELECT COUNT(*) as count FROM machines WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    // Check machine limit
    if (activeMachineCount.count >= subscription.machine_limit) {
      return res.status(403).json({
        success: false,
        error: `Machine limit exceeded. Maximum ${subscription.machine_limit} machines allowed.`,
        machineLimit: subscription.machine_limit,
        currentCount: activeMachineCount.count
      });
    }

    // Register new machine
    const newMachineId = uuidv4();
    await run(`
      INSERT INTO machines 
      (id, user_id, machine_id, machine_name, os_version, cpu_info, hostname, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      newMachineId,
      userId,
      machineId,
      machineInfo?.name || null,
      machineInfo?.osVersion || null,
      machineInfo?.cpuInfo || null,
      machineInfo?.hostname || null
    ]);

    await logAction(userId, 'MACHINE_REGISTERED', { 
      machineId,
      machineInfo 
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Machine registered successfully',
      machine: {
        id: newMachineId,
        machineId,
        isActive: true
      }
    });

  } catch (error) {
    console.error('Machine registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Deregister machine
router.post('/deregister', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { machineId } = req.body;

    if (!machineId) {
      return res.status(400).json({
        success: false,
        error: 'Machine ID is required'
      });
    }

    const machine = await get(
      'SELECT id FROM machines WHERE user_id = ? AND machine_id = ?',
      [userId, machineId]
    );

    if (!machine) {
      return res.status(404).json({
        success: false,
        error: 'Machine not found'
      });
    }

    // Mark machine as inactive instead of deleting
    await run(
      'UPDATE machines SET is_active = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [machine.id]
    );

    await logAction(userId, 'MACHINE_DEREGISTERED', { machineId }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: 'Machine deregistered successfully'
    });

  } catch (error) {
    console.error('Machine deregistration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's machines - Changed to use query parameter instead of path parameter
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const machines = await all(`
      SELECT 
        id,
        machine_id,
        machine_name,
        os_version,
        cpu_info,
        hostname,
        last_seen,
        is_active,
        created_at
      FROM machines 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [userId]);

    // Get subscription info
    const subscription = await get(`
      SELECT machine_limit, status 
      FROM subscriptions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);

    const activeMachines = machines.filter(m => m.is_active);

    res.json({
      success: true,
      machines: machines.map(machine => ({
        id: machine.id,
        machineId: machine.machine_id,
        name: machine.machine_name,
        osVersion: machine.os_version,
        cpuInfo: machine.cpu_info,
        hostname: machine.hostname,
        lastSeen: machine.last_seen,
        isActive: machine.is_active,
        createdAt: machine.created_at
      })),
      summary: {
        total: machines.length,
        active: activeMachines.length,
        limit: subscription?.machine_limit || 2,
        remaining: Math.max(0, (subscription?.machine_limit || 2) - activeMachines.length)
      }
    });

  } catch (error) {
    console.error('Get machines error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Validate machine access (for license checks)
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { machineId } = req.body;

    if (!machineId) {
      return res.status(400).json({
        success: false,
        error: 'Machine ID is required'
      });
    }

    // Check if machine is registered and active
    const machine = await get(`
      SELECT 
        m.id,
        m.is_active,
        m.last_seen,
        s.status as subscription_status,
        s.current_period_end,
        s.machine_limit
      FROM machines m
      JOIN subscriptions s ON m.user_id = s.user_id
      WHERE m.user_id = ? AND m.machine_id = ?
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [userId, machineId]);

    if (!machine) {
      return res.status(404).json({
        success: false,
        error: 'Machine not registered',
        registered: false
      });
    }

    if (!machine.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Machine is deactivated',
        registered: true,
        active: false
      });
    }

    // Check subscription status
    const isSubscriptionActive = machine.subscription_status === 'active' || 
                                machine.subscription_status === 'trialing';
    
    const isExpired = machine.current_period_end && 
                     new Date(machine.current_period_end) < new Date();

    // Update last seen
    await run(
      'UPDATE machines SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [machine.id]
    );

    res.json({
      success: true,
      machine: {
        registered: true,
        active: machine.is_active,
        lastSeen: machine.last_seen
      },
      subscription: {
        status: machine.subscription_status,
        isActive: isSubscriptionActive,
        isExpired,
        currentPeriodEnd: machine.current_period_end,
        machineLimit: machine.machine_limit
      }
    });

  } catch (error) {
    console.error('Machine validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Clean up inactive machines (can be called periodically)
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // Deactivate machines that haven't been seen for more than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await run(`
      UPDATE machines 
      SET is_active = 0 
      WHERE user_id = ? AND last_seen < ? AND is_active = 1
    `, [userId, thirtyDaysAgo]);

    await logAction(userId, 'MACHINES_CLEANED_UP', { 
      deactivatedCount: result.changes 
    }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      message: `Cleaned up ${result.changes} inactive machines`,
      deactivatedCount: result.changes
    });

  } catch (error) {
    console.error('Machine cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router; 