import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Calendar, Tag, ShieldAlert, Trophy, Loader2 } from 'lucide-react';

const COLORS = ['#6366f1', '#f43f5e']; // Indigo for Promos, Rose for Spam

export default function CleanupAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const token = localStorage.getItem('gmail_token');

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/analytics/cleanup-stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch cleanup stats', error);
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const exportToCSV = () => {
    if (!data) return;
    const headers = ['Date', 'Promotions Deleted', 'Spam Deleted'];
    const csvRows = [headers.join(',')];
    
    data.history.forEach(row => {
      csvRows.push(`${row.date},${row.promotions},${row.spam}`);
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanup_analytics_${days}days.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pieData = data ? [
    { name: 'Promotions', value: data.totalPromotions },
    { name: 'Spam', value: data.totalSpam }
  ] : [];

  if (loading && !data) {
    return (
      <div className="glass-panel p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 flex flex-col gap-6 w-full mt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700/50 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" /> Cleanup Insights
          </h2>
          <p className="text-sm text-slate-400 mt-1">Track your inbox decluttering progress.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full pl-10 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase">Promotions Removed</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{data.totalPromotions}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase">Spam Destroyed</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{data.totalSpam}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase">Storage Reclaimed</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{data.storageReclaimed} <span className="text-sm">MB</span></p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase">Frequency</p>
            <p className="text-2xl font-bold text-slate-200 mt-1 text-sm pt-1">{data.cleanupFrequency}</p>
          </div>
        </div>
      )}

      {/* Charts & Leaderboard */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          
          {/* Line Chart */}
          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 p-5 rounded-xl flex flex-col h-[350px]">
            <h3 className="text-sm font-semibold text-white mb-4">Cleanup Activity Over Time</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="promotions" name="Promotions" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="spam" name="Spam" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-6 h-[350px]">
            {/* Donut Chart */}
            <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-xl flex-1 flex flex-col min-h-0">
              <h3 className="text-sm font-semibold text-white mb-2">Category Distribution</h3>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text for donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">{data.totalPromotions + data.totalSpam}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-400" /> Top Spam/Promo Senders
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {data.topSenders.slice(0, 5).map((sender, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                    <span className="text-xs text-slate-300 truncate pr-2 max-w-[70%]">{sender.email}</span>
                    <span className="text-xs font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-md">{sender.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
