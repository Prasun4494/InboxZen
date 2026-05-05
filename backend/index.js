const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/email');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes = require('./routes/settings');
const promotionSocialRoutes = require('./routes/promotionSocialRoutes');
const emailCleanupRoutes = require('./routes/emailCleanupRoutes');
const calendarRoutes = require('./routes/calendar');
const { initializeScheduler } = require('./services/cleanupScheduler');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/auth', authRoutes.router);
app.use('/api/emails', emailRoutes);
app.use('/api/emails', promotionSocialRoutes);
app.use('/api/emails', emailCleanupRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calendar', calendarRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

initializeScheduler();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
