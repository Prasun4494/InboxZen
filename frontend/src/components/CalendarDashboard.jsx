import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CalendarDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMockData, setIsMockData] = useState(false);

  const token = localStorage.getItem('gmail_token');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/calendar/upcoming', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data.events);
      if (res.data.isMock) setIsMockData(true);
    } catch (err) {
      console.error('Failed to fetch events', err);
      const details = err.response?.data?.details || '';
      setError(
        details.includes('Google Calendar API has not been used') 
        ? 'Google Calendar API is not enabled in your Google Cloud Project. Please enable it in the GCP Console.'
        : 'Failed to load your calendar events. You likely need to re-authorize the app to grant Calendar permissions.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReauthorize = () => {
    localStorage.removeItem('gmail_token');
    window.location.href = '/';
  };

  const formatEventDate = (event) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    if (!start) return 'No Time Specified';
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const dateStr = startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    
    // If it's an all-day event (only date, no dateTime)
    if (event.start.date) return `${dateStr} (All Day)`;
    
    const timeStr = startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + 
                   ' - ' + 
                   endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                   
    return `${dateStr}, ${timeStr}`;
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto min-h-screen">
      <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 shadow-2xl flex-1">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-700/50">
          <div className="bg-indigo-500/20 p-3 rounded-xl text-indigo-400">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              Upcoming Meetings
              {isMockData && (
                <span className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg uppercase tracking-wider font-bold">
                  Mock Data (API Disabled)
                </span>
              )}
            </h2>
            <p className="text-slate-400 text-sm">Your schedule fetched directly from Google Calendar</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400">Syncing with Google Calendar...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 bg-rose-500/5 rounded-2xl border border-rose-500/20">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-white mb-2 text-center max-w-md">{error}</p>
            {!error.includes('not enabled') && (
              <p className="text-sm text-slate-400 text-center mb-8 max-w-md">
                We recently added Calendar integration, which requires new permissions that your current session doesn't have.
              </p>
            )}
            <button 
              onClick={handleReauthorize}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Sign Out & Re-authorize
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <CalendarIcon className="w-16 h-16 opacity-20 mx-auto mb-4" />
            <p className="text-lg font-medium">No upcoming meetings scheduled.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 flex flex-col hover:border-indigo-500/50 transition-colors"
              >
                <h3 className="font-bold text-white text-lg mb-3 line-clamp-2">{event.summary || 'Untitled Event'}</h3>
                
                <div className="space-y-2 mb-6 flex-1">
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <Clock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{formatEventDate(event)}</span>
                  </div>
                  
                  {event.location && (
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1" title={event.location}>{event.location}</span>
                    </div>
                  )}
                  
                  {event.attendees && event.attendees.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>{event.attendees.length} participant(s)</span>
                    </div>
                  )}
                </div>
                
                <a 
                  href={event.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-center rounded-lg text-sm font-semibold transition-colors"
                >
                  View in Calendar
                </a>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
