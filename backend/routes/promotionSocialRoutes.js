const express = require('express');
const router = express.Router();
const PromotionSocialService = require('../services/promotionSocialService');
const { requireAuth } = require('./auth');

// Middleware to initialize service
const getService = (req, res, next) => {
  req.promoSocialService = new PromotionSocialService(req.oauth2Client);
  next();
};

router.use(requireAuth);
router.use(getService);

/**
 * GET /api/emails/promotions
 * Fetch promotional emails
 */
router.get('/promotions', async (req, res) => {
  try {
    const { maxResults, pageToken, olderThan, unreadOnly } = req.query;
    const results = await req.promoSocialService.getPromotionalEmails({
      maxResults: parseInt(maxResults) || 20,
      pageToken,
      olderThan: parseInt(olderThan),
      unreadOnly: unreadOnly === 'true'
    });
    res.json(results);
  } catch (error) {
    console.error('PROMOTION_FETCH_ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

/**
 * GET /api/emails/social
 * Fetch social emails
 */
router.get('/social', async (req, res) => {
  try {
    const { maxResults, pageToken, olderThan, unreadOnly } = req.query;
    const results = await req.promoSocialService.getSocialEmails({
      maxResults: parseInt(maxResults) || 20,
      pageToken,
      olderThan: parseInt(olderThan),
      unreadOnly: unreadOnly === 'true'
    });
    res.json(results);
  } catch (error) {
    console.error('SOCIAL_FETCH_ERROR:', error);
    res.status(500).json({ error: 'Failed to fetch social emails' });
  }
});

/**
 * GET /api/emails/promotion-social
 * Fetch both categories combined
 */
router.get('/promotion-social', async (req, res) => {
  try {
    const { maxResults, pageToken, category } = req.query;
    const results = await req.promoSocialService.getCombinedPromotionSocial({
      maxResults: parseInt(maxResults) || 20,
      pageToken,
      category: category || 'both'
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch combined emails' });
  }
});

/**
 * GET /api/emails/promotion-social/stats
 * Get counts for each category
 */
router.get('/promotion-social/stats', async (req, res) => {
  try {
    const stats = await req.promoSocialService.getCategoryStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/emails/promotion-social/:id
 * Get full message content
 */
router.get('/promotion-social/:id', async (req, res) => {
  try {
    const details = await req.promoSocialService.getMessageDetails(req.params.id);
    res.json(details);
  } catch (error) {
    console.error(`ERROR_FETCHING_DETAILS for ${req.params.id}:`, error.message || error);
    const status = error.code === 401 || (error.message && error.message.includes('Invalid Credentials')) ? 401 : 500;
    res.status(status).json({ 
      error: status === 401 ? 'Session expired' : 'Failed to fetch email details',
      details: error.message || 'Unknown error'
    });
  }
});

module.exports = router;
