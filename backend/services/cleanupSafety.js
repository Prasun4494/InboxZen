const UserPreferences = require('../models/UserPreferences');
const mongoose = require('mongoose');

class CleanupSafety {
    constructor(userToken) {
        this.userToken = userToken;
    }

    async getSafetySettings() {
        if (mongoose.connection.readyState !== 1) {
            return {
                whitelistDomains: ['@mycompany.com', 'important@'],
                overrideRecentProtection: false,
                batchLimit: 200,
                confirmThreshold: 50
            };
        }
        const prefs = await UserPreferences.findOne({ userId: this.userToken });
        return {
            whitelistDomains: prefs?.whitelistSenders || ['@mycompany.com', 'important@'],
            overrideRecentProtection: prefs?.overrideRecentProtection || false,
            batchLimit: prefs?.batchLimit || 200,
            confirmThreshold: prefs?.confirmThreshold || 50
        };
    }

    async checkSafety(messagesDetails, explicitConfirm) {
        const settings = await this.getSafetySettings();
        
        if (messagesDetails.length > settings.batchLimit) {
            throw new Error(`Safety Guardrail: Bulk operation limit exceeded (Max ${settings.batchLimit} emails per batch).`);
        }

        if (messagesDetails.length > settings.confirmThreshold && !explicitConfirm) {
            const err = new Error(`Safety Guardrail: Confirmation required for operations >${settings.confirmThreshold} emails.`);
            err.code = 'CONFIRM_REQUIRED';
            throw err;
        }

        const safeIds = [];
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (const msg of messagesDetails) {
            if (!msg) continue;
            
            // Check whitelist
            const isWhitelisted = settings.whitelistDomains.some(domain => 
                msg.from && msg.from.toLowerCase().includes(domain.toLowerCase())
            );
            if (isWhitelisted) {
                console.log(`[Safety] Skipped whitelisted email: ${msg.from}`);
                continue; 
            }

            // Check recent protection
            if (!settings.overrideRecentProtection && !explicitConfirm) {
                const msgDate = new Date(msg.date).getTime();
                if (now - msgDate < oneDayMs) {
                    const err = new Error('Safety Guardrail: Cannot delete emails from the last 24 hours without override.');
                    err.code = 'RECENT_PROTECTION';
                    throw err;
                }
            }

            safeIds.push(msg.id);
        }

        return safeIds;
    }
}

module.exports = CleanupSafety;
