const express = require('express');
const { google } = require('googleapis');
const { requireAuth } = require('./auth');
const router = express.Router();

router.use(requireAuth);

router.post('/add', async (req, res) => {
    try {
        const auth = req.oauth2Client;
        const calendar = google.calendar({ version: 'v3', auth });
        
        const { summary, description, startDateTime, endDateTime, location, attendees, timeZone } = req.body;
        
        const event = {
            summary: summary || 'Meeting',
            location: location || '',
            description: description || '',
            start: {
                dateTime: startDateTime || new Date().toISOString(),
                timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: endDateTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            attendees: attendees ? attendees.map(email => ({ email })) : [],
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        res.json({ success: true, event: response.data });
    } catch (error) {
        console.error('Error adding event to calendar', error);
        if (error.message && error.message.includes('Calendar API has not been used')) {
            console.log('Providing mock success for adding event since API is not enabled.');
            return res.json({ 
                success: true, 
                isMock: true,
                event: { summary: req.body.summary, status: 'mock_confirmed' } 
            });
        }
        res.status(500).json({ error: 'Failed to add event to calendar', details: error.message });
    }
});

router.get('/upcoming', async (req, res) => {
    try {
        const auth = req.oauth2Client;
        const calendar = google.calendar({ version: 'v3', auth });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });

        res.json({ events: response.data.items || [] });
    } catch (error) {
        console.error('Error fetching calendar events', error);
        
        // Fallback to mock data if API is not enabled or other errors occur during demo/dev
        if (error.message && error.message.includes('Calendar API has not been used')) {
            console.log('Providing mock calendar events as fallback since API is not enabled.');
            const mockEvents = [
                {
                    id: 'mock-1',
                    summary: 'Team Sync - Q3 Goals',
                    start: { dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
                    end: { dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
                    location: 'Zoom Room A',
                    attendees: [{ email: 'colleague1@company.com' }, { email: 'colleague2@company.com' }],
                    htmlLink: 'https://calendar.google.com/calendar/r/day'
                },
                {
                    id: 'mock-2',
                    summary: 'Client Presentation: InboxZen Demo',
                    start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
                    end: { dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
                    location: 'Google Meet',
                    attendees: [{ email: 'client@startup.io' }],
                    htmlLink: 'https://calendar.google.com/calendar/r/day'
                }
            ];
            return res.json({ events: mockEvents, isMock: true });
        }
        
        res.status(500).json({ error: 'Failed to fetch upcoming events', details: error.message });
    }
});

module.exports = router;
