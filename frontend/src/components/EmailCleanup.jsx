import React, { useState, useEffect } from 'react';
import { Trash2, ShieldAlert, CheckSquare, Square, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

const API_BASE = '/api/emails';

const EmailCleanup = () => {
  const [activeTab, setActiveTab] = useState('promotions'); // 'promotions' or 'spam'
  const [emails, setEmails] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSpamConfirm, setShowSpamConfirm] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    
    try {
      const endpoint = activeTab === 'promotions' 
        ? `${API_BASE}/promotions?maxResults=50` 
        : `${API_BASE}/spam?maxResults=50`;
        
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch emails');
      
      const data = await response.json();
      setEmails(data.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === emails.length && emails.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/bulk/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: Array.from(selectedIds) })
      });
      
      if (!response.ok) throw new Error('Failed to delete emails');
      
      // Refresh list
      await fetchEmails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanOldPromotions = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/promotions/clean`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: 30 })
      });
      
      if (!response.ok) throw new Error('Failed to clean old promotions');
      await fetchEmails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmptySpam = async () => {
    setActionLoading(true);
    setShowSpamConfirm(false);
    try {
      const response = await fetch(`${API_BASE}/spam/empty`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to empty spam folder');
      await fetchEmails();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-8 border-b border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600" />
              Inbox Cleanup
            </h1>
            <p className="mt-2 text-gray-600">Keep your inbox organized by managing promotions and spam efficiently.</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'promotions'
                ? 'border-indigo-500 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Promotional Emails
          </button>
          <button
            onClick={() => setActiveTab('spam')}
            className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'spam'
                ? 'border-red-500 text-red-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Spam Folder
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              disabled={emails.length === 0}
            >
              {selectedIds.size === emails.length && emails.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-indigo-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              Select All
            </button>
            <span className="text-sm text-gray-500 font-medium">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            )}

            {activeTab === 'promotions' ? (
              <button
                onClick={handleCleanOldPromotions}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Clean Old Promotions (&gt; 30 days)
              </button>
            ) : (
              <button
                onClick={() => setShowSpamConfirm(true)}
                disabled={actionLoading || emails.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Empty Spam Folder
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 shadow-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Action Failed</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Email List */}
        <div className="bg-white min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
              <p className="font-medium">Loading your emails...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100 shadow-inner">
                <CheckSquare className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">All caught up!</p>
              <p className="text-gray-500">No {activeTab} emails found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {emails.map((email) => (
                <li 
                  key={email.id} 
                  className={`flex items-start gap-4 p-5 hover:bg-gray-50/80 transition-colors cursor-pointer group ${
                    selectedIds.has(email.id) ? 'bg-indigo-50/40' : ''
                  }`}
                  onClick={() => toggleSelection(email.id)}
                >
                  <div className="pt-1">
                    {selectedIds.has(email.id) ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {email.from}
                      </p>
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded-full">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate mb-1">
                      {email.subject}
                    </p>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                      {email.snippet}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSpamConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center gap-4 text-red-600 mb-5">
              <div className="p-3 bg-red-100 rounded-full shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Empty Spam?</h3>
            </div>
            <p className="text-gray-600 mb-8 text-base leading-relaxed">
              Are you sure you want to permanently delete all messages in your spam folder? This action cannot be undone and will permanently remove all spam emails.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSpamConfirm(false)}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptySpam}
                className="px-5 py-2.5 text-white bg-red-600 font-medium rounded-xl hover:bg-red-700 transition-colors shadow-sm shadow-red-200"
              >
                Yes, Empty Spam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailCleanup;
