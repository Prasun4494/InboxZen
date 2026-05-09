const { google } = require('googleapis');
const { classifyEmail } = require('./ai');

class EmailCleanupService {
  constructor(auth) {
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  // Fetch promotional emails
  async getPromotions(maxResults = 50, pageToken = null, olderThanDays = null, unreadOnly = false) {
    let query = 'category:promotions';
    if (olderThanDays) {
      query += ` older_than:${olderThanDays}d`;
    }
    if (unreadOnly) {
      query += ` is:unread`;
    }
    return this.fetchEmails(query, maxResults, pageToken);
  }

  // Fetch social emails
  async getSocial(maxResults = 50, pageToken = null, olderThanDays = null, unreadOnly = false) {
    let query = 'category:social';
    if (olderThanDays) {
      query += ` older_than:${olderThanDays}d`;
    }
    if (unreadOnly) {
      query += ` is:unread`;
    }
    return this.fetchEmails(query, maxResults, pageToken);
  }

  // Fetch spam emails
  async getSpam(maxResults = 50, pageToken = null) {
    return this.fetchEmails('in:spam', maxResults, pageToken);
  }

  // Fetch trashed emails (Cleanup History)
  async getTrash(maxResults = 50, pageToken = null) {
    return this.fetchEmails('in:trash', maxResults, pageToken);
  }

  // Fetch general inbox emails
  async getInbox(maxResults = 50, pageToken = null, unreadOnly = false) {
    let query = 'in:inbox';
    if (unreadOnly) {
      query += ' is:unread';
    }
    return this.fetchEmails(query, maxResults, pageToken);
  }

  // Fetch all mail
  async getAllMail(maxResults = 50, pageToken = null) {
    return this.fetchEmails('', maxResults, pageToken);
  }

  // Generic method to fetch and parse emails
  async fetchEmails(query, maxResults, pageToken) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken,
      });

      console.log(`[EmailCleanupService] Query: "${query}", Results: ${response.data.messages?.length || 0}`);
      const messages = response.data.messages || [];
      const nextPageToken = response.data.nextPageToken;

      const detailedMessagesResults = await Promise.allSettled(
        messages.map(async (msg) => {
          return this.getMessageDetails(msg.id);
        })
      );

      const detailedMessages = detailedMessagesResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      console.log(`[EmailCleanupService] Subjects: ${detailedMessages.map(m => m.subject).join(', ')}`);

      return {
        messages: detailedMessages,
        nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate
      };
    } catch (error) {
      console.error(`Error fetching emails with query "${query}":`, error);
      throw error;
    }
  }

  // Get specific message details
  async getMessageDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload.headers;
      
      const subject = headers.find((header) => header.name.toLowerCase() === 'subject')?.value || 'No Subject';
      const from = headers.find((header) => header.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const date = headers.find((header) => header.name.toLowerCase() === 'date')?.value || new Date().toISOString();

      let body = '';
      if (message.payload.parts) {
        body = this.parseMultipartBody(message.payload.parts);
      } else if (message.payload.body && message.payload.body.data) {
        const base64 = message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
        body = Buffer.from(base64, 'base64').toString('utf-8');
      }

      return {
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        snippet: message.snippet,
        body,
        category: this.categorizeEmail(message.labelIds)
      };
    } catch (error) {
      console.error(`Error fetching message details for ID ${messageId}:`, error);
      throw error;
    }
  }

  parseMultipartBody(parts) {
    let bodyText = '';
    let bodyHtml = '';

    const processParts = (partsList) => {
      for (const part of partsList) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
          bodyText += Buffer.from(base64, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
          const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
          bodyHtml += Buffer.from(base64, 'base64').toString('utf-8');
        } else if (part.parts) {
          processParts(part.parts); // Handle nested parts
        }
      }
    };

    processParts(parts);
    // Prefer HTML over plain text if both exist, but fallback to text
    return bodyHtml || bodyText;
  }

  categorizeEmail(labelIds) {
    if (!labelIds) return 'other';
    if (labelIds.includes('SPAM')) return 'spam';
    if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promotion';
    if (labelIds.includes('CATEGORY_SOCIAL')) return 'social';
    if (labelIds.includes('CATEGORY_UPDATES')) return 'updates';
    if (labelIds.includes('CATEGORY_FORUMS')) return 'forums';
    return 'other';
  }

  async bulkRemove(messageIds) {
    try {
      // Use trash instead of batchDelete to avoid requiring the restricted gmail.delete scope
      return this.bulkTrash(messageIds);
    } catch (error) {
      console.error('Error in bulk remove (trash):', error);
      throw error;
    }
  }

  async bulkTrash(messageIds) {
    try {
      const chunkSize = 50;
      for (let i = 0; i < messageIds.length; i += chunkSize) {
        const chunk = messageIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => 
          this.gmail.users.messages.trash({ userId: 'me', id })
        ));
      }
      return { success: true, count: messageIds.length };
    } catch (error) {
      console.error('Error in bulk trash:', error);
      throw error;
    }
  }

  async bulkUntrash(messageIds) {
    try {
      const chunkSize = 50;
      for (let i = 0; i < messageIds.length; i += chunkSize) {
        const chunk = messageIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => 
          this.gmail.users.messages.untrash({ userId: 'me', id })
        ));
      }
      return { success: true, count: messageIds.length };
    } catch (error) {
      console.error('Error in bulk untrash:', error);
      throw error;
    }
  }

  async cleanOldPromotions(olderThanDays) {
    try {
      let pageToken = null;
      let totalDeleted = 0;
      let query = `category:promotions older_than:${olderThanDays}d`;

      do {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100, // Batch limit
          pageToken,
        });

        const messages = response.data.messages || [];
        if (messages.length > 0) {
          const ids = messages.map(msg => msg.id);
          await this.bulkRemove(ids);
          totalDeleted += ids.length;
        }
        
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      return { success: true, count: totalDeleted };
    } catch (error) {
      console.error('Error cleaning old promotions:', error);
      throw error;
    }
  }

  async emptySpamFolder() {
    try {
      let pageToken = null;
      let totalDeleted = 0;

      do {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: 'in:spam',
          maxResults: 100,
          pageToken,
        });

        const messages = response.data.messages || [];
        if (messages.length > 0) {
          const ids = messages.map(msg => msg.id);
          await this.bulkRemove(ids);
          totalDeleted += ids.length;
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      return { success: true, count: totalDeleted };
    } catch (error) {
      console.error('Error emptying spam folder:', error);
      throw error;
    }
  }

  async scanInboxForSpam(maxToScan = 50) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'in:inbox -category:promotions -category:social', // Only scan main inbox
        maxResults: maxToScan
      });

      const messages = response.data.messages || [];
      const results = {
        totalScanned: messages.length,
        spamDetected: 0,
        spamIds: [],
        details: []
      };

      // Process in batches of 5 to avoid hitting rate limits and for better performance
      const batchSize = 5;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        await Promise.all(batch.map(async (msg) => {
          try {
            const details = await this.getMessageDetails(msg.id);
            const classification = await classifyEmail(details.subject, details.snippet);

            if (classification.category === 'spam') {
              results.spamDetected++;
              results.spamIds.push(msg.id);
              
              // Move to spam folder
              await this.gmail.users.messages.modify({
                userId: 'me',
                id: msg.id,
                requestBody: {
                  addLabelIds: ['SPAM'],
                  removeLabelIds: ['INBOX']
                }
              });
            }
            
            results.details.push({
              id: msg.id,
              subject: details.subject,
              category: classification.category,
              isSpam: classification.category === 'spam'
            });
          } catch (err) {
            console.error(`Error processing message ${msg.id}:`, err.message);
          }
        }));
      }

      return results;
    } catch (error) {
      console.error('Error scanning inbox for spam:', error);
      throw error;
    }
  }

  async getBulkPreview(messageIds) {
    try {
      const sampleIds = messageIds.slice(0, 10);
      const samples = await Promise.all(
        sampleIds.map(async (id) => {
          const res = await this.gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date']
          });
          const headers = res.data.payload.headers;
          return {
            id: res.data.id,
            subject: headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject',
            from: headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender',
            date: headers.find(h => h.name.toLowerCase() === 'date')?.value || new Date().toISOString(),
            sizeEstimate: res.data.sizeEstimate
          };
        })
      );

      // Average size from samples to estimate total
      const avgSize = samples.length > 0 
        ? samples.reduce((acc, s) => acc + (s.sizeEstimate || 0), 0) / samples.length 
        : 0;
      const totalSizeEstimate = Math.round(avgSize * messageIds.length);

      return {
        samples,
        totalCount: messageIds.length,
        totalSizeEstimate
      };
    } catch (error) {
      console.error('Error in getBulkPreview:', error);
      throw error;
    }
  }
}

module.exports = EmailCleanupService;
