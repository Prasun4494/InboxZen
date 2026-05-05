const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Mapped to access_token for this demo
    autoCleanupEnabled: { type: Boolean, default: false },
    promotionsRetentionDays: { type: Number, default: 60 },
    spamRetentionDays: { type: Number, default: 30 },
    archiveReadPromotionsDays: { type: Number, default: 90 },
    timezone: { type: String, default: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
    whitelistSenders: [{ type: String }],
    receiveSummaryEmail: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
    overrideRecentProtection: { type: Boolean, default: false },
    batchLimit: { type: Number, default: 200 },
    confirmThreshold: { type: Number, default: 50 }
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
