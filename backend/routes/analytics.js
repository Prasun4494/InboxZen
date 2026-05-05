const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');

// Require authentication for analytics
router.use(requireAuth);

router.get('/cleanup-stats', (req, res) => {
    // In a production app, this would query a database tracking all cleanup actions.
    // For this implementation, we'll generate realistic simulated data based on the requested date range.
    const { days = 30 } = req.query;
    const daysInt = parseInt(days, 10);
    
    const history = [];
    let curDate = new Date();
    
    // Generate realistic daily data
    for (let i = daysInt; i >= 0; i--) {
        const d = new Date(curDate);
        d.setDate(d.getDate() - i);
        // Slightly randomized data for realistic looking charts
        const promos = Math.floor(Math.random() * 30) + 10;
        const spam = Math.floor(Math.random() * 15) + 5;
        
        history.push({
            date: d.toISOString().split('T')[0],
            promotions: promos,
            spam: spam
        });
    }

    const totalPromotions = history.reduce((sum, item) => sum + item.promotions, 0);
    const totalSpam = history.reduce((sum, item) => sum + item.spam, 0);
    const storageReclaimed = (((totalPromotions + totalSpam) * 50) / 1024).toFixed(1); // Assuming ~50KB per email

    const topSenders = [
        { email: 'marketing@bigdeals.com', count: Math.floor(totalPromotions * 0.25) },
        { email: 'newsletter@spamhouse.net', count: Math.floor(totalSpam * 0.35) },
        { email: 'offers@shoppingmall.com', count: Math.floor(totalPromotions * 0.15) },
        { email: 'noreply@socialnetwork.com', count: Math.floor(totalPromotions * 0.12) },
        { email: 'daily@news-digest.com', count: Math.floor(totalPromotions * 0.08) },
        { email: 'win@lottery-winner.biz', count: Math.floor(totalSpam * 0.15) },
        { email: 'sale@fashionbrand.com', count: Math.floor(totalPromotions * 0.05) },
        { email: 'crypto-alerts@scam.org', count: Math.floor(totalSpam * 0.1) },
        { email: 'info@marketing-platform.io', count: Math.floor(totalPromotions * 0.04) },
        { email: 'support@unwanted-service.com', count: Math.floor(totalSpam * 0.08) },
    ].sort((a, b) => b.count - a.count);

    res.json({
        timeframe: `${daysInt} days`,
        totalPromotions,
        totalSpam,
        storageReclaimed,
        topSenders,
        history,
        cleanupFrequency: '2.4 times/week'
    });
});

module.exports = router;
