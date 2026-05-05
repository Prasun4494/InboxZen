/**
 * Utility functions for interacting with the Gmail API.
 * Provides query builders, response parsing, and batch operation helpers.
 * @module gmailQueries
 */

/**
 * Builds a Gmail search query for promotional emails.
 * @param {Object} options - The filter options.
 * @param {number} [options.olderThan] - Find emails older than X days.
 * @param {boolean} [options.unreadOnly] - Find only unread emails.
 * @param {string} [options.from] - Find emails from a specific sender.
 * @returns {string} The formatted Gmail search query.
 */
const getPromotionsQuery = ({ olderThan, unreadOnly, from } = {}) => {
  const queryParts = ['category:promotions'];
  
  if (olderThan) queryParts.push(`older_than:${olderThan}d`);
  if (unreadOnly) queryParts.push('is:unread');
  if (from) queryParts.push(`from:${from}`);
  
  return queryParts.join(' ');
};

/**
 * Builds a Gmail search query for spam emails.
 * @param {Object} options - The filter options.
 * @param {number} [options.olderThan] - Find spam older than X days.
 * @param {string} [options.from] - Find spam from a specific sender.
 * @returns {string} The formatted Gmail search query.
 */
const getSpamQuery = ({ olderThan, from } = {}) => {
  const queryParts = ['in:spam'];
  
  if (olderThan) queryParts.push(`older_than:${olderThan}d`);
  if (from) queryParts.push(`from:${from}`);
  
  return queryParts.join(' ');
};

/**
 * Builds a Gmail search query to find emails with unsubscribe links.
 * Common patterns include checking headers for List-Unsubscribe or body text.
 * @returns {string} The formatted Gmail search query.
 */
const getUnsubscribeEmailsQuery = () => {
  return 'unsubscribe OR "List-Unsubscribe"';
};

/**
 * Builds a Gmail search query for old emails across the inbox.
 * @param {number} days - Find emails older than this many days.
 * @returns {string} The formatted Gmail search query.
 */
const getOldEmailsQuery = (days) => {
  if (!days || days <= 0) throw new Error('Days must be a positive number.');
  return `older_than:${days}d`;
};

/**
 * Decodes a base64 encoded string from the Gmail API.
 * Handles base64url format which replaces + with - and / with _.
 * @param {string} base64String - The base64 encoded string.
 * @returns {string} The decoded UTF-8 string.
 */
const decodeBase64 = (base64String) => {
  if (!base64String) return '';
  // Gmail API uses base64url format
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
};

/**
 * Extracts and decodes the body content from a Gmail API message payload.
 * Handles both plain text and HTML multipart formats.
 * @param {Object} payload - The message payload from Gmail API.
 * @returns {string} The decoded email body.
 */
const extractEmailBody = (payload) => {
  if (!payload) return '';

  let body = '';

  const traverseParts = (parts) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body += decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        body += decodeBase64(part.body.data);
      } else if (part.parts) {
        traverseParts(part.parts);
      }
    }
  };

  if (payload.parts) {
    traverseParts(payload.parts);
  } else if (payload.body?.data) {
    body = decodeBase64(payload.body.data);
  }

  return body;
};

/**
 * Checks if an email contains an unsubscribe link either in headers or body.
 * @param {string} body - The decoded email body.
 * @param {Array<Object>} headers - The array of email headers.
 * @returns {boolean} True if an unsubscribe link or header is found.
 */
const hasUnsubscribeLink = (body = '', headers = []) => {
  // Check headers for List-Unsubscribe
  const listUnsubscribeHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
  if (listUnsubscribeHeader) return true;

  // Check body for common unsubscribe text/links
  const unsubscribeRegex = /unsubscribe/i;
  return unsubscribeRegex.test(body);
};

/**
 * Parses a raw Gmail API response into a clean, normalized email object.
 * @param {Object} message - The raw message object from Gmail API.
 * @returns {Object} A clean email object containing essential details.
 */
const parseEmailResponse = (message) => {
  if (!message || !message.payload) {
    return null;
  }

  const headers = message.payload.headers || [];
  
  const getHeader = (name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
  };

  const body = extractEmailBody(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeader('Subject') || 'No Subject',
    from: getHeader('From') || 'Unknown Sender',
    to: getHeader('To'),
    date: getHeader('Date') ? new Date(getHeader('Date')).toISOString() : new Date().toISOString(),
    snippet: message.snippet || '',
    body,
    labels: message.labelIds || [],
    hasUnsubscribe: hasUnsubscribeLink(body, headers)
  };
};

/**
 * Chunks an array of message IDs into batches for safe batch deletion.
 * Gmail API batchDelete has a maximum limit of 100 IDs per request.
 * @param {Array<string>} messageIds - Array of message IDs to delete.
 * @returns {Array<Array<string>>} An array of batches (max 100 items each).
 */
const generateBatchDeleteOperations = (messageIds) => {
  if (!Array.isArray(messageIds)) throw new TypeError('messageIds must be an array');
  
  const BATCH_LIMIT = 100;
  const batches = [];
  
  for (let i = 0; i < messageIds.length; i += BATCH_LIMIT) {
    batches.push(messageIds.slice(i, i + BATCH_LIMIT));
  }
  
  return batches;
};

/**
 * Formats a given date string or timestamp into a readable string (e.g., "YYYY-MM-DD").
 * @param {string|number|Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
const formatDateString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Validates whether a given string is a valid email address format.
 * @param {string} email - The email address string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
const isValidEmailFormat = (email) => {
  if (typeof email !== 'string') return false;
  
  // Extract email if it's in the format "Name <email@example.com>"
  let emailToTest = email;
  const match = email.match(/<([^>]+)>/);
  if (match) {
    emailToTest = match[1];
  }
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(emailToTest.trim());
};

module.exports = {
  getPromotionsQuery,
  getSpamQuery,
  getUnsubscribeEmailsQuery,
  getOldEmailsQuery,
  decodeBase64,
  extractEmailBody,
  hasUnsubscribeLink,
  parseEmailResponse,
  generateBatchDeleteOperations,
  formatDateString,
  isValidEmailFormat
};
