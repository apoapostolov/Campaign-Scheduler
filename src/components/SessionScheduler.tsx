import { useState, useEffect } from 'react';
import { GameSession, Campaign } from '../types';
import { Calendar, Clock, RotateCcw, Send, CalendarPlus2, AlertCircle } from 'lucide-react';

interface SessionSchedulerProps {
  campaign: Campaign;
  activeSession: GameSession | null;
  currentUserId: string | null;
  onSyncCalendarPlayer: () => Promise<void>;
  isSyncingPlayer: boolean;
  currentPlayerHasSyncEnabled: boolean;
  onSendPreGameSummary: () => Promise<void>;
  isSendingSummary: boolean;
}

export default function SessionScheduler({
  campaign,
  activeSession,
  currentUserId,
  onSyncCalendarPlayer,
  isSyncingPlayer,
  currentPlayerHasSyncEnabled,
  onSendPreGameSummary,
  isSendingSummary,
}: SessionSchedulerProps) {
  const [countdownText, setCountdownText] = useState<string>('');

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'scheduled') {
      setCountdownText('');
      return;
    }

    const intervalId = setInterval(() => {
      const gameTime = new Date(activeSession.scheduledDateTime).getTime();
      const now = new Date().getTime();
      const diff = gameTime - now;

      if (diff <= 0) {
        setCountdownText('Session is starting now! Grab your dice!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let text = 'Commencing in ';
      if (days > 0) text += `${days} days, `;
      text += `${hours}h ${minutes}m`;
      setCountdownText(text);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSession]);

  const DAY_ENGLISH_LABEL: Record<string, string> = {
    'понеделник': 'Monday', 'monday': 'Monday',
    'вторник': 'Tuesday', 'tuesday': 'Tuesday',
    'сряда': 'Wednesday', 'wednesday': 'Wednesday',
    'четвъртък': 'Thursday', 'thursday': 'Thursday',
    'петък': 'Friday', 'friday': 'Friday',
    'събота': 'Saturday', 'saturday': 'Saturday',
    'неделя': 'Sunday', 'sunday': 'Sunday'
  };

  const getDayEnglishLabel = (day: string) => {
    const dayNameLower = day.toLowerCase();
    return DAY_ENGLISH_LABEL[dayNameLower] || day;
  };

  const getDayOfWeekEnglish = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const enDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return enDays[d.getDay()];
    } catch {
      return '';
    }
  };

  const getFormattedDateString = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!activeSession) {
    return (
      <div id="session-scheduler-empty" className="bg-white border border-neutral-200 rounded-lg p-5 mb-6 text-center shadow-sm">
        <Calendar className="text-emerald-600 mx-auto mb-2 opacity-60" size={24} />
        <h3 className="text-neutral-800 font-bold text-sm mb-1">No Active Game Session Proposed Yet</h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto">
          DMs can propose days or finalize a schedule time below through the DM Dashboard controls.
        </p>
      </div>
    );
  }

  const isScheduled = activeSession.status === 'scheduled';
  const isProposed = activeSession.status === 'proposed';

  return (
    <div id={`active-session-card-${activeSession.id}`} className="bg-white border border-neutral-200 rounded-lg p-5 mb-6 shadow-sm relative overflow-hidden">
      {/* Decorative pulse glow for finalized sessions */}
      {isScheduled && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-neutral-800 tracking-tight">
              🗡️ Game Session Details
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${
                isScheduled
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {activeSession.status.toUpperCase()}
            </span>
          </div>

          <p className="text-xs text-neutral-500">
            Current schedule coordinates for campaign <strong className="text-neutral-700">{campaign.name}</strong>.
          </p>
        </div>

        {/* Action Controls for players resembling Workspace menus */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {currentUserId && currentPlayerHasSyncEnabled && isScheduled && (
            <button
              onClick={onSyncCalendarPlayer}
              disabled={isSyncingPlayer}
              id="player-calendar-sync-btn"
              className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-750 text-white font-bold py-1.5 px-3 rounded shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <CalendarPlus2 size={13} className={isSyncingPlayer ? 'animate-bounce' : ''} />
              {isSyncingPlayer ? 'Syncing...' : 'Sync to My Calendar'}
            </button>
          )}

          {currentUserId && isScheduled && (
            <button
              onClick={onSendPreGameSummary}
              disabled={isSendingSummary}
              id="dm-pregame-summary-btn"
              className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 font-bold py-1.5 px-3 rounded shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Force dispatch the pre-game briefing checklist notification to DM via Gmail link"
            >
              <Send size={13} className="text-neutral-500" />
              {isSendingSummary ? 'Sending Bulletin...' : 'Email DM Briefing Now'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
        <div id="session-time-summary" className="flex items-start gap-2.5 bg-neutral-50 p-3 rounded border border-neutral-150">
          <Clock className="text-emerald-600 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider font-mono">Date & Hour Projections</p>
            {isScheduled ? (
              <>
                <p className="text-xs font-bold text-neutral-800 mt-1">
                  {getFormattedDateString(activeSession.scheduledDateTime)}
                </p>
                 <p className="text-[10px] text-emerald-700 mt-0.5 font-mono">
                  Day of Week: {getDayOfWeekEnglish(activeSession.scheduledDateTime)}
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold text-neutral-400 mt-1">
                Awaiting finalized confirmation from Dungeon Master.
              </p>
            )}
          </div>
        </div>

        {isProposed && activeSession.proposedDays && activeSession.proposedDays.length > 0 && (
          <div id="session-proposed-days" className="flex items-start gap-2.5 bg-neutral-50 p-3 rounded border border-neutral-150">
            <Clock className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider font-mono">Proposed Options</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {activeSession.proposedDays.map(day => (
                  <span key={day} className="text-[11px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 border border-amber-200 rounded">
                    {getDayEnglishLabel(day)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {isScheduled && countdownText && (
          <div id="session-countdown-card" className="flex items-start gap-2.5 bg-emerald-50/40 p-3 rounded border border-emerald-150 col-span-1 md:col-span-2">
            <AlertCircle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider font-mono">Combat Counter</p>
              <p className="text-xs font-bold text-emerald-800 mt-0.5 font-mono">
                {countdownText}
              </p>
            </div>
          </div>
        )}
      </div>

      {currentPlayerHasSyncEnabled ? (
         <div className="text-[10px] text-emerald-700 mt-3.5 pt-2 flex items-center gap-1.5 opacity-90 border-t border-neutral-100 font-medium">
           <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block block"></span>
           Automated Google Calendar synchronizations enabled for Gmail user in settings
         </div>
      ) : (
         <div className="text-[10px] text-neutral-400 mt-3.5 pt-2 flex items-center gap-1.5 opacity-90 border-t border-neutral-100">
           <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 inline-block block"></span>
           Provide a Gmail account in top account settings to turn on seamless one-click Google Calendar synced entries.
         </div>
      )}
    </div>
  );
}
