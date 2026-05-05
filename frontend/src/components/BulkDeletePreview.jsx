import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Trash2, ChevronDown, ChevronUp, ShieldCheck, Mail, Calendar, User } from 'lucide-react';

export default function BulkDeletePreview({ isOpen, onClose, onConfirm, previewData, loading }) {
  const [confirmText, setConfirmText] = useState('');
  const [viewAll, setViewAll] = useState(false);
  const [excludeImportant, setExcludeImportant] = useState(false);

  if (!isOpen) return null;

  const isDeleteConfirmed = confirmText.toUpperCase() === 'DELETE';
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Confirm Bulk Deletion
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 mt-4 font-medium">Preparing preview...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase font-bold">Total Emails</p>
                    <p className="text-2xl font-bold text-white">{previewData?.totalCount || 0}</p>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase font-bold">Estimated Space to Free</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatSize(previewData?.totalSizeEstimate)}</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex gap-4">
                  <ShieldCheck className="w-6 h-6 text-rose-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-rose-300">Permanent Action</h4>
                    <p className="text-sm text-rose-300/70">These emails will be moved to trash. You can undo this for a limited time, but after that they will be permanently gone.</p>
                  </div>
                </div>

                {/* Email Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Preview (Top 10)</h3>
                    <button 
                      onClick={() => setViewAll(!viewAll)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                    >
                      {viewAll ? 'Show Less' : 'Show More'} {viewAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className={`space-y-2 ${!viewAll ? 'max-h-48 overflow-hidden' : ''} transition-all duration-300`}>
                    {previewData?.samples?.map((msg, idx) => (
                      <div key={idx} className="bg-slate-900/30 border border-slate-700/50 p-3 rounded-xl flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                            <User className="w-3 h-3" /> {msg.from}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(msg.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-white font-medium truncate flex items-center gap-2">
                          <Mail className="w-3 h-3 text-slate-500" /> {msg.subject}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exclude Senders */}
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700 p-4 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="exclude" 
                    checked={excludeImportant}
                    onChange={(e) => setExcludeImportant(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <label htmlFor="exclude" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Exclude important senders (respect Address Book & Whitelist)
                  </label>
                </div>

                {/* Typing Confirmation */}
                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">Type <span className="text-white font-bold">DELETE</span> below to confirm this operation.</p>
                  <input 
                    type="text" 
                    placeholder="Type DELETE to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-colors uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors">
              Cancel
            </button>
            <button 
              onClick={() => onConfirm(excludeImportant)}
              disabled={loading || !isDeleteConfirmed}
              className="px-6 py-2.5 rounded-xl font-medium text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Bulk Delete Now
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
