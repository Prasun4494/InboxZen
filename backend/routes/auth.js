const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

// In-memory token store for demonstration of refresh handler
// Maps access_token -> full tokens object
const tokenStore = new Map();

// Middleware to inject auth client and handle token refresh
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];

    const credentials = tokenStore.get(token) || { access_token: token };
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(credentials);

    // Automatically refresh expired tokens
    oauth2Client.on('tokens', (newTokens) => {
        const updatedCreds = { ...credentials, ...newTokens };
        // Update store with original token key for backward compatibility with frontend
        tokenStore.set(token, updatedCreds);
        if (newTokens.access_token) {
            tokenStore.set(newTokens.access_token, updatedCreds);
        }
        console.log('Token automatically refreshed');
    });

    req.oauth2Client = oauth2Client;
    req.userToken = token;
    next();
};

const crypto = require('crypto');
const pendingLogins = new Map(); // tempId -> { tokens, otp, email }

// Helper to send OTP via Gmail API using the newly acquired tokens
const sendOtpEmail = async (tokens, email, otp) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const messageParts = [
        `To: ${email}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        'Subject: Your InboxZen Login OTP',
        '',
        `Your verification code is: ${otp}`,
        '',
        'If you did not request this code, please ignore this email.',
        'This code will expire shortly.'
    ];
    
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
    });
};

router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'select_account consent'
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuth2Client();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempId = crypto.randomBytes(16).toString('hex');
    
    // Store pending login
    pendingLogins.set(tempId, { tokens, otp, email });
    
    // Send OTP email
    await sendOtpEmail(tokens, email, otp);
    console.log(`OTP ${otp} sent to ${email}`);

    // Redirect to frontend OTP verification page
    res.redirect(`${process.env.FRONTEND_URL}/verify-otp?tempId=${tempId}&email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Error in google callback', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
  }
});

router.post('/verify-otp', async (req, res) => {
    const { tempId, otp } = req.body;
    const pending = pendingLogins.get(tempId);

    if (!pending) {
        return res.status(400).json({ error: 'Invalid or expired session' });
    }

    if (pending.otp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // OTP matched! Move tokens to main store
    const { tokens } = pending;
    tokenStore.set(tokens.access_token, tokens);
    pendingLogins.delete(tempId);

    res.json({ token: tokens.access_token });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const oauth2Client = req.oauth2Client;
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    res.json({ email: userInfo.data.email });
  } catch (error) {
    console.error('Failed to fetch user info', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

module.exports = { router, requireAuth, getOAuth2Client, tokenStore };
