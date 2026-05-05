const { google } = require('googleapis');

/**
 * Service for handling Promotional and Social emails from Gmail
 */
class PromotionSocialService {
  constructor(auth) {
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  /**
   * Fetch promotional emails
   * @param {Object} options - Pagination and filter options
   */
  async getPromotionalEmails(options = {}) {
    const { maxResults = 20, pageToken = null, olderThan = null, unreadOnly = false } = options;
    let query = 'category:promotions';
    if (olderThan) query += ` older_than:${olderThan}d`;
    if (unreadOnly) query += ' is:unread';
    
    return this.fetchEmails(query, maxResults, pageToken);
  }

  /**
   * Fetch social emails
   * @param {Object} options - Pagination and filter options
   */
  async getSocialEmails(options = {}) {
    const { maxResults = 20, pageToken = null, olderThan = null, unreadOnly = false } = options;
    let query = 'category:social';
    if (olderThan) query += ` older_than:${olderThan}d`;
    if (unreadOnly) query += ' is:unread';
    
    return this.fetchEmails(query, maxResults, pageToken);
  }

  /**
   * Fetch both categories combined
   * @param {Object} options - Pagination and filter options
   */
  async getCombinedPromotionSocial(options = {}) {
    const { maxResults = 20, pageToken = null, category = 'both' } = options;
    let query = '';
    if (category === 'promotions') query = 'category:promotions';
    else if (category === 'social') query = 'category:social';
    else query = '{category:promotions category:social}';
    
    return this.fetchEmails(query, maxResults, pageToken);
  }

  /**
   * Fetch and parse emails based on query
   */
  async fetchEmails(query, maxResults, pageToken) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken,
      });

      const messages = response.data.messages || [];
      const nextPageToken = response.data.nextPageToken;

      const detailedMessages = await Promise.all(
        messages.map(async (msg) => {
          return this.getMessageMetadata(msg.id);
        })
      );

      return {
        emails: detailedMessages,
        nextPageToken,
        totalEstimate: response.data.resultSizeEstimate
      };
    } catch (error) {
      console.error('Error fetching promotion/social emails:', error);
      throw error;
    }
  }

  /**
   * Get metadata for a specific message (for list view)
   */
  async getMessageMetadata(messageId) {
    try {
      const res = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date']
      });

      const headers = res.data.payload.headers;
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';
      const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();
      
      return {
        id: res.data.id,
        threadId: res.data.threadId,
        subject,
        from,
        date,
        snippet: res.data.snippet,
        labelIds: res.data.labelIds || [],
        isUnread: (res.data.labelIds || []).includes('UNREAD'),
        category: this.detectCategory(res.data.labelIds || [])
      };
    } catch (error) {
      console.error(`Error fetching metadata for ${messageId}:`, error);
      return { 
        id: messageId, 
        subject: '(Failed to load subject)', 
        from: 'Unknown Sender', 
        date: new Date().toISOString(),
        snippet: 'Could not retrieve email snippet.',
        error: true 
      };
    }
  }

  /**
   * Get full details for a message (for modal view)
   */
  async getMessageDetails(messageId) {
    try {
      const res = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = res.data;
      if (!message || !message.payload) {
        throw new Error('Message payload is missing');
      }

      const headers = message.payload.headers || [];
      
      const details = {
        id: message.id,
        threadId: message.threadId,
        subject: headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)',
        from: headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown Sender',
        to: headers.find(h => h.name?.toLowerCase() === 'to')?.value || '',
        date: headers.find(h => h.name?.toLowerCase() === 'date')?.value || '',
        snippet: message.snippet || '',
        body: this.parseMessageBody(message.payload),
        isUnread: (message.labelIds || []).includes('UNREAD'),
        category: this.detectCategory(message.labelIds || [])
      };

      return details;
    } catch (error) {
      console.error(`Error fetching full details for ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get category stats
   */
  async getCategoryStats() {
    try {
      const [promoList, socialList] = await Promise.all([
        this.gmail.users.messages.list({ userId: 'me', q: 'category:promotions', maxResults: 1 }),
        this.gmail.users.messages.list({ userId: 'me', q: 'category:social', maxResults: 1 })
      ]);

      return {
        promotions: promoList.data.resultSizeEstimate || 0,
        social: socialList.data.resultSizeEstimate || 0
      };
    } catch (error) {
      console.error('Error fetching category stats:', error);
      throw error;
    }
  }

  /**
   * Detect category from labels
   */
  detectCategory(labelIds) {
    if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'Promotion';
    if (labelIds.includes('CATEGORY_SOCIAL')) return 'Social';
    return 'Other';
  }

  /**
   * Parse email body from payload
   */
  parseMessageBody(payload) {
    if (!payload) return '';
    let body = '';
    
    if (payload.parts) {
      // Look for text/html first, then text/plain
      const htmlPart = this.findPart(payload.parts, 'text/html');
      const plainPart = this.findPart(payload.parts, 'text/plain');
      
      const selectedPart = htmlPart || plainPart;
      if (selectedPart && selectedPart.body && selectedPart.body.data) {
        try {
          // Handle Gmail's base64url encoding
          const base64 = selectedPart.body.data.replace(/-/g, '+').replace(/_/g, '/');
          body = Buffer.from(base64, 'base64').toString();
        } catch (e) {
          console.error('Error decoding base64 body part:', e);
          body = '(Error decoding content)';
        }
      }
    } else if (payload.body && payload.body.data) {
      try {
        const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        body = Buffer.from(base64, 'base64').toString();
      } catch (e) {
        console.error('Error decoding base64 body:', e);
        body = '(Error decoding content)';
      }
    }
    return body || '(No content found)';
  }

  findPart(parts, mimeType) {
    for (const part of parts) {
      if (part.mimeType === mimeType) return part;
      if (part.parts) {
        const found = this.findPart(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  }
}

module.exports = PromotionSocialService;
