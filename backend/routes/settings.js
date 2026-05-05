const express = require('express');
const router = express.Router();
const UserPreferences = require('../models/UserPreferences');
const { requireAuth } = require('./auth');
const mongoose = require('mongoose');

router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            // Mock response if no database is connected
            return res.json({
                autoCleanupEnabled: true,
                promotionsRetentionDays: 60,
                spamRetentionDays: 30,
                archiveReadPromotionsDays: 90,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                whitelistSenders: ['important@boss.com', 'family@home.com'],
                receiveSummaryEmail: true,
                lastRunAt: new Date(Date.now() - 86400000).toISOString()
            });
        }

        let prefs = await UserPreferences.findOne({ userId: req.userToken });
        if (!prefs) {
            prefs = await UserPreferences.create({ userId: req.userToken });
        }
        res.json(prefs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true, message: "Settings saved (mocked)" });
        }

        const updates = req.body;
        let prefs = await UserPreferences.findOneAndUpdate(
            { userId: req.userToken },
            { $set: updates },
            { new: true, upsert: true }
        );
        res.json(prefs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
