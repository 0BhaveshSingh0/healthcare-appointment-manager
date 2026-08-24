const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { authenticate } = require('../middleware/auth');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// We need a simple in-memory or DB store for state maps. 
// For this assignment, an in-memory Map is sufficient as long as we only run 1 instance.
// Key: random state string, Value: userId
const stateMap = new Map();

// POST /auth/google/init
router.post('/init', authenticate, (req, res) => {
  const userId = req.user.userId;
  const state = crypto.randomUUID();
  stateMap.set(state, userId);
  
  // Clean up state after 10 mins to prevent memory leaks
  setTimeout(() => stateMap.delete(state), 10 * 60 * 1000);

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent' // Force to get refresh token
  });

  res.json({ url });
});

// GET /auth/google/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Error: ${error}`);
  }

  const userId = stateMap.get(state);
  if (!userId) {
    return res.status(400).send('Invalid or expired OAuth state');
  }
  
  stateMap.delete(state); // Clean up immediately after use

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store in DB
    await prisma.oAuthToken.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '', // Sometimes refresh token is omitted if previously granted without prompt: 'consent'
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000)
      },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000)
      }
    });

    res.send('<script>window.close();</script>Calendar connected successfully. You can close this tab.');
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    res.status(500).send('Failed to connect Calendar');
  }
});

module.exports = router;
