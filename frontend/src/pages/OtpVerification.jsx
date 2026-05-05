import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Loader2, Mail } from 'lucide-react';

export default function OtpVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tempId = searchParams.get('tempId');
  const email = searchParams.get('email');
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:3000/auth/verify-otp', {
        tempId,
        otp: otpString
      });
      
      localStorage.setItem('gmail_token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verify Your Identity</h1>
          <p className="text-slate-400 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Check {email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-bold text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                required
              />
            ))}
          </div>

          {error && (
            <p className="text-rose-400 text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <span>Complete Login</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Didn't receive the code? <button className="text-blue-400 hover:underline font-medium" onClick={() => window.location.reload()}>Resend</button>
        </p>
      </motion.div>
    </div>
  );
}
