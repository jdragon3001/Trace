const { run } = require('../database');

// Log user actions for audit trail
async function logAction(userId, action, details = {}, ipAddress = null, userAgent = null) {
  try {
    await run(`
      INSERT INTO audit_log (user_id, action, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      JSON.stringify(details),
      ipAddress,
      userAgent
    ]);
  } catch (error) {
    console.error('Failed to log action:', error);
    // Don't throw error to avoid breaking the main flow
  }
}

// Middleware to automatically log API requests
function auditMiddleware(action) {
  return async (req, res, next) => {
    // Store original res.json to intercept the response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the action after successful response
      if (req.user && res.statusCode < 400) {
        logAction(
          req.user.userId,
          action,
          {
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query,
            statusCode: res.statusCode
          },
          req.ip,
          req.get('User-Agent')
        ).catch(console.error);
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

// Get audit logs for a user (admin function)
async function getUserAuditLogs(userId, limit = 100, offset = 0) {
  const { all } = require('../database');
  
  try {
    const logs = await all(`
      SELECT 
        action,
        details,
        ip_address,
        user_agent,
        created_at
      FROM audit_log 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    return logs.map(log => ({
      action: log.action,
      details: JSON.parse(log.details || '{}'),
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at
    }));
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

// Clean up old audit logs (call this periodically)
async function cleanupAuditLogs(daysToKeep = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await run(
      'DELETE FROM audit_log WHERE created_at < ?',
      [cutoffDate]
    );

    console.log(`Cleaned up ${result.changes} old audit log entries`);
    return result.changes;
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    return 0;
  }
}

module.exports = {
  logAction,
  auditMiddleware,
  getUserAuditLogs,
  cleanupAuditLogs
}; 