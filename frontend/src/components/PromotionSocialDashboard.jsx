import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tag, UserPlus, Search, Filter, Mail, Archive, Trash2, 
  RefreshCw, CheckCircle2, ChevronRight, Inbox, 
  BarChart3, Clock, AlertTriangle, ChevronDown, CheckSquare, Square
} from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';
import { usePromotionSocial } from '../hooks/usePromotionSocial';
import EmailDetailModal from './EmailDetailModal';
import UndoToast from './UndoToast';

/**
 * Advanced Dashboard for Promotional and Social Emails
 */
const PromotionSocialDashboard = () => {
  const { emails, loading, error, nextPageToken, stats, fetchEmails, fetchStats, getEmailDetails } = usePromotionSocial();
  
  const [activeTab, setActiveTab] = useState('promotions');
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [undoToast, setUndoToast] = useState({ isOpen: false, message: '', ids: [] });

  useEffect(() => {
    fetchStats();
    fetchEmails(activeTab, { maxResults: 25 });
  }, [activeTab, fetchEmails, fetchStats]);

  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           email.from.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRead = readFilter === 'all' || 
                         (readFilter === 'unread' && email.isUnread) || 
                         (readFilter === 'read' && !email.isUnread);
      return matchesSearch && matchesRead;
    });
  }, [emails, searchQuery, readFilter]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedEmails(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedEmails);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEmails(next);
  };

  const handleOpenEmail = (id) => {
    setSelectedEmailId(id);
    setIsModalOpen(true);
  };

  const handleAction = async (action, id, data) => {
    if (action === 'toggleRead') {
      try {
        const token = localStorage.getItem('gmail_token');
        await axios.post('http://localhost:3000/api/emails/toggle-read', {
          emailId: id,
          markAsRead: data.markAsRead
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // In this view, we can just let it be, or refresh the list.
        // For now, let's just close the modal if it was marked as read
        // or keep it open if the user wants to toggle back and forth?
        // Usually, the modal state is updated locally in EmailDetailModal anyway.
      } catch (err) {
        console.error('Failed to toggle read status', err);
      }
      return;
    }

    if (action === 'delete') {
      try {
        const token = localStorage.getItem('gmail_token');
        const idsToDelete = id ? [id] : Array.from(selectedEmails);
        
        const response = await axios.delete('http://localhost:3000/api/emails/bulk/remove', {
          headers: { Authorization: `Bearer ${token}` },
          data: { messageIds: idsToDelete }
        });
        
        fetchEmails(activeTab);
        fetchStats();
        
        setUndoToast({
          isOpen: true,
          message: response.data.message || `Moved ${idsToDelete.length} emails to trash`,
          ids: idsToDelete
        });
        
        if (!id) setSelectedEmails(new Set());
        setIsModalOpen(false);
      } catch (err) {
        console.error('Failed to delete emails', err);
        alert(err.response?.data?.error || 'Failed to delete emails');
      }
      return;
    }

    if (action === 'spam') {
      try {
        const token = localStorage.getItem('gmail_token');
        await axios.post('http://localhost:3000/api/emails/mark-spam', {
          emailId: id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        fetchEmails(activeTab);
        fetchStats();
        
        setUndoToast({
          isOpen: true,
          message: 'Email marked as spam',
          ids: [id]
        });
        
        setIsModalOpen(false);
      } catch (err) {
        console.error('Failed to mark email as spam', err);
        alert('Failed to mark email as spam');
      }
      return;
    }

    // In a real app, this would call specific API endpoints
    alert(`Action: ${action} on ${id || 'selected items'}`);
    if (!id) setSelectedEmails(new Set());
    setIsModalOpen(false);
  };

  const handleUndo = async () => {
    if (!undoToast.ids || undoToast.ids.length === 0) return;
    try {
      const token = localStorage.getItem('gmail_token');
      await axios.post('http://localhost:3000/api/emails/bulk/untrash', {
        messageIds: undoToast.ids
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmails(activeTab);
      fetchStats();
      setUndoToast({ isOpen: false, message: '', ids: [] });
    } catch (err) {
      console.error('Failed to undo', err);
      alert('Failed to undo deletion.');
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto p-4 md:p-8 min-h-screen">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Tag className="w-6 h-6" />} 
          label="Total Promotions" 
          value={stats.promotions} 
          color="bg-indigo-500/20 text-indigo-400" 
        />
        <StatCard 
          icon={<UserPlus className="w-6 h-6" />} 
          label="Social Updates" 
          value={stats.social} 
          color="bg-blue-500/20 text-blue-400" 
        />
        <StatCard 
          icon={<BarChart3 className="w-6 h-6" />} 
          label="Efficiency Score" 
          value="98%" 
          color="bg-emerald-500/20 text-emerald-400" 
        />
      </div>

      {/* Main Container */}
      <div className="glass-panel overflow-hidden flex flex-col min-h-[700px] border border-slate-700/50 shadow-2xl">
        {/* Header / Tabs */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl w-full md:w-auto">
            <TabButton 
              active={activeTab === 'promotions'} 
              onClick={() => handleTabChange('promotions')}
              icon={<Tag className="w-4 h-4" />}
              label="Promotions"
            />
            <TabButton 
              active={activeTab === 'social'} 
              onClick={() => handleTabChange('social')}
              icon={<UserPlus className="w-4 h-4" />}
              label="Social"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search senders or subjects..."
                className="w-full pl-12 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors">
              <Filter className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedEmails.size > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 py-3 bg-indigo-600/20 border-b border-indigo-500/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-indigo-300">{selectedEmails.size} Selected</span>
                <div className="h-4 w-px bg-indigo-500/30" />
                <button onClick={() => handleAction('archive')} className="text-sm font-semibold hover:text-white transition-colors flex items-center gap-1">
                  <Archive className="w-4 h-4" /> Archive
                </button>
                <button onClick={() => handleAction('delete')} className="text-sm font-semibold hover:text-rose-400 transition-colors flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
              <button onClick={() => setSelectedEmails(new Set())} className="text-xs font-bold uppercase text-indigo-400 hover:text-white transition-colors">
                Deselect All
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {loading && emails.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 font-medium">Syncing {activeTab}...</p>
            </div>
          ) : error ? (
            <div className="p-20 flex flex-col items-center justify-center text-rose-400 gap-4">
              <AlertTriangle className="w-12 h-12" />
              <p className="font-bold">{error}</p>
              <button onClick={() => fetchEmails(activeTab)} className="px-6 py-2 bg-rose-500/20 rounded-xl hover:bg-rose-500/30 transition-all">Retry</button>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-500 gap-4">
              <Inbox className="w-16 h-16 opacity-20" />
              <p className="text-lg font-medium">No {activeTab} found</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-700/30">
              {filteredEmails.map((email) => (
                <EmailRow 
                  key={email.id}
                  email={email}
                  selected={selectedEmails.has(email.id)}
                  onSelect={() => toggleSelect(email.id)}
                  onClick={() => handleOpenEmail(email.id)}
                />
              ))}
              {nextPageToken && (
                <div className="p-8 flex justify-center">
                  <button 
                    onClick={() => fetchEmails(activeTab, { pageToken: nextPageToken }, true)}
                    className="px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-bold flex items-center gap-2 transition-all"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email Detail Modal */}
      <EmailDetailModal 
        isOpen={isModalOpen}
        emailId={selectedEmailId}
        onClose={() => setIsModalOpen(false)}
        getDetails={getEmailDetails}
        onAction={handleAction}
      />

      <UndoToast
        isOpen={undoToast.isOpen}
        message={undoToast.message}
        onUndo={handleUndo}
        onClose={() => setUndoToast(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="glass-panel p-6 flex items-center gap-6 border border-slate-700/50 shadow-lg group hover:bg-slate-800/50 transition-all duration-300">
    <div className={clsx("p-4 rounded-2xl transition-all duration-300 group-hover:scale-110", color)}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  </div>
);

const TabButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={clsx(
      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
    )}
  >
    {icon}
    {label}
  </button>
);

const EmailRow = ({ email, selected, onSelect, onClick }) => (
  <div 
    className={clsx(
      "group flex items-center gap-4 px-6 py-5 cursor-pointer transition-all hover:bg-indigo-500/5",
      selected ? "bg-indigo-500/10" : ""
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-4" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {selected ? <CheckSquare className="w-5 h-5 text-indigo-500" /> : <Square className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />}
    </div>

    <div className="flex-shrink-0">
      <img 
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(email.from)}&background=random&color=fff&size=128&bold=true`}
        alt={email.from}
        className="w-12 h-12 rounded-2xl shadow-lg border-2 border-slate-700 group-hover:border-indigo-500/50 transition-all"
      />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center gap-2 mb-1">
        <p className={clsx("text-sm font-bold truncate", email.isUnread ? "text-white" : "text-slate-400")}>
          {email.from.split('<')[0].replace(/['"]/g, '').trim()}
        </p>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter whitespace-nowrap">
          {new Date(email.date).toLocaleDateString()}
        </p>
      </div>
      <h3 className={clsx("text-sm truncate mb-1", email.isUnread ? "text-slate-100 font-bold" : "text-slate-400 font-medium")}>
        {email.subject}
      </h3>
      <p className="text-xs text-slate-500 line-clamp-1 group-hover:text-slate-300 transition-colors">
        {email.snippet}
      </p>
    </div>

    <div className="flex flex-col items-end gap-2">
      <span className={clsx(
        "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
        email.category === 'Promotion' ? "bg-indigo-500/20 text-indigo-400" : "bg-blue-500/20 text-blue-400"
      )}>
        {email.category}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <button className="p-1.5 hover:text-indigo-400"><Archive className="w-4 h-4" /></button>
        <button className="p-1.5 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  </div>
);

export default PromotionSocialDashboard;
