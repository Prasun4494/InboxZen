import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, Trash2 } from 'lucide-react';

export default function UndoToast({ isOpen, message, onUndo, onClose, durationMs = 10000 }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) return;
    setProgress(100);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onClose();
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]"
      >
        <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl overflow-hidden min-w-[300px]">
          <div className="px-6 py-4 flex items-center gap-4">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-full">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="font-medium text-white flex-1">{message}</span>
            <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
              <button 
                onClick={() => { onUndo(); onClose(); }}
                className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Undo
              </button>
              <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 transition-colors ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="h-1 bg-slate-700 w-full">
            <div 
              className="h-full bg-indigo-500 transition-all ease-linear" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
