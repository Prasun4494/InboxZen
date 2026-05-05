import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Check, Clock, Mail, ShieldCheck, Loader2, ShieldAlert } from 'lucide-react';

export default function CleanupSettings({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('gmail_token');

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        onClose(true); // pass true to indicate successful save
      }
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => onClose()}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" /> Auto-Cleanup Settings
            </h2>
            <button onClick={() => onClose()} className="p-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {loading || !settings ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-slate-400 mt-4 font-medium">Loading preferences...</p>
              </div>
            ) : (
              <div className="space-y-8">
                
                {/* Master Toggle */}
                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-indigo-100">Enable Automated Cleanup</h3>
                    <p className="text-sm text-indigo-300/70 mt-1">Inbox Zen will run daily at 2:00 AM (your local time) to process your inbox rules.</p>
                  </div>
                  <button 
                    onClick={() => updateSetting('autoCleanupEnabled', !settings.autoCleanupEnabled)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings.autoCleanupEnabled ? 'bg-indigo-500' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.autoCleanupEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Retention Rules */}
                <div className={`space-y-6 ${!settings.autoCleanupEnabled ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" /> Retention Rules
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Keep Promotions (Days)</label>
                        <input 
                          type="number" min="1" 
                          value={settings.promotionsRetentionDays} 
                          onChange={(e) => updateSetting('promotionsRetentionDays', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" 
                        />
                        <p className="text-xs text-slate-500 mt-2">Unread promos older than this will be permanently deleted.</p>
                      </div>

                      <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Keep Spam (Days)</label>
                        <input 
                          type="number" min="1" 
                          value={settings.spamRetentionDays} 
                          onChange={(e) => updateSetting('spamRetentionDays', parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500" 
                        />
                        <p className="text-xs text-slate-500 mt-2">Spam older than this will be permanently deleted.</p>
                      </div>
                    </div>
                  </div>

                  {/* Whitelist */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Safe Senders
                    </h3>
                    <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Never Delete From (comma separated)</label>
                      <textarea 
                        rows="3"
                        value={(settings.whitelistSenders || []).join(', ')} 
                        onChange={(e) => updateSetting('whitelistSenders', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none" 
                        placeholder="boss@company.com, tickets@airline.com"
                      />
                      <p className="text-xs text-slate-500 mt-2">Emails from these domains/addresses will bypass auto-cleanup.</p>
                    </div>
                  </div>

                  {/* Safety Guardrails */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400" /> Safety Guardrails
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-300">Override Recent Protection</h4>
                          <p className="text-xs text-slate-500 mt-1 mb-3">Allow deletion of emails received within the last 24 hours without warning.</p>
                        </div>
                        <button 
                          onClick={() => updateSetting('overrideRecentProtection', !settings.overrideRecentProtection)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.overrideRecentProtection ? 'bg-amber-500' : 'bg-slate-600'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.overrideRecentProtection ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-between">
                        <div>
                          <label className="block font-semibold text-slate-300">Batch Limit & Confirm</label>
                          <p className="text-xs text-slate-500 mt-1 mb-3">Max batch size, and warning threshold.</p>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="number" min="1" max="500" title="Max Batch Limit"
                            value={settings.batchLimit} 
                            onChange={(e) => updateSetting('batchLimit', parseInt(e.target.value) || 200)}
                            className="w-1/2 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" 
                          />
                          <input 
                            type="number" min="1" max="500" title="Confirm Threshold"
                            value={settings.confirmThreshold} 
                            onChange={(e) => updateSetting('confirmThreshold', parseInt(e.target.value) || 50)}
                            className="w-1/2 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-400" /> Notifications
                    </h3>
                    <div className="flex items-center justify-between bg-slate-900/50 border border-slate-700 p-4 rounded-xl">
                      <div>
                        <h4 className="font-semibold text-slate-300">Receive Daily Summary</h4>
                        <p className="text-xs text-slate-500 mt-1">Get a brief email detailing what was cleaned up while you slept.</p>
                      </div>
                      <button 
                        onClick={() => updateSetting('receiveSummaryEmail', !settings.receiveSummaryEmail)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.receiveSummaryEmail ? 'bg-blue-500' : 'bg-slate-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.receiveSummaryEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
            <button 
              onClick={() => onClose()}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || saving}
              className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Preferences
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
