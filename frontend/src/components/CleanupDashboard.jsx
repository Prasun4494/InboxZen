import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, ShieldAlert, CheckSquare, Square, AlertTriangle, 
  RefreshCw, Loader2, Archive, Settings, X,
  Search, Calendar, Check, Tag, Filter, Link as LinkIcon,
  Inbox, Clock, UserPlus, Zap
} from 'lucide-react';
import clsx from 'clsx';
import CleanupSettings from './CleanupSettings';
import UndoToast from './UndoToast';
import BulkDeletePreview from './BulkDeletePreview';

const API_BASE = '/api/emails';

const Toast = ({ message, type, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 backdrop-blur-md border ${
        type === 'error' 
          ? 'bg-rose-500/90 border-rose-400 text-white' 
          : 'bg-indigo-600/90 border-indigo-500 text-white'
      }`}
    >
      {type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 hover:bg-white/20 p-1 rounded-full transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText, isDanger }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          onClick={onCancel}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700 p-6 sm:p-8"
        >
          <div className={`w-12 h-12 rounded-full mb-6 flex items-center justify-center ${isDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
            {isDanger ? <AlertTriangle className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-300 mb-8 leading-relaxed">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-xl font-medium text-white shadow-lg transition-all ${
                isDanger 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30 hover:shadow-rose-600/50' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 hover:shadow-indigo-600/50'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const CleanupDashboard = () => {
  const [emails, setEmails] = useState({ inbox: [], promotions: [], spam: [], social: [], trash: [], all: [] });
  const [pageTokens, setPageTokens] = useState({ inbox: null, promotions: null, spam: null, social: null, trash: null, all: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Filters
  const [filterSender, setFilterSender] = useState('');
  const [filterUnsub, setFilterUnsub] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');

  // UI State
  const [toasts, setToasts] = useState([]);
  const [modalConfig, setModalConfig] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [undoConfig, setUndoConfig] = useState(null);
  const [showBulkPreview, setShowBulkPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const token = localStorage.getItem('gmail_token');

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const fetchEmails = useCallback(async (isLoadMore = false) => {
    if (!token) return;
    if (!isLoadMore) setLoading(true);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const currentToken = isLoadMore ? pageTokens[activeTab] : null;
      
      const res = await fetch(`${API_BASE}/${activeTab}?maxResults=50${currentToken ? `&pageToken=${currentToken}` : ''}`, { headers });
      
      if (!res.ok) throw new Error(`Failed to fetch ${activeTab}`);
      const data = await res.json();
      
      const newMessages = (data.messages || []).map(e => ({ ...e, category: activeTab }));
      
      setEmails(prev => ({
        ...prev,
        [activeTab]: isLoadMore ? [...prev[activeTab], ...newMessages] : newMessages
      }));
      
      setPageTokens(prev => ({
        ...prev,
        [activeTab]: data.nextPageToken || null
      }));

      if (!isLoadMore) setSelectedIds(new Set());
    } catch (err) {
      showToast(err.message || 'Failed to fetch emails', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, token, activeTab, pageTokens]);

  const fetchSettingsStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3000/api/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setLastRun(data.lastRunAt);
      }
    } catch (e) {}
  }, [token]);

  useEffect(() => {
    fetchEmails();
  }, [activeTab, token]); // Refetch when tab changes

  useEffect(() => {
    fetchSettingsStatus();
  }, [fetchSettingsStatus]);

  // Derived state
  const currentList = useMemo(() => emails[activeTab] || [], [emails, activeTab]);
  
  const filteredList = useMemo(() => {
    return currentList.filter(email => {
      if (filterSender && !email.from?.toLowerCase().includes(filterSender.toLowerCase())) return false;
      if (filterUnsub && !email.snippet?.toLowerCase().includes('unsubscribe')) return false;
      return true;
    });
  }, [currentList, filterSender, filterUnsub]);

  const stats = useMemo(() => {
    const totalPromos = emails.promotions.length;
    const totalSpam = emails.spam.length;
    const totalSocial = emails.social.length;
    const totalInbox = emails.inbox.length;
    const estimatedMbSaved = ((totalPromos + totalSpam + totalSocial) * 50 / 1024).toFixed(1);
    return { totalPromos, totalSpam, totalSocial, totalInbox, estimatedMbSaved };
  }, [emails]);

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map(e => e.id)));
    }
  };

  const handleOpenPreview = async () => {
    if (selectedIds.size === 0) return;
    setShowBulkPreview(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bulk/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error('Failed to fetch preview');
      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      showToast(err.message, 'error');
      setShowBulkPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Actions
  const handleBulkDelete = async (forceConfirm = false) => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bulk/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: Array.from(selectedIds), explicitConfirm: forceConfirm })
      });
      const data = await res.json();
      
      if (!res.ok) {
         if (res.status === 403 && data.requiresExplicitConfirm) {
            setModalConfig({
                title: 'Safety Warning',
                message: data.error,
                confirmText: 'Yes, proceed anyway',
                isDanger: true,
                onConfirm: () => handleBulkDelete(true)
            });
            setActionLoading(false);
            return;
         }
         throw new Error(data.error || 'Failed to delete');
      }
      
      setModalConfig(null);
      if (data.trashedIds?.length > 0) {
        setUndoConfig({
          message: `${data.trashedIds.length} emails moved to trash.`,
          ids: data.trashedIds
        });
      } else {
        showToast(data.message || 'Operation completed');
      }
      await fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
      setModalConfig(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = async (ids) => {
    if (!ids || ids.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bulk/untrash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: ids })
      });
      if (!res.ok) throw new Error('Failed to undo delete');
      showToast('Emails restored successfully');
      await fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
      setUndoConfig(null);
    }
  };

  const handleCleanPromotions = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/promotions/clean`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ olderThanDays: 30 })
      });
      if (!res.ok) throw new Error('Failed to clean promotions');
      const data = await res.json();
      showToast(`Archived ${data.count || 0} old promotions`);
      await fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
      setModalConfig(null);
    }
  };

  const handleEmptySpam = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/spam/empty`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to empty spam');
      showToast('Spam folder emptied successfully');
      await fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
      setModalConfig(null);
    }
  };

  const handleSmartUnsubscribe = async () => {
    // Detect emails that look like useless subscriptions (e.g. have "unsubscribe" in snippet)
    const unsubEmails = emails.promotions.filter(e => e.snippet?.toLowerCase().includes('unsubscribe'));
    if (unsubEmails.length === 0) {
      showToast('No useless subscriptions found to clean up.', 'success');
      return;
    }
    
    // Auto-select them and initiate bulk delete, while mocking the unsubscribe action
    const ids = unsubEmails.map(e => e.id);
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bulk/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: ids, explicitConfirm: true })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to clean subscriptions');
      
      setModalConfig(null);
      // Show special toast for unsubscribe
      showToast(`Successfully unsubscribed from senders and moved ${data.trashedIds?.length || ids.length} useless subscriptions to trash!`, 'success');
      
      if (data.trashedIds?.length > 0) {
        setUndoConfig({
          message: `Unsubscribed and deleted ${data.trashedIds.length} emails.`,
          ids: data.trashedIds
        });
      }
      await fetchEmails();
    } catch (err) {
      showToast(err.message, 'error');
      setModalConfig(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanSpam = async (maxToScan = 50) => {
    console.log('[CleanupDashboard] Starting spam scan, maxToScan:', maxToScan);
    setModalConfig(null);
    showToast(`Starting AI scan of last ${maxToScan} emails...`, 'success');
    setActionLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/scan-spam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxToScan })
      });
      console.log('[CleanupDashboard] Scan response status:', res.status);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to scan for spam');
      
      console.log('[CleanupDashboard] Scan completed:', data);
      showToast(data.message, 'success');
      await fetchEmails();
    } catch (err) {
      console.error('[CleanupDashboard] Scan error:', err);
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const cleanName = name.replace(/['"]/g, '').split('<')[0].trim();
    return cleanName.substring(0, 2).toUpperCase() || '?';
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-slate-100">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 flex flex-col justify-center">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 mb-2">
            Cleanup
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-slate-400 font-medium">Keep your inbox Zen.</p>
            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-slate-800/50 rounded-lg border border-slate-700 text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Auto-Run: {lastRun ? new Date(lastRun).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
        
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Promotions</p>
                <p className="text-3xl font-bold text-white">{stats.totalPromos}</p>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Social</p>
                <p className="text-3xl font-bold text-white">{stats.totalSocial}</p>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-500/20 text-slate-400 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Spam</p>
                <p className="text-3xl font-bold text-white">{stats.totalSpam}</p>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Storage Saved</p>
                <p className="text-3xl font-bold text-white">{stats.estimatedMbSaved} <span className="text-xl text-slate-500 font-medium">MB</span></p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel p-2 flex flex-wrap gap-2 shadow-sm rounded-2xl">
        <button 
          onClick={() => setModalConfig({
            title: 'Smart Unsubscribe + Cleanup',
            message: 'This will automatically detect useless promotional subscriptions, unsubscribe you from them, and delete all their associated emails.',
            confirmText: 'Remove Useless Subscriptions',
            isDanger: false,
            onConfirm: handleSmartUnsubscribe
          })}
          disabled={actionLoading || stats.totalPromos === 0}
          className="flex-[2] min-w-[250px] flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 font-bold rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]"
        >
          <Zap className="w-5 h-5 text-amber-400" /> Smart Unsubscribe: Remove Useless Subs
        </button>

        <button 
          onClick={() => setModalConfig({
            title: 'Archive Old Promotions',
            message: 'This will archive all promotional emails older than 30 days. They will no longer appear in your primary inbox view.',
            confirmText: 'Archive Now',
            isDanger: false,
            onConfirm: handleCleanPromotions
          })}
          disabled={actionLoading || stats.totalPromos === 0}
          className="flex-1 min-w-[180px] flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          <Archive className="w-5 h-5" /> Promos &gt;30d
        </button>
        
        <button 
          onClick={() => setModalConfig({
            title: 'Empty Spam Folder',
            message: 'Are you absolutely sure? This will permanently delete all emails currently in your spam folder. This cannot be undone.',
            confirmText: 'Empty Spam',
            isDanger: true,
            onConfirm: handleEmptySpam
          })}
          disabled={actionLoading || stats.totalSpam === 0}
          className="flex-1 min-w-[180px] flex items-center justify-center gap-2 py-3 px-4 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-5 h-5" /> Empty Spam
        </button>

        <button 
          onClick={() => setModalConfig({
            title: 'AI Spam Scanner',
            message: 'This will use AI to scan your last 50 inbox messages for potential spam and move them to the spam folder.',
            confirmText: 'Start Scan',
            isDanger: false,
            onConfirm: () => handleScanSpam(50)
          })}
          disabled={actionLoading}
          className="flex-1 min-w-[180px] flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 font-semibold rounded-xl transition-colors disabled:opacity-50 border border-emerald-500/30"
        >
          <ShieldAlert className="w-5 h-5 text-emerald-400" /> AI Spam Scan
        </button>
        
        <button 
          onClick={() => setShowSettings(true)}
          className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors border border-slate-700"
          title="Auto-Cleanup Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden flex flex-col">
        
        {/* Filters & Tabs */}
        <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-800/30">
          <div className="flex bg-slate-900/50 p-1 rounded-xl w-full sm:w-auto border border-slate-700/50 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Inbox
            </button>
            <button 
              onClick={() => setActiveTab('promotions')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'promotions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Promotions
            </button>
            <button 
              onClick={() => setActiveTab('spam')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'spam' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Spam
            </button>
            <button 
              onClick={() => setActiveTab('social')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'social' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Social
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'all' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All Mail
            </button>
            <button 
              onClick={() => setActiveTab('trash')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${activeTab === 'trash' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              History
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filter by sender..." 
                value={filterSender}
                onChange={(e) => setFilterSender(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="relative hidden md:block">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="pl-10 pr-8 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all">
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>
            <button 
              onClick={() => setFilterUnsub(!filterUnsub)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                filterUnsub 
                  ? 'bg-indigo-900/50 border-indigo-500/50 text-indigo-300' 
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <LinkIcon className="w-4 h-4" /> Unsubscribe Link
            </button>
          </div>
        </div>

        {/* List Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/20">
          <div className="flex items-center gap-4">
            <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-400 transition-colors">
              {selectedIds.size === filteredList.length && filteredList.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-indigo-500" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-sm font-medium text-slate-400">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select All'}
            </span>
          </div>
          
          <div className="text-sm font-medium text-slate-500">
            {filteredList.length} total messages
          </div>
        </div>

        {/* Email List */}
        <div className="relative min-h-[400px] max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
              <p className="font-medium">Syncing your inbox...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                <Inbox className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-lg font-semibold text-slate-300">It's quiet in here.</p>
              <p className="text-sm mt-1 text-slate-500">No emails match your current view.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-700/50">
                <AnimatePresence>
                  {filteredList.map((email) => {
                    const isSelected = selectedIds.has(email.id);
                    return (
                      <motion.li 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={email.id}
                        onClick={() => toggleSelection(email.id)}
                        className={`group flex items-start gap-4 p-4 sm:px-6 hover:bg-slate-800/60 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-900/20' : ''
                        }`}
                      >
                        <div className="pt-2">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-500" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                          )}
                        </div>
                        
                        <div className="flex-shrink-0 pt-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                            activeTab === 'promotions' 
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                              : activeTab === 'social'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : activeTab === 'spam'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {getInitials(email.from)}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <p className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                              {email.from?.split('<')[0].replace(/['"]/g, '').trim()}
                            </p>
                            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                              {formatDate(email.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              activeTab === 'promotions' ? 'bg-indigo-500/20 text-indigo-300' : 
                              activeTab === 'social' ? 'bg-blue-500/20 text-blue-300' : 
                              activeTab === 'spam' ? 'bg-rose-500/20 text-rose-300' : 
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {activeTab}
                            </span>
                            <p className="text-sm font-semibold text-slate-200 truncate">
                              {email.subject || '(No Subject)'}
                            </p>
                          </div>
                          <p className="text-sm text-slate-400 line-clamp-1">
                            {email.snippet}
                          </p>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              {pageTokens[activeTab] && (
                <div className="p-8 flex justify-center border-t border-slate-700/30">
                  <button
                    onClick={() => fetchEmails(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Load More Emails
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Action Button for Bulk Operations */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-slate-800 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 border border-slate-700">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <div className="w-px h-6 bg-slate-700" />
              <button 
                onClick={handleOpenPreview}
                disabled={actionLoading}
                className="flex items-center gap-2 font-semibold hover:text-indigo-400 transition-colors"
              >
                <Search className="w-5 h-5" />
                Preview & Confirm
              </button>
              <div className="w-px h-6 bg-slate-700" />
              {activeTab === 'trash' ? (
                <button 
                  onClick={() => handleUndo(Array.from(selectedIds))}
                  disabled={actionLoading}
                  className="flex items-center gap-2 font-semibold hover:text-emerald-400 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Restore to Inbox
                </button>
              ) : (
                <button 
                  onClick={() => setModalConfig({
                    title: 'Delete Selected Emails',
                    message: `Are you sure you want to move these ${selectedIds.size} emails to trash?`,
                    confirmText: 'Move to Trash',
                    isDanger: true,
                    onConfirm: () => handleBulkDelete(false)
                  })}
                  disabled={actionLoading}
                  className="flex items-center gap-2 font-semibold hover:text-rose-400 transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {createPortal(
        <>
          <ConfirmModal
            isOpen={!!modalConfig}
            title={modalConfig?.title}
            message={modalConfig?.message}
            confirmText={modalConfig?.confirmText}
            isDanger={modalConfig?.isDanger}
            onConfirm={modalConfig?.onConfirm}
            onCancel={() => setModalConfig(null)}
          />

          <div className="fixed bottom-0 right-0 p-6 space-y-4 z-50 pointer-events-none">
            <AnimatePresence>
              {toasts.map(toast => (
                <motion.div key={toast.id} className="pointer-events-auto">
                  <Toast message={toast.message} type={toast.type} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <CleanupSettings 
            isOpen={showSettings} 
            onClose={(saved) => { 
              setShowSettings(false); 
              if(saved) fetchSettingsStatus(); 
            }} 
          />

          <UndoToast
            isOpen={!!undoConfig}
            message={undoConfig?.message}
            onUndo={() => handleUndo(undoConfig?.ids)}
            onClose={() => setUndoConfig(null)}
          />

          <BulkDeletePreview 
            isOpen={showBulkPreview}
            loading={previewLoading}
            previewData={previewData}
            onClose={() => {
              setShowBulkPreview(false);
              setPreviewData(null);
            }}
            onConfirm={(excludeImportant) => {
              setShowBulkPreview(false);
              setPreviewData(null);
              handleBulkDelete(!excludeImportant); 
            }}
          />
        </>,
        document.body
      )}
    </div>
  );
};

export default CleanupDashboard;
