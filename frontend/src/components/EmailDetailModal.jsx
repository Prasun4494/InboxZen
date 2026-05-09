import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Archive, Trash2, Mail, MailOpen, CornerUpLeft, 
  ChevronLeft, ChevronRight, ExternalLink, Shield, 
  ShieldOff, Download, User, Calendar, RefreshCw
} from 'lucide-react';
import DOMPurify from 'dompurify';

/**
 * Modal component for displaying full email details
 */
const EmailDetailModal = ({ isOpen, emailId, onClose, getDetails, onAction }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && emailId) {
      fetchDetails();
    } else {
      setDetails(null);
    }
  }, [isOpen, emailId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDetails(emailId);
      setDetails(data);
    } catch (err) {
      console.error('Error fetching email details', err);
      
      if (err.response?.status === 401) {
        // Session expired or invalid credentials
        localStorage.removeItem('gmail_token');
        window.location.href = '/login';
        return;
      }

      const backendError = err.response?.data?.error;
      const backendDetails = err.response?.data?.details;
      setError(backendDetails ? `${backendError}: ${backendDetails}` : (backendError || 'Failed to load email content. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const sanitizedBody = details?.body ? DOMPurify.sanitize(details.body) : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl h-[85vh] bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="h-8 w-px bg-slate-700" />
                <div className="flex gap-2">
                  <ActionButton icon={<Archive className="w-5 h-5" />} label="Archive" onClick={() => onAction('archive', emailId)} />
                  <ActionButton icon={<Trash2 className="w-5 h-5" />} label="Delete" onClick={() => onAction('delete', emailId)} color="text-rose-400" />
                  <ActionButton icon={<Shield className="w-5 h-5" />} label="Mark Spam" onClick={() => onAction('spam', emailId)} color="text-amber-400" />
                  <ActionButton 
                    icon={details?.isUnread ? <Mail className="w-5 h-5" /> : <MailOpen className="w-5 h-5" />} 
                    label={details?.isUnread ? "Mark as Read" : "Mark as Unread"} 
                    onClick={async () => {
                      const markAsRead = details.isUnread;
                      // Update local state first for instant feedback
                      setDetails(prev => ({ ...prev, isUnread: !markAsRead }));
                      // Call parent action
                      await onAction('toggleRead', emailId, { markAsRead }); 
                    }} 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href={`https://mail.google.com/mail/u/0/#inbox/${details?.id || emailId}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">View in Gmail</span>
                </a>
                <button onClick={onClose} className="p-2 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 font-medium">Decrypting content...</p>
                </div>
              ) : details ? (
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-3xl font-bold text-white mb-8 leading-tight">
                    {details.subject}
                  </h1>

                  <div className="flex items-start gap-4 mb-8 p-4 bg-slate-900/30 rounded-2xl border border-slate-700/50">
                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg">
                      {details.from.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <p className="font-bold text-white truncate">{details.from}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(details.date).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm text-slate-400">To: {details.to}</p>
                    </div>
                  </div>

                  <div 
                    className="email-content bg-white rounded-2xl p-8 text-slate-900 shadow-inner overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: sanitizedBody }}
                  />

                  {/* Action Footer */}
                  <div className="mt-8 flex justify-center gap-4">
                    <button className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg transition-all transform hover:scale-105">
                      <CornerUpLeft className="w-5 h-5" />
                      Reply
                    </button>
                    <button 
                      onClick={() => onAction('addToCalendar', emailId, details)}
                      className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg transition-all transform hover:scale-105"
                    >
                      <Calendar className="w-5 h-5" />
                      Add to Calendar
                    </button>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6">
                  <div className="w-20 h-20 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center">
                    <ShieldOff className="w-10 h-10" />
                  </div>
                  <div className="text-center max-w-sm">
                    <p className="text-lg font-bold text-white mb-2">Decryption Failed</p>
                    <p className="text-sm leading-relaxed">{error}</p>
                    {error.includes('Failed to fetch') && (
                      <p className="text-[10px] text-slate-500 mt-2 italic font-mono">
                        Error ID: {emailId}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={fetchDetails}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Loading
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <ShieldOff className="w-12 h-12 mb-4" />
                  <p>Initializing content viewer...</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ActionButton = ({ icon, label, onClick, color = "text-slate-400" }) => (
  <button 
    onClick={onClick}
    className={`p-2.5 hover:bg-slate-700 rounded-xl transition-all flex flex-col items-center gap-1 group ${color}`}
    title={label}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
      {label}
    </span>
  </button>
);

export default EmailDetailModal;
