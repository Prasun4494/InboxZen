import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing Promotional and Social emails
 */
export const usePromotionSocial = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [stats, setStats] = useState({ promotions: 0, social: 0 });
  
  const cache = useRef({});
  const token = localStorage.getItem('gmail_token');

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('http://localhost:3000/api/emails/promotion-social/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, [token]);

  const fetchEmails = useCallback(async (type, options = {}, append = false) => {
    if (!token) return;
    
    const cacheKey = `${type}-${JSON.stringify(options)}`;
    const cachedData = cache.current[cacheKey];
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION) && !append) {
      setEmails(cachedData.data);
      setNextPageToken(cachedData.nextPageToken);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === 'both' ? 'promotion-social' : type;
      const res = await axios.get(`http://localhost:3000/api/emails/${endpoint}`, {
        params: options,
        headers: { Authorization: `Bearer ${token}` }
      });

      const newEmails = res.data.emails || [];
      const newToken = res.data.nextPageToken;

      setEmails(prev => append ? [...prev, ...newEmails] : newEmails);
      setNextPageToken(newToken);

      // Update cache
      if (!append) {
        cache.current[cacheKey] = {
          data: newEmails,
          nextPageToken: newToken,
          timestamp: Date.now()
        };
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const getEmailDetails = useCallback(async (id) => {
    if (!token) return null;
    try {
      const res = await axios.get(`http://localhost:3000/api/emails/promotion-social/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      console.error('Failed to fetch email details', err);
      throw err;
    }
  }, [token]);

  return {
    emails,
    loading,
    error,
    nextPageToken,
    stats,
    fetchEmails,
    fetchStats,
    getEmailDetails
  };
};
