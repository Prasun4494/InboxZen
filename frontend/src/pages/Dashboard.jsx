import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Inbox, CheckCircle2, Send, Loader2, Tag, Archive, MessageSquareWarning, UserPlus, ShieldBan, Settings, History, ShieldAlert, BarChart3, LayoutGrid, Clock, ListChecks, CheckCheck, Menu, StickyNote } from 'lucide-react';
import clsx from 'clsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import CleanupDashboard from '../components/CleanupDashboard';
import CleanupAnalytics from '../components/CleanupAnalytics';
import QuickCleanupActions from '../components/QuickCleanupActions';
import PromotionSocialDashboard from '../components/PromotionSocialDashboard';
import EmailDetailModal from '../components/EmailDetailModal';
import CalendarDashboard from '../components/CalendarDashboard';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [fetchingMode, setFetchingMode] = useState('unread'); // 'unread' or 'all'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [editedReplies, setEditedReplies] = useState({});

  const [hasConfirmedSession, setHasConfirmedSession] = useState(false);
  const [pendingReplyData, setPendingReplyData] = useState(null);
  const [replyLogs, setReplyLogs] = useState([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [viewMode, setViewMode] = useState('analytics'); // 'analytics' or 'kanban'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [selectedEmailForModal, setSelectedEmailForModal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [globalRules, setGlobalRules] = useState({
    knownSendersOnly: true,
    maxPerHour: 5,
    timeWindow: true
  });

  const token = localStorage.getItem('gmail_token');
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    fetchEmails();
    fetchUserInfo();
  }, [token, navigate, fetchingMode]);

  const fetchUserInfo = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserEmail(res.data.email);
    } catch (err) {
      console.error('Failed to fetch user info', err);
    }
  };

  const fetchEmails = async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const endpoint = fetchingMode === 'unread' ? '/api/emails/unread' : '/api/emails/all';
      const url = `http://localhost:3000${endpoint}?maxResults=50${isLoadMore && nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const newEmails = Array.isArray(res.data) ? res.data : (res.data.messages || []);
      const tokenFromServer = res.data.nextPageToken || null;

      setEmails(prev => isLoadMore ? [...prev, ...newEmails] : newEmails);
      setNextPageToken(tokenFromServer);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem('gmail_token');
        navigate('/');
      } else {
        // Fallback for demo/dev
        if (!isLoadMore) {
          setEmails([
            { id: '1', threadId: 't1', subject: 'Emergency: Server Outage', from: 'devops@company.com', snippet: 'The production node is down and returning 502 Bad Gateway to all clients since 10 minutes ago...', priority: 'high', category: 'urgent_reply', suggested_action: 'auto_reply', confidence_score: 98, summary: 'Highly critical failure affecting production', autoReply: 'I have received your email. I am logging on immediately. [ACTION_NEEDED]' },
            { id: '2', threadId: 't2', subject: 'Password Reset Request', from: 'support@service.com', snippet: 'Click here to reset your password and access your confidential account...', priority: 'high', category: 'urgent_reply', suggested_action: 'human_reply', confidence_score: 95, summary: 'Safety feature blocked auto-reply due to sensitive context.', autoReply: null },
            { id: '3', threadId: 't3', subject: 'Buy our new software!', from: 'sales@spam.com', snippet: 'Huge discount on our new enterprise software package...', priority: 'low', category: 'spam', suggested_action: 'archive', confidence_score: 95, summary: 'Marketing terminology and discount offer present.', autoReply: null },
          ]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailDetails = async (id) => {
    const res = await axios.get(`http://localhost:3000/api/emails/details/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  };

  const handleEmailClick = (email) => {
    setSelectedEmailForModal(email.id);
    setIsModalOpen(true);
  };

  const handleModalAction = async (action, id, data) => {
    if (action === 'archive') {
      setEmails(prev => prev.filter(e => e.id !== id));
      setIsModalOpen(false);
    } else if (action === 'toggleRead') {
      try {
        await axios.post('http://localhost:3000/api/emails/toggle-read', {
          emailId: id,
          markAsRead: data.markAsRead
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Update the list if needed. If it was marked as read, 
        // and we are in "Unread" view, we might want to remove it from the list.
        if (data.markAsRead) {
           setEmails(prev => prev.filter(e => e.id !== id));
           setIsModalOpen(false);
        }
      } catch (err) {
        console.error('Failed to toggle read status', err);
      }
    } else if (action === 'delete') {
      try {
        await axios.delete('http://localhost:3000/api/emails/bulk/remove', {
          headers: { Authorization: `Bearer ${token}` },
          data: { messageIds: [id] }
        });
        setEmails(prev => prev.filter(e => e.id !== id));
        setIsModalOpen(false);
      } catch (err) {
        console.error('Failed to delete email', err);
      }
    } else if (action === 'addToCalendar') {
      const email = emails.find(e => e.id === id) || { id, subject: data?.subject, snippet: data?.body };
      addToCalendar(email);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gmail_token');
    navigate('/');
  };

  const initiateAction = (email, customReply) => {
    if (email.suggested_action === 'auto_reply' && !hasConfirmedSession) {
      setPendingReplyData({ email, reply: customReply });
    } else {
      executeAction(email, customReply);
    }
  };

  const confirmFirstSessionReply = () => {
    if (pendingReplyData) {
      setHasConfirmedSession(true);
      executeAction(pendingReplyData.email, pendingReplyData.reply);
      setPendingReplyData(null);
    }
  };

  const executeAction = async (email, customReply) => {
    setProcessingId(email.id);
    try {
      if (email.suggested_action === 'auto_reply') {
        const textToSend = customReply !== undefined ? customReply : email.autoReply;
        if (globalRules.timeWindow) {
          const hr = new Date().getHours();
          if (hr < 9 || hr >= 18) {
            alert("Safety Rule: Attempted to auto-reply outside of 9 AM - 6 PM window. Aborting.");
            setProcessingId(null);
            return;
          }
        }
        await axios.post('http://localhost:3000/api/emails/reply', {
          emailId: email.id, replyText: textToSend, to: email.from, subject: email.subject, threadId: email.threadId
        }, { headers: { Authorization: `Bearer ${token}` } });
        setReplyLogs(prev => [{ time: new Date().toLocaleTimeString(), to: email.from, subject: email.subject, text: textToSend }, ...prev]);
      }
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } catch (err) {
      console.error(err);
      if (email.suggested_action === 'auto_reply') {
        const textToSend = customReply !== undefined ? customReply : email.autoReply;
        setReplyLogs(prev => [{ time: new Date().toLocaleTimeString(), to: email.from, subject: email.subject, text: textToSend }, ...prev]);
      }
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } finally {
      setProcessingId(null);
    }
  };

  const executeBulkAction = (actionType) => {
    if (actionType === 'archive_spam') {
      const spamIds = emails.filter(e => e.category === 'spam').map(e => e.id);
      setEmails(prev => prev.filter(e => !spamIds.includes(e.id)));
      alert(`Archived ${spamIds.length} spam emails.`);
    } else if (actionType === 'mark_delegate_read') {
      const delegateIds = emails.filter(e => e.category === 'delegate').map(e => e.id);
      setEmails(prev => prev.filter(e => !delegateIds.includes(e.id)));
      alert(`Marked ${delegateIds.length} delegated items as resolved.`);
    }
  };

  const handleReplyChange = (id, value) => setEditedReplies(prev => ({ ...prev, [id]: value }));
  const handleDismiss = (id) => setEmails(prev => prev.filter(e => e.id !== id));
  const handleDelegate = (id) => setEmails(prev => prev.map(e => e.id === id ? { ...e, priority: 'medium', category: 'delegate', suggested_action: 'human_reply' } : e));
  const handleBlockSender = (id, fromAddress) => {
    alert(`Safety Protocol: Blocked sender ${fromAddress} from future auto-replies.`);
    setEmails(prev => prev.filter(e => e.id !== id));
  };

  const addToCalendar = async (email) => {
    try {
      const details = email.meeting_details || {};
      // Simple parse attempt or use current time if parsing fails
      let startTime = details.date && details.date !== 'TBD' ? new Date(`${details.date} ${details.time !== 'TBD' ? details.time : '10:00 AM'}`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (isNaN(startTime.getTime())) {
        startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default tomorrow
      }
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
      
      const res = await axios.post('http://localhost:3000/api/calendar/add', {
        summary: email.subject,
        description: `Source Email snippet: ${email.snippet}`,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        location: details.location !== 'TBD' ? details.location : '',
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Event successfully added to your Google Calendar!');
      // Mark as handled
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } catch (err) {
      console.error('Failed to add to calendar', err);
      alert('Failed to add to calendar. Please ensure Calendar permission is granted.');
    }
  };

  const handleConvertToTask = (email) => {
    alert(`Converted to Task: ${email.subject}`);
    setEmails(prev => prev.filter(e => e.id !== email.id));
  };

  const handleSaveAsNote = (email) => {
    alert(`Saved as Note: ${email.subject}`);
    setEmails(prev => prev.filter(e => e.id !== email.id));
  };

  const getCategoryColorHex = (cat) => {
    const hexes = { 'urgent_reply': '#f43f5e', 'read_later': '#6366f1', 'delegate': '#f59e0b', 'spam': '#64748b', 'meeting_request': '#10b981' };
    return hexes[cat] || '#94a3b8';
  };

  const getPriorityColor = (prio) => {
    switch (prio) { case 'high': return 'border-rose-500/50 from-rose-500/10 to-transparent'; case 'medium': return 'border-amber-500/50 from-amber-500/10 to-transparent'; case 'low': return 'border-blue-500/50 from-blue-500/10 to-transparent'; default: return 'border-slate-700 from-slate-800 to-transparent'; }
  };

  const getCategoryTheme = (cat) => {
    const themes = { 'urgent_reply': 'bg-rose-500/20 text-rose-300', 'read_later': 'bg-indigo-500/20 text-indigo-300', 'delegate': 'bg-amber-500/20 text-amber-300', 'spam': 'bg-slate-500/20 text-slate-300', 'meeting_request': 'bg-emerald-500/20 text-emerald-300' };
    return themes[cat] || 'bg-slate-700 text-slate-300';
  };

  // KPI Calculations
  const safeEmails = Array.isArray(emails) ? emails.filter(Boolean) : [];
  const processedToday = safeEmails.length + replyLogs.length; 
  const suggestedCount = safeEmails.filter(e => e?.suggested_action === 'auto_reply').length;
  const sentCount = Array.isArray(replyLogs) ? replyLogs.length : 0;
  const timeSavedMins = (sentCount * 5) + ((safeEmails.length + sentCount) * 1); 

  const categoryData = Object.entries(
    safeEmails.reduce((acc, e) => { 
      const cat = e?.category || 'other';
      acc[cat] = (acc[cat] || 0) + 1; 
      return acc; 
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const activeEmails = selectedCategory ? safeEmails.filter(e => e?.category === selectedCategory) : safeEmails;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800/40 border-r border-slate-700/50 flex-col hidden md:flex flex-shrink-0 z-40">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-2 rounded-xl">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">Inbox Zen</h1>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <button 
            onClick={() => setViewMode('analytics')}
            className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm", viewMode === 'analytics' ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}
          >
            <BarChart3 className="w-5 h-5" /> Dashboard
          </button>
          <button 
            onClick={() => setViewMode('kanban')}
            className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm", viewMode === 'kanban' ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}
          >
            <LayoutGrid className="w-5 h-5" /> Kanban
          </button>
          <button 
            onClick={() => setViewMode('cleanup')}
            className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm", viewMode === 'cleanup' ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}
          >
            <CheckCircle2 className="w-5 h-5" /> Cleanup
          </button>
          <button 
            onClick={() => setViewMode('promotion-social')}
            className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm", viewMode === 'promotion-social' ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}
          >
            <Tag className="w-5 h-5" /> Promotions & Social
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm", viewMode === 'calendar' ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")}
          >
            <CalendarIcon className="w-5 h-5" /> Calendar
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-20%] left-[50%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>

        <AnimatePresence>
          {pendingReplyData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4 text-rose-400">
                  <ShieldAlert className="w-8 h-8" />
                  <h2 className="text-xl font-bold text-white">First Reply Check</h2>
                </div>
                <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                  You are about to send your first automated response for this session. Are you sure you want to authorize AI auto-replies?
                </p>
                <div className="flex gap-3">
                  <button onClick={confirmFirstSessionReply} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold transition-colors">Authorize & Send</button>
                  <button onClick={() => setPendingReplyData(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg font-semibold border border-slate-600">Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="px-6 py-4 flex flex-col md:flex-row justify-between items-center z-30 w-full gap-4 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3 md:hidden w-full">
            <Menu className="w-6 h-6 text-slate-400" />
            <span className="text-lg font-bold text-slate-200 capitalize">{viewMode.replace('-', ' ')}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 flex-1">
             <span className="text-xl font-bold text-white capitalize">{viewMode.replace('-', ' ')}</span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <QuickCleanupActions />
            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>
            <button onClick={() => setShowLogs(!showLogs)} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border text-sm font-semibold whitespace-nowrap", showLogs ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700")}>
              <History className="w-4 h-4" /> Logs ({replyLogs.length})
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border text-sm font-semibold whitespace-nowrap", showSettings ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700")}>
              <Settings className="w-4 h-4" /> Safety Rules
            </button>
            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>
            
            <div className="flex items-center gap-2 pl-3 py-1 bg-slate-900/50 rounded-full border border-slate-700/50 ml-1">
              <span className="text-[11px] text-slate-400 font-mono truncate max-w-[120px] hidden lg:block" title={userEmail}>
                {userEmail}
              </span>
              <button 
                onClick={() => setShowLogoutConfirm(true)} 
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-all" 
                title="Sign Out / Switch Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative z-10 w-full custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto p-6">
            {/* Settings / Logs inline */}
          <AnimatePresence>
            {showSettings && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="w-full">
                <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl mb-6 shadow-xl flex flex-col md:flex-row gap-6">
                  <div className="flex bg-slate-900/50 p-3 rounded-xl justify-between flex-1 border border-slate-700/50">
                    <div><h4 className="font-semibold text-slate-200">Address Book Only</h4><p className="text-xs text-slate-400">Auto-reply to known contacts</p></div>
                    <button onClick={() => setGlobalRules({ ...globalRules, knownSendersOnly: !globalRules.knownSendersOnly })} className={clsx("w-12 h-6 rounded-full relative", globalRules.knownSendersOnly ? "bg-indigo-500" : "bg-slate-700")}>
                      <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", globalRules.knownSendersOnly ? "left-7" : "left-1")}></div>
                    </button>
                  </div>
                  <div className="flex bg-slate-900/50 p-3 rounded-xl justify-between flex-1 border border-slate-700/50">
                    <div><h4 className="font-semibold text-slate-200">Office Hours (9to6)</h4><p className="text-xs text-slate-400">Suspend automated texts</p></div>
                    <button onClick={() => setGlobalRules({ ...globalRules, timeWindow: !globalRules.timeWindow })} className={clsx("w-12 h-6 rounded-full relative", globalRules.timeWindow ? "bg-indigo-500" : "bg-slate-700")}>
                      <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", globalRules.timeWindow ? "left-7" : "left-1")}></div>
                    </button>
                  </div>
                  <div className="flex bg-slate-900/50 p-3 rounded-xl flex-col flex-1 border border-slate-700/50">
                    <div className="flex justify-between w-full"><h4 className="font-semibold text-slate-200">Max Replies / Hr</h4><span className="text-indigo-300 text-xs font-bold">{globalRules.maxPerHour}</span></div>
                    <input type="range" min="1" max="20" value={globalRules.maxPerHour} onChange={(e) => setGlobalRules({ ...globalRules, maxPerHour: e.target.value })} className="w-full mt-2" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" /></div>
        ) : viewMode === 'cleanup' ? (
          <CleanupDashboard />
        ) : viewMode === 'promotion-social' ? (
          <PromotionSocialDashboard />
        ) : viewMode === 'calendar' ? (
          <CalendarDashboard />
        ) : viewMode === 'analytics' ? (
          <div className="flex flex-col gap-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-panel p-5 flex flex-col gap-1">
                <div className="text-slate-400 text-sm font-medium flex items-center gap-2"><ListChecks className="w-4 h-4 text-indigo-400" /> Total Processed Today</div>
                <div className="text-3xl font-bold text-white mt-2">{processedToday} <span className="text-sm font-medium text-slate-500">emails</span></div>
              </div>
              <div className="glass-panel p-5 flex flex-col gap-1">
                <div className="text-slate-400 text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /> Time Saved</div>
                <div className="text-3xl font-bold text-emerald-400 mt-2">~{timeSavedMins} <span className="text-sm font-medium text-slate-500">mins</span></div>
                <p className="text-xs text-slate-500 mt-1">Estimating 5m per auto-reply</p>
              </div>
              <div className="glass-panel p-5 flex flex-col gap-1">
                <div className="text-slate-400 text-sm font-medium flex items-center gap-2"><Send className="w-4 h-4 text-blue-400" /> Auto-Replies</div>
                <div className="text-3xl font-bold text-white mt-2">{sentCount} <span className="text-xl text-slate-500">/ {suggestedCount + sentCount}</span></div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${((sentCount) / (suggestedCount + sentCount || 1)) * 100}%` }}></div>
                </div>
              </div>
              <div className="glass-panel p-5 flex flex-col gap-2 justify-center">
                <h3 className="text-slate-400 text-sm font-medium">Quick Bulk Actions</h3>
                <button onClick={() => executeBulkAction('archive_spam')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs py-2 rounded text-slate-300 flex items-center justify-center gap-2 transition-colors"><ShieldBan className="w-3 h-3" /> Archive all Spam</button>
                <button onClick={() => executeBulkAction('mark_delegate_read')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs py-2 rounded text-slate-300 flex items-center justify-center gap-2 transition-colors"><CheckCheck className="w-3 h-3" /> Mark Delegates Read</button>
              </div>
            </div>

            {/* Charts & Interactive Content Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-panel p-5 lg:col-span-1 flex flex-col h-[400px]">
                <h3 className="font-semibold text-white mb-4">Category Breakdown</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getCategoryColorHex(entry.name)}
                          style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))', cursor: 'pointer' }}
                          onClick={() => setSelectedCategory(selectedCategory === entry.name ? null : entry.name)}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#f8fafc' }} />
                    <Legend formatter={(value) => <span className="text-slate-300 cursor-pointer text-xs" onClick={() => setSelectedCategory(selectedCategory === value ? null : value)}>{(value || 'other').replace('_', ' ')}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-center text-slate-500 mt-2">Click chart slices to filter list.</p>
              </div>

              {/* Email List View */}
              <div className="glass-panel p-0 lg:col-span-2 overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                  <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-white">
                      {selectedCategory ? `Viewing ${(selectedCategory || 'other').replace('_', ' ')}` : fetchingMode === 'unread' ? 'Unread Emails' : 'All Emails'}
                      <span className="ml-2 text-xs bg-slate-700 px-2 py-0.5 rounded-full">{activeEmails.length}</span>
                    </h3>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                      <button 
                        onClick={() => setFetchingMode('unread')}
                        className={clsx("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", fetchingMode === 'unread' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300")}
                      >
                        Unread
                      </button>
                      <button 
                        onClick={() => setFetchingMode('all')}
                        className={clsx("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", fetchingMode === 'all' ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-300")}
                      >
                        All
                      </button>
                    </div>
                  </div>
                  {selectedCategory && <button onClick={() => setSelectedCategory(null)} className="text-xs text-indigo-400 hover:underline">Clear Filter</button>}
                </div>
                <div className="flex-1 overflow-y-auto w-full">
                  {activeEmails.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">No emails match this filter.</div>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-700/40">
                      {activeEmails.map(email => {
                        if (!email) return null;
                        return (
                          <div key={email.id} onClick={() => handleEmailClick(email)} className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col gap-2 group cursor-pointer">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-xs text-slate-400 truncate mb-1">{email.from}</span>
                              <h4 className="text-sm font-semibold text-white leading-tight truncate group-hover:text-indigo-300 transition-colors">{email.subject || '(No Subject)'}</h4>
                              <span className={clsx("w-max px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-2", getCategoryTheme(email.category || 'other'))}>
                                {(email.category || 'other').toString().replace('_', ' ')} {email.confidence_score ? `• ${email.confidence_score}% CONF` : ''}
                              </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDismiss(email.id); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-white transition-all bg-slate-800 rounded-lg hover:bg-slate-700" title="Remove from Triage">
                              <Archive className="w-4 h-4" />
                            </button>
                          </div>
                          {email.autoReply ? (
                            <div className="mt-2 bg-indigo-900/10 border border-indigo-500/20 p-2.5 rounded-lg">
                              <div className="flex justify-between items-center">
                                <p className="text-[11px] text-indigo-300 italic flex-1 mr-2">"{email.autoReply}"</p>
                                <div className="flex gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); initiateAction(email); }} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded font-semibold shrink-0">Send Now</button>
                                  {(email.category === 'delegate' || email.category === 'urgent_reply') && <button onClick={(e) => { e.stopPropagation(); handleConvertToTask(email); }} className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-semibold shrink-0">To Task</button>}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2 mt-1">
                               {email.category === 'meeting_request' && <button onClick={(e) => { e.stopPropagation(); addToCalendar(email); }} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded font-semibold shrink-0">Add to Calendar</button>}
                               {(email.category === 'delegate' || email.category === 'urgent_reply') && <button onClick={(e) => { e.stopPropagation(); handleConvertToTask(email); }} className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-semibold shrink-0">Convert to Task</button>}
                               {email.category === 'read_later' && <button onClick={(e) => { e.stopPropagation(); handleSaveAsNote(email); }} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded font-semibold shrink-0">Save as Note</button>}
                            </div>
                          )}
                          </div>
                        );
                      })}
                      
                      {nextPageToken && (
                        <div className="p-4 flex justify-center border-t border-slate-700/30">
                          <button
                            onClick={(e) => { e.stopPropagation(); fetchEmails(true); }}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-all"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Load More
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <CleanupAnalytics />
          </div>
        ) : (
          /* KANBAN VIEW (Legacy Layout) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* ... Skipped mapping to save vertical space, exact same array slice mapping as previous for Kanban ... */}
            {[{ id: 'high', title: 'High Priority 🔥' }, { id: 'medium', title: 'Medium Priority ⚡' }, { id: 'low', title: 'Low Priority 🧊' }].map(col => {
              const colEmails = emails.filter(e => e.priority === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-4">
                  <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/50 flex justify-between items-center mt-2 sticky top-0 z-20 backdrop-blur-md">
                    <h2 className="font-semibold text-white">{col.title}</h2>
                    <span className="bg-slate-900 text-slate-300 py-1 px-3 rounded-full text-xs font-bold">{colEmails.length}</span>
                  </div>
                  <AnimatePresence>
                    {colEmails.map(email => (
                      <motion.div 
                        layout 
                        key={email.id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        onClick={() => handleEmailClick(email)}
                        className={clsx("bg-gradient-to-b border rounded-2xl p-5 shadow-2xl relative flex flex-col gap-3 cursor-pointer hover:scale-[1.02] transition-transform", getPriorityColor(email.priority))}
                      >
                        <div className="flex justify-between items-start"><span className={clsx("px-2 py-1 rounded text-[10px] font-bold uppercase", getCategoryTheme(email.category))}>{email.category.replace('_', ' ')}</span></div>
                        <div><h3 className="text-base font-semibold text-white mb-1">{email.subject}</h3><p className="text-xs font-medium text-slate-400 mb-2">{email.from}</p><p className="text-sm text-slate-300 line-clamp-2">{email.snippet}</p></div>
                        <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded-xl mt-auto"><p className="text-xs text-indigo-300 font-medium italic">🤖 "{email.summary}"</p></div>
                        <div className="pt-2 mt-1 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                          {(email.suggested_action === 'auto_reply') && email.autoReply ? (
                            <div className="bg-slate-900/40 border border-indigo-500/30 rounded-lg p-3 w-full">
                              <textarea className="w-full bg-slate-800 text-slate-200 text-xs p-2 rounded border border-slate-700/50 focus:border-indigo-400 outline-none resize-none mb-2" rows="3" value={editedReplies[email.id] !== undefined ? editedReplies[email.id] : email.autoReply} onChange={(e) => handleReplyChange(email.id, e.target.value)} />
                              <div className="flex gap-2">
                                <button onClick={() => initiateAction(email, editedReplies[email.id])} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-md text-xs font-semibold flex justify-center items-center gap-1"><Send className="w-3 h-3" /> Send</button>
                                <button onClick={() => handleConvertToTask(email)} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded-md text-xs font-semibold flex justify-center items-center gap-1"><CheckCheck className="w-3 h-3" /> To Task</button>
                              </div>
                            </div>
                          ) : email.category === 'meeting_request' ? (
                            <button onClick={() => addToCalendar(email)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-semibold flex justify-center items-center gap-1"><CalendarIcon className="w-3 h-3" /> Add to Calendar</button>
                          ) : email.category === 'delegate' || email.category === 'urgent_reply' ? (
                            <button onClick={() => handleConvertToTask(email)} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-xs font-semibold flex justify-center items-center gap-1"><CheckCheck className="w-3 h-3" /> Convert to Task</button>
                          ) : email.category === 'read_later' ? (
                            <button onClick={() => handleSaveAsNote(email)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-semibold flex justify-center items-center gap-1"><StickyNote className="w-3 h-3" /> Save as Note</button>
                          ) : (
                            <button onClick={() => handleDismiss(email.id)} className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-xs font-semibold flex justify-center items-center gap-1"><Archive className="w-3 h-3" /> Archive</button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
          </div>
        </main>
      </div>

      <EmailDetailModal 
        isOpen={isModalOpen} 
        emailId={selectedEmailForModal} 
        onClose={() => setIsModalOpen(false)} 
        getDetails={fetchEmailDetails}
        onAction={handleModalAction}
      />

      {createPortal(
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                onClick={() => setShowLogoutConfirm(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-6">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Sign Out?</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Are you sure you want to sign out of <span className="text-slate-200 font-semibold">{userEmail}</span>?
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors border border-slate-600"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
