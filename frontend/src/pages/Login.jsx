import React from 'react';
import { Mail, Zap, Shield, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function Login() {
  const handleLogin = async () => {
    try {
      const res = await axios.get('http://localhost:3000/auth/google');
      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      alert('Failed to initialize login. Is backend running?');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/30 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 text-center flex flex-col items-center max-w-lg w-full px-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20">
          <Mail className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-5xl font-bold mb-4 tracking-tight text-white">
          Inbox <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Zen.</span>
        </h1>
        <p className="text-slate-400 text-lg mb-10 leading-relaxed">
          Powered with triage that automatically categorizes, drafts responses, and clears the noise from your email.
        </p>

        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={handleLogin}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-blue-600 font-medium rounded-full hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 focus:ring-offset-slate-900 shadow-lg shadow-blue-600/20"
          >
            <span className="mr-2">Sign in with Google</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-slate-500 text-xs">
            Need to use a different email? You'll be able to choose your account.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-8 text-left opacity-80">
          <div className="flex items-start">
            <Zap className="w-6 h-6 text-amber-400 mr-3 shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-white mb-1">Smart Engine</h3>
              <p className="text-sm text-slate-400">Auto-categorizes emails into Urgent, Defer, and FYI.</p>
            </div>
          </div>
          <div className="flex items-start">
            <Shield className="w-6 h-6 text-emerald-400 mr-3 shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-white mb-1">Privacy First</h3>
              <p className="text-sm text-slate-400">Uses official secure Gmail APIs for access.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
