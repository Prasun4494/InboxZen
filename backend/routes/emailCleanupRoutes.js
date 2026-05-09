const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const EmailCleanupService = require('../services/emailCleanupService');
const CleanupSafety = require('../services/cleanupSafety');
const { requireAuth } = require('./auth');

// 4. Audit logging function
const auditLog = (operation, count, userToken) => {
    try {
        const logLine = `[${new Date().toISOString()}] OPERATION: ${operation} | COUNT: ${count} | USER: ${userToken ? userToken.substring(0,10) + '...' : 'unknown'}\n`;
        fs.appendFileSync(path.join(__dirname, '../audit.log'), logLine);
    } catch (err) {
        console.error('Audit log failed', err);
    }
};

// 3. Rate limiter specific to cleanup operations
const deletionRateLimits = new Map();

const cleanupRateLimiter = (req, res, next) => {
    // Only apply to destructive routes
    if (!['DELETE', 'POST'].includes(req.method)) return next();

    const token = req.userToken;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxDeletions = 50;

    let limitData = deletionRateLimits.get(token) || { count: 0, resetTime: now + windowMs };
    
    if (now > limitData.resetTime) {
        limitData = { count: 0, resetTime: now + windowMs };
    }

    // Determine requested count
    let requestedCount = 0;
    if (req.path === '/bulk/remove') {
        requestedCount = req.body.messageIds?.length || 0;
    } else if (req.path === '/scan-spam') {
        requestedCount = 1; // Scan operation counts as 1 to allow multiple scans
    } else {
        // For clean and empty, assume bulk could hit limit, enforce safely
        requestedCount = 50; 
    }

    if (limitData.count + requestedCount > maxDeletions && req.path === '/bulk/remove') {
        return res.status(429).json({ error: `Rate limit exceeded. Max ${maxDeletions} deletions per minute.` });
    } else if (limitData.count >= maxDeletions) {
        return res.status(429).json({ error: `Rate limit exceeded. Try again in a minute.` });
    }

    req.limitData = limitData;
    next();
};

const updateRateLimit = (req, actualCount) => {
    if (req.limitData && req.userToken) {
        req.limitData.count += actualCount;
        deletionRateLimits.set(req.userToken, req.limitData);
    }
};

const getCleanupService = (req, res, next) => {
  req.cleanupService = new EmailCleanupService(req.oauth2Client);
  next();
};

router.use(requireAuth);
router.use(getCleanupService);

// GET /api/emails/promotions - fetch promotions with filters
router.get('/promotions', async (req, res) => {
  try {
    const { maxResults, pageToken, olderThan, unreadOnly } = req.query;
    const isUnreadOnly = unreadOnly === 'true';
    
    const results = await req.cleanupService.getPromotions(
      maxResults ? parseInt(maxResults) : 50,
      pageToken,
      olderThan,
      isUnreadOnly
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions', details: error.message });
  }
});

// GET /api/emails/spam - fetch spam emails
router.get('/spam', async (req, res) => {
  try {
    const { maxResults, pageToken } = req.query;
    const results = await req.cleanupService.getSpam(
      maxResults ? parseInt(maxResults) : 50,
      pageToken
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch spam emails', details: error.message });
  }
});

// GET /api/emails/social - fetch social emails with filters
router.get('/social', async (req, res) => {
  try {
    const { maxResults, pageToken, olderThan, unreadOnly } = req.query;
    const isUnreadOnly = unreadOnly === 'true';
    
    const results = await req.cleanupService.getSocial(
      maxResults ? parseInt(maxResults) : 50,
      pageToken,
      olderThan,
      isUnreadOnly
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch social emails', details: error.message });
  }
});

// GET /api/emails/trash - fetch trashed emails (cleanup history)
router.get('/trash', async (req, res) => {
  try {
    const { maxResults, pageToken } = req.query;
    const results = await req.cleanupService.getTrash(
      maxResults ? parseInt(maxResults) : 50,
      pageToken
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trashed emails', details: error.message });
  }
});

// GET /api/emails/inbox - fetch general inbox emails
router.get('/inbox', async (req, res) => {
  try {
    const { maxResults, pageToken, unreadOnly } = req.query;
    const isUnreadOnly = unreadOnly === 'true';
    const results = await req.cleanupService.getInbox(
      maxResults ? parseInt(maxResults) : 50,
      pageToken,
      isUnreadOnly
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inbox emails', details: error.message });
  }
});

// GET /api/emails/all - fetch all emails
router.get('/all', async (req, res) => {
  try {
    const { maxResults, pageToken } = req.query;
    const results = await req.cleanupService.getAllMail(
      maxResults ? parseInt(maxResults) : 50,
      pageToken
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all emails', details: error.message });
  }
});

// DELETE /api/emails/bulk/remove - remove multiple emails by IDs
router.delete('/bulk/remove', cleanupRateLimiter, async (req, res) => {
  try {
    const { messageIds, explicitConfirm } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty messageIds array' });
    }

    const safetyGuard = new CleanupSafety(req.userToken);
    const details = await Promise.all(messageIds.map(id => req.cleanupService.getMessageDetails(id).catch(() => null)));
    
    let safeIds;
    try {
        safeIds = await safetyGuard.checkSafety(details, explicitConfirm);
    } catch (err) {
        if (err.code === 'CONFIRM_REQUIRED' || err.code === 'RECENT_PROTECTION') {
             return res.status(403).json({ error: err.message, requiresExplicitConfirm: true });
        }
        return res.status(400).json({ error: err.message });
    }

    if (safeIds.length === 0) {
        return res.json({ message: 'All selected emails were skipped by safety guardrails.', count: 0, success: true });
    }

    // Soft delete to trash to support Undo buffer
    const result = await req.cleanupService.bulkTrash(safeIds);
    updateRateLimit(req, result.count);
    auditLog('BULK_TRASH', result.count, req.userToken);
    
    res.json({ message: `Successfully moved ${result.count} emails to trash`, trashedIds: safeIds, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trash emails', details: error.message });
  }
});

// POST /api/emails/bulk/untrash - undo a bulk trash operation
router.post('/bulk/untrash', cleanupRateLimiter, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty messageIds array' });
    }

    const result = await req.cleanupService.bulkUntrash(messageIds);
    updateRateLimit(req, result.count); // Count as operation for rate limit
    auditLog('BULK_UNTRASH', result.count, req.userToken);
    
    res.json({ message: `Successfully restored ${result.count} emails`, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore emails', details: error.message });
  }
});

// POST /api/emails/bulk/preview - preview multiple emails before bulk action
router.post('/bulk/preview', async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty messageIds array' });
    }

    const preview = await req.cleanupService.getBulkPreview(messageIds);
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bulk preview', details: error.message });
  }
});

// DELETE /api/emails/promotions/clean - bulk remove promotions older than X days
router.delete('/promotions/clean', cleanupRateLimiter, async (req, res) => {
  try {
    const { olderThanDays } = req.body;
    const days = olderThanDays ? parseInt(olderThanDays) : 30;
    const result = await req.cleanupService.cleanOldPromotions(days);
    
    updateRateLimit(req, result.count);
    auditLog('CLEAN_PROMOTIONS', result.count, req.userToken);
    
    res.json({ message: `Successfully cleaned ${result.count} old promotions`, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clean old promotions', details: error.message });
  }
});

// DELETE /api/emails/spam/empty - permanently empty entire spam folder
router.delete('/spam/empty', cleanupRateLimiter, async (req, res) => {
  try {
    const result = await req.cleanupService.emptySpamFolder();
    
    updateRateLimit(req, result.count);
    auditLog('EMPTY_SPAM', result.count, req.userToken);
    
    res.json({ message: `Successfully emptied spam folder. Deleted ${result.count} emails.`, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to empty spam folder', details: error.message });
  }
});

// POST /api/emails/auto-cleanup - automated scheduled cleanup
router.post('/auto-cleanup', cleanupRateLimiter, async (req, res) => {
  try {
    const { olderThanDays } = req.body;
    const days = olderThanDays ? parseInt(olderThanDays) : 30;
    
    const promoResult = await req.cleanupService.cleanOldPromotions(days);
    const spamResult = await req.cleanupService.emptySpamFolder();
    
    const total = promoResult.count + spamResult.count;
    updateRateLimit(req, total);
    auditLog('AUTO_CLEANUP', total, req.userToken);
    
    res.json({ 
      message: 'Automated cleanup completed successfully',
      promotionsCleaned: promoResult.count,
      spamEmptied: spamResult.count
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run auto-cleanup', details: error.message });
  }
});

// POST /api/emails/scan-spam - scan inbox for spam using AI
router.post('/scan-spam', async (req, res) => {
  try {
    const { maxToScan } = req.body;
    const results = await req.cleanupService.scanInboxForSpam(maxToScan ? parseInt(maxToScan) : 50);
    
    auditLog('SCAN_SPAM', results.totalScanned, req.userToken);
    
    res.json({ 
      message: `Successfully scanned ${results.totalScanned} emails. Detected ${results.spamDetected} spam messages.`, 
      ...results 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan for spam', details: error.message });
  }
});

module.exports = router;
