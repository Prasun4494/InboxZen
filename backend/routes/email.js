const express = require('express');
const { google } = require('googleapis');
const { classifyEmail } = require('../services/ai');
const { requireAuth } = require('./auth');
const router = express.Router();

router.use(requireAuth);

router.get('/unread', async (req, res) => {
    try {
        const auth = req.oauth2Client;
        const gmail = google.gmail({ version: 'v1', auth });

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread in:inbox',
            maxResults: 50
        });

        const messages = response.data.messages || [];
        const emailDetails = [];

        for (const msg of messages) {
            const msgData = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id
            });

            const headers = msgData.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const snippet = msgData.data.snippet;

            const classification = await classifyEmail(subject, snippet);

            emailDetails.push({
                id: msg.id,
                threadId: msg.threadId,
                subject,
                from,
                snippet,
                // Add new fields provided by AI module
                priority: classification.priority,
                category: classification.category,
                suggested_action: (from.toLowerCase().includes('noreply') || from.toLowerCase().includes('no-reply')) && classification.suggested_action === 'auto_reply' ? 'archive' : classification.suggested_action,
                confidence_score: classification.confidence_score,
                summary: classification.summary,
                autoReply: (from.toLowerCase().includes('noreply') || from.toLowerCase().includes('no-reply')) ? null : (classification.draft_reply || null),
                meeting_details: classification.meeting_details || null
            });
        }

        res.json(emailDetails);
    } catch (error) {
        console.error('Error fetching emails', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

router.post('/reply', async (req, res) => {
    const { emailId, replyText, to, subject, threadId } = req.body;

    try {
        const auth = req.oauth2Client;
        const gmail = google.gmail({ version: 'v1', auth });

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        // Make sure to parse 'from' correctly as it can be "Name <email>" and we need just "email" or we can pass as is for standard 'To:' header.
        const messageParts = [
            `To: ${to}`,
            `Subject: Re: ${utf8Subject}`,
            `In-Reply-To: ${emailId}`,
            `References: ${emailId}`,
            '',
            replyText
        ];

        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
                threadId: threadId
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending reply', error);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

router.get('/details/:id', async (req, res) => {
    try {
        const auth = req.oauth2Client;
        const gmail = google.gmail({ version: 'v1', auth });

        const msgData = await gmail.users.messages.get({
            userId: 'me',
            id: req.params.id,
            format: 'full'
        });

        const message = msgData.data;
        if (!message || !message.payload) {
            throw new Error('Message payload is missing');
        }

        const headers = message.payload.headers || [];
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || 'No Subject';
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
        const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || 'Unknown';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
        
        let body = '';
        if (message.payload.parts) {
            const part = message.payload.parts.find(p => p.mimeType === 'text/html') || message.payload.parts.find(p => p.mimeType === 'text/plain');
            if (part && part.body && part.body.data) {
                const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
                body = Buffer.from(base64, 'base64').toString();
            }
        } else if (message.payload.body && message.payload.body.data) {
            const base64 = message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
            body = Buffer.from(message.payload.body.data, 'base64').toString();
        }

        res.json({
            id: message.id,
            subject,
            from,
            to,
            date,
            body: body || '(No content found)',
            isUnread: (message.labelIds || []).includes('UNREAD')
        });
    } catch (error) {
        console.error('Error fetching email details:', error.message || error);
        const status = error.code === 401 || (error.message && error.message.includes('Invalid Credentials')) ? 401 : 500;
        res.status(status).json({ 
            error: status === 401 ? 'Session expired' : 'Failed to fetch email details',
            details: error.message || 'Unknown error'
        });
    }
});

router.post('/toggle-read', async (req, res) => {
    const { emailId, markAsRead } = req.body;

    try {
        const auth = req.oauth2Client;
        const gmail = google.gmail({ version: 'v1', auth });

        await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
                removeLabelIds: markAsRead ? ['UNREAD'] : [],
                addLabelIds: markAsRead ? [] : ['UNREAD']
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error toggling read status', error);
        res.status(500).json({ error: 'Failed to toggle read status' });
    }
});

router.post('/mark-spam', async (req, res) => {
    const { emailId } = req.body;

    try {
        const auth = req.oauth2Client;
        const gmail = google.gmail({ version: 'v1', auth });

        await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
                addLabelIds: ['SPAM'],
                removeLabelIds: ['INBOX']
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking email as spam', error);
        res.status(500).json({ error: 'Failed to mark email as spam' });
    }
});

module.exports = router;
