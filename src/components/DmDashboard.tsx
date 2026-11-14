import React, { useState, useEffect } from 'react';
import { Campaign, GameSession } from '../types';
import { Shield, Sparkles, CheckSquare, Settings, ShieldAlert, RotateCcw } from 'lucide-react';

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

interface DmDashboardProps {
  campaign: Campaign;
  activeSession: GameSession | null;
  onUpdateCampaignSettings: (updatedFields: Partial<Campaign>) => Promise<void>;
  onProposeSession: (proposedDays: string[]) => Promise<void>;
  onFinalizeSession: (dateTimeStr: string) => Promise<void>;
  onClearSession: () => Promise<void>;
  onAddRosterPlayer: (playerName: string) => Promise<void>;
  onRemoveRosterPlayer: (userId: string) => Promise<void>;
  roster: { userId: string; playerName: string }[];
  isSubmitting: boolean;
}

export default function DmDashboard({
  campaign,
  activeSession,
  onUpdateCampaignSettings,
  onProposeSession,
  onFinalizeSession,
  onClearSession,
  isSubmitting,
}: DmDashboardProps) {
  // Propose day selections
  const [selectedPropsDays, setSelectedPropsDays] = useState<string[]>([]);
  // Time selectors
  const [finalizeDateTime, setFinalizeDateTime] = useState<string>('');

  // Local settings fields
  const [localCampaignName, setLocalCampaignName] = useState(campaign.name);
  const [localWeekRange, setLocalWeekRange] = useState(campaign.currentWeekRange);
  const [localDesignatedSessionDay, setLocalDesignatedSessionDay] = useState(campaign.designatedSessionDay || 'Неделя');

  // Sync state if initial campaign prop changes
  useEffect(() => {
    setLocalCampaignName(campaign.name);
    setLocalWeekRange(campaign.currentWeekRange);
    setLocalDesignatedSessionDay(campaign.designatedSessionDay || 'Неделя');
  }, [campaign.name, campaign.currentWeekRange, campaign.designatedSessionDay]);

  const toggleProposedDay = (day: string) => {
    if (selectedPropsDays.includes(day)) {
      setSelectedPropsDays(selectedPropsDays.filter(d => d !== day));
    } else {
      setSelectedPropsDays([...selectedPropsDays, day]);
    }
  };

  const handlePropose = () => {
    if (selectedPropsDays.length === 0) {
      alert('Please choose at least one day to propose candidate slots.');
      return;
    }
    onProposeSession(selectedPropsDays);
  };

  const handleFinalize = () => {
    if (!finalizeDateTime) {
      alert('Please choose a valid schedule Date & Time.');
      return;
    }
    
    const confirmed = window.confirm(
      `Synchronize target schedule with Google Calendar?\n\nThis will insert a scheduled gaming session in your GCal at "${new Date(finalizeDateTime).toLocaleString()}" and trigger visual reminders. Coordinate?`
    );
    if (confirmed) {
      onFinalizeSession(finalizeDateTime);
    }
  };

  const handleSaveCampaignSettings = async () => {
    if (!localCampaignName.trim()) {
       alert('Campaign Title cannot be empty');
       return;
    }
    await onUpdateCampaignSettings({
      name: localCampaignName.trim(),
      currentWeekRange: localWeekRange.trim(),
      designatedSessionDay: localDesignatedSessionDay,
    });
    alert('Campaign details updated!');
  };

  const handleIncrementSession = () => {
    onUpdateCampaignSettings({ sessionCounter: campaign.sessionCounter + 1 });
  };

  const handleDecrementSession = () => {
    if (campaign.sessionCounter <= 0) return;
    onUpdateCampaignSettings({ sessionCounter: campaign.sessionCounter - 1 });
  };

  return (
    <div id="dm-dashboard-container" className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-amber-50/20 w-32 h-32 pointer-events-none rounded-bl-full" />

      {/* Title block */}
      <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-neutral-100">
        <div className="bg-amber-50 p-1.5 rounded border border-amber-200 shrink-0">
          <Shield className="text-amber-800" size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-neutral-800 uppercase tracking-tight">
            DM Management Desk
          </h2>
          <p className="text-[10px] text-amber-700 font-bold font-mono uppercase tracking-wide">
            Dungeon Master controls for {campaign.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Section 1: Session Actions */}
        <div className="space-y-4">
          {/* Propose Days block */}
          <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-lg space-y-2.5">
            <h3 className="text-neutral-850 text-xs font-bold uppercase tracking-tight flex items-center gap-1">
              <Sparkles size={13} className="text-amber-600 shrink-0" />
              Propose Day Alternatives
            </h3>
            <p className="text-[11px] text-neutral-500 leading-normal">
              Toggle options to list multiple candidate days in the scheduler header.
            </p>

            <div className="flex flex-wrap gap-1 font-mono">
              {campaign.daysTracked.map(day => {
                const isSelected = selectedPropsDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleProposedDay(day)}
                    className={`px-2 py-0.5 text-[10px] border rounded font-semibold cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-bold'
                        : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    {getDayEnglishLabel(day)}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handlePropose}
              disabled={isSubmitting}
              className="w-full text-xs font-bold py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors mt-2"
            >
              Publish Proposed Candidates
            </button>
          </div>

          {/* Finalize Schedule block */}
          <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-lg space-y-2.5">
            <h3 className="text-neutral-850 text-xs font-bold uppercase tracking-tight flex items-center gap-1">
              <CheckSquare size={13} className="text-emerald-600 shrink-0" />
              Lock-in Final Target
            </h3>
            <p className="text-[11px] text-neutral-500 leading-normal">
              Finalize date & time to sync calendar events and trigger combat counters.
            </p>

            <div>
              <label className="block text-[9px] text-neutral-500 uppercase font-bold mb-1">Target Date / Hour</label>
              <input
                type="datetime-local"
                value={finalizeDateTime}
                onChange={(e) => setFinalizeDateTime(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleFinalize}
                disabled={isSubmitting || !finalizeDateTime}
                className="flex-1 text-xs font-bold py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors disabled:opacity-40"
              >
                🏁 Finalize Schedule
              </button>

              {activeSession && (
                <button
                  onClick={onClearSession}
                  disabled={isSubmitting}
                  className="bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200 px-2.5 rounded cursor-pointer transition-colors border-dashed"
                  title="Wipe proposed/session values"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Campaign Settings */}
        <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-lg space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-neutral-850 text-xs font-bold uppercase tracking-tight flex items-center gap-1">
              <Settings size={13} className="text-emerald-600 shrink-0" />
              Campaign Info Sheet
            </h3>

            <div>
              <label className="block text-[9px] text-neutral-500 uppercase font-bold mb-1">Campaign Title</label>
              <input
                type="text"
                value={localCampaignName}
                onChange={(e) => setLocalCampaignName(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[9px] text-neutral-500 uppercase font-bold mb-1">Tracked Week Range</label>
              <input
                type="text"
                value={localWeekRange}
                onChange={(e) => setLocalWeekRange(e.target.value)}
                placeholder="e.g. 15-21 June"
                className="font-mono w-full bg-white border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[9px] text-neutral-500 uppercase font-bold mb-1">Designated Session Day (Auto Week Shift)</label>
              <select
                value={localDesignatedSessionDay}
                onChange={(e) => setLocalDesignatedSessionDay(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 font-sans cursor-pointer"
              >
                 {['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                  <option key={d} value={d}>
                    {getDayEnglishLabel(d)}
                  </option>
                ))}
              </select>
            </div>

            {/* Session Counter Widget */}
            <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded">
              <span className="text-[11px] font-semibold text-neutral-600">Tracked Session Code:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDecrementSession}
                  className="bg-neutral-55 hover:bg-neutral-100 text-neutral-600 font-mono font-bold w-6 h-6 flex items-center justify-center border border-neutral-200 rounded cursor-pointer text-xs select-none"
                >
                  -
                </button>
                <span className="font-mono font-bold text-xs text-neutral-800 w-10 text-center">
                  #{campaign.sessionCounter}
                </span>
                <button
                  onClick={handleIncrementSession}
                  className="bg-neutral-55 hover:bg-neutral-100 text-neutral-600 font-mono font-bold w-6 h-6 flex items-center justify-center border border-neutral-200 rounded cursor-pointer text-xs select-none"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveCampaignSettings}
            disabled={isSubmitting}
            className="w-full text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors"
          >
            Save Campaign Meta
          </button>
        </div>

      </div>

      <div id="dm-dashboard-alert" className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded text-[10px] text-amber-800 leading-normal">
        <ShieldAlert size={12} className="shrink-0 mt-0.5 text-amber-600" />
        <p>
          Campaign integrations are authorized. Proposing target timelines publishes to subscriber grids sync loops instantly.
        </p>
      </div>
    </div>
  );
}
