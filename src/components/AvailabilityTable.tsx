import React, { useState, useRef, useEffect } from 'react';
import { UserAvailability, AvailabilityStatus, Campaign } from '../types';
import { Mail, CalendarCheck, Clock, ShieldAlert, Trash2, Plus, Calendar, Settings, ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, RotateCcw, Rss } from 'lucide-react';
import { generateWeekOptions, parseWeekRangeToDates, getSpecificWeekdayDate } from '../utils/weekUtils';

const DAY_INDEX: Record<string, number> = {
  'понеделник': 0, 'monday': 0,
  'вторник': 1, 'tuesday': 1,
  'сряда': 2, 'wednesday': 2,
  'четвъртък': 3, 'thursday': 3,
  'петък': 4, 'friday': 4,
  'събота': 5, 'saturday': 5,
  'неделя': 6, 'sunday': 6
};

const DAY_ENGLISH_LABEL: Record<string, string> = {
  'понеделник': 'Monday', 'monday': 'Monday',
  'вторник': 'Tuesday', 'tuesday': 'Tuesday',
  'сряда': 'Wednesday', 'wednesday': 'Wednesday',
  'четвъртък': 'Thursday', 'thursday': 'Thursday',
  'петък': 'Friday', 'friday': 'Friday',
  'събота': 'Saturday', 'saturday': 'Saturday',
  'неделя': 'Sunday', 'sunday': 'Sunday'
};

interface AvailabilityTableProps {
  campaign: Campaign;
  availabilities: UserAvailability[];
  currentUserId: string | null;
  currentUserDisplayName: string | null;
  onUpdateAvailability: (userId: string, selections: { [day: string]: AvailabilityStatus }, notes: string) => void;
  isSaving: boolean;
  isDM?: boolean;
  onAddRosterPlayer?: (playerName: string) => Promise<void>;
  onRemoveRosterPlayer?: (userId: string) => Promise<void>;
  onUpdateCampaignSettings?: (updatedFields: Partial<Campaign>) => Promise<void>;
  onToggleDayActive?: (day: string) => Promise<void>;
  onToggleGameDay?: (day: string) => Promise<void>;
}

const statusThemes: Record<AvailabilityStatus, { bg: string, text: string, border: string, label: string }> = {
  'PLAY': { bg: 'bg-emerald-200 hover:bg-emerald-300', text: 'text-emerald-900', border: 'border-emerald-200', label: 'PLAY ✅' },
  'LATE 30 MIN': { bg: 'bg-sky-200 hover:bg-sky-300', text: 'text-sky-900', border: 'border-sky-200', label: 'LATE 30M ⏳' },
  'LATE 1 HR': { bg: 'bg-sky-200 hover:bg-sky-300', text: 'text-sky-900', border: 'border-sky-200', label: 'LATE 1H ⏳' },
  'LATE 1.5 HR': { bg: 'bg-sky-200 hover:bg-sky-300', text: 'text-sky-900', border: 'border-sky-200', label: 'LATE 1.5H ⏳' },
  'LATE 2 HR': { bg: 'bg-sky-200 hover:bg-sky-300', text: 'text-sky-900', border: 'border-sky-200', label: 'LATE 2H ⏳' },
  'MAYBE': { bg: 'bg-amber-200 hover:bg-amber-300', text: 'text-amber-900', border: 'border-amber-200', label: 'MAYBE ❓' },
  'SKIP': { bg: 'bg-rose-200 hover:bg-rose-300', text: 'text-rose-900', border: 'border-rose-200', label: 'SKIP ❌' },
  'NO-VOTE': { bg: 'bg-neutral-200 hover:bg-neutral-300', text: 'text-neutral-700', border: 'border-neutral-200', label: 'NO VOTE ⚪' }
};

const STATUS_ORDER: AvailabilityStatus[] = ['PLAY', 'LATE 30 MIN', 'LATE 1 HR', 'LATE 1.5 HR', 'LATE 2 HR', 'MAYBE', 'SKIP', 'NO-VOTE'];

const timeChoices: string[] = [];
for (let h = 11; h <= 22; h++) {
  const hrStr = String(h).padStart(2, '0');
  timeChoices.push(`${hrStr}:00`);
  if (h !== 22) {
    timeChoices.push(`${hrStr}:30`);
  }
}

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr || !timeStr.includes(':')) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return '';
  
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  
  const formattedHours = String(newHours).padStart(2, '0');
  const formattedMinutes = String(newMinutes).padStart(2, '0');
  return `~${formattedHours}:${formattedMinutes}`;
};

interface PlayerNotesInputProps {
  initialNotes: string;
  onSave: (val: string) => void;
  placeholder?: string;
  className?: string;
  fallbackNotes?: string;
}

function PlayerNotesInput({ initialNotes, onSave, placeholder, className, fallbackNotes }: PlayerNotesInputProps) {
  const [value, setValue] = useState(initialNotes);
  const [isFocused, setIsFocused] = useState(false);

  // Sync database changes into input when not editing
  useEffect(() => {
    if (!isFocused) {
      setValue(initialNotes);
    }
  }, [initialNotes, isFocused]);

  // Keep latest onSave and initialNotes in refs to avoid re-running the debounce timer on every parent re-render
  const onSaveRef = useRef(onSave);
  const initialNotesRef = useRef(initialNotes);
  
  useEffect(() => {
    onSaveRef.current = onSave;
    initialNotesRef.current = initialNotes;
  }, [onSave, initialNotes]);

  // Perform debounced save
  useEffect(() => {
    // If the local value matches what is currently stored in the DB (initialNotesRef), don't submit
    if (value === initialNotesRef.current) return;

    const timer = setTimeout(() => {
      onSaveRef.current(value);
    }, 750); // 750ms typing delay to cut excessive DB writes

    return () => clearTimeout(timer);
  }, [value]);

  const handleBlur = () => {
    setIsFocused(false);
    if (value !== initialNotesRef.current) {
      onSaveRef.current(value);
    }
  };

  const handleReuseNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fallbackNotes) {
      setValue(fallbackNotes);
      onSaveRef.current(fallbackNotes);
    }
  };

  return (
    <div className="relative flex items-center w-full min-w-[180px]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`${className} pr-7`}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
      />
      {fallbackNotes && (
        <button
          type="button"
          onClick={handleReuseNote}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all cursor-pointer"
          title={`Reuse last note from past weeks ("${fallbackNotes}")`}
        >
          <RotateCcw size={11} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}

export default function AvailabilityTable({
  campaign,
  availabilities,
  currentUserId,
  currentUserDisplayName,
  onUpdateAvailability,
  isSaving,
  isDM = false,
  onAddRosterPlayer,
  onRemoveRosterPlayer,
  onUpdateCampaignSettings,
  onToggleDayActive,
  onToggleGameDay,
}: AvailabilityTableProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const currentWeekDates = parseWeekRangeToDates(campaign.currentWeekRange);

  const hasAnyGameDays = !!campaign.gameWeekDays && Object.values(campaign.gameWeekDays).some(Boolean);
  const gameDaySelected = !!campaign.gameWeekDays?.[campaign.currentWeekRange];

  const downloadIndividualIcs = () => {
    const gameDayName = campaign.gameWeekDays?.[campaign.currentWeekRange];
    if (!gameDayName) return;

    const sessionTime = campaign.gameWeekTimeOverrides?.[campaign.currentWeekRange] || campaign.sessionTime || '19:30';
    const gameDate = getSpecificWeekdayDate(campaign.currentWeekRange, gameDayName, sessionTime);
    if (!gameDate) return;

    const start = new Date(gameDate);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hours duration

    const formatDateToICS = (date: Date): string => {
      return date.getUTCFullYear() +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        String(date.getUTCDate()).padStart(2, '0') +
        'T' +
        String(date.getUTCHours()).padStart(2, '0') +
        String(date.getUTCMinutes()).padStart(2, '0') +
        '00Z';
    };

    const dtStart = formatDateToICS(start);
    const dtEnd = formatDateToICS(end);
    const dtStamp = formatDateToICS(new Date());
    const uid = `session-${campaign.id}-${campaign.currentWeekRange.replace(/\s+/g, '_')}-${campaign.sessionCounter}@adventure-scheduler`;

    const summary = `🎲 D&D: ${campaign.name} - Session #${campaign.sessionCounter}`;
    const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application. Prepare your character sheets!"}`;

    // RFC5545 clean
    const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${safeSummary}`,
      `DESCRIPTION:${safeDesc}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder 1 Hour Before',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT1M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder 1 Minute Before',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${campaign.name.replace(/\s+/g, '_')}_Session_${campaign.sessionCounter}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFullCalendarIcs = () => {
    const gameWeekDaysDict = campaign.gameWeekDays || {};
    const weekRanges = Object.keys(gameWeekDaysDict);
    if (weekRanges.length === 0) return;

    const formatDateToICS = (date: Date): string => {
      return date.getUTCFullYear() +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        String(date.getUTCDate()).padStart(2, '0') +
        'T' +
        String(date.getUTCHours()).padStart(2, '0') +
        String(date.getUTCMinutes()).padStart(2, '0') +
        '00Z';
    };

    const veventBlocks: string[] = [];
    const dtStamp = formatDateToICS(new Date());

    weekRanges.forEach((wRange) => {
      const gDay = gameWeekDaysDict[wRange];
      if (!gDay) return;

      const timeOverride = campaign.gameWeekTimeOverrides?.[wRange] || campaign.sessionTime || '19:30';
      const eventDate = getSpecificWeekdayDate(wRange, gDay, timeOverride);
      if (!eventDate) return;

      const start = new Date(eventDate);
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4hr

      const dtStart = formatDateToICS(start);
      const dtEnd = formatDateToICS(end);
      const uid = `session-${campaign.id}-${wRange.replace(/\s+/g, '_')}@adventure-scheduler`;

      const summary = `🎲 D&D: ${campaign.name} - Game Day (${wRange})`;
      const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application."}`;

      const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

      const vevent = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${safeSummary}`,
        `DESCRIPTION:${safeDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Hour Before',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT1M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Minute Before',
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');

      veventBlocks.push(vevent);
    });

    if (veventBlocks.length === 0) return;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
      'CALSCALE:GREGORIAN',
      ...veventBlocks,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${campaign.name.replace(/\s+/g, '_')}_Full_Calendar.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadRssFeed = () => {
    const gameWeekDaysDict = campaign.gameWeekDays || {};
    const weekRanges = Object.keys(gameWeekDaysDict);
    if (weekRanges.length === 0) return;

    const formatDateToICS = (date: Date): string => {
      return date.getUTCFullYear() +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        String(date.getUTCDate()).padStart(2, '0') +
        'T' +
        String(date.getUTCHours()).padStart(2, '0') +
        String(date.getUTCMinutes()).padStart(2, '0') +
        '00Z';
    };

    const veventBlocks: string[] = [];
    const dtStamp = formatDateToICS(new Date());
    const sortedWeeks = [...weekRanges].sort();

    // Collect all event blocks for the master campaign calendar feed
    sortedWeeks.forEach((wRange) => {
      const gDay = gameWeekDaysDict[wRange];
      if (!gDay) return;

      const timeOverride = campaign.gameWeekTimeOverrides?.[wRange] || campaign.sessionTime || '19:30';
      const eventDate = getSpecificWeekdayDate(wRange, gDay, timeOverride);
      if (!eventDate) return;

      const start = new Date(eventDate);
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4-hour slot

      const dtStart = formatDateToICS(start);
      const dtEnd = formatDateToICS(end);
      const uid = `session-${campaign.id}-${wRange.replace(/\s+/g, '_')}@adventure-scheduler`;

      const summary = `🎲 D&D: ${campaign.name} - Game Day (${wRange})`;
      const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application."}`;

      const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

      const vevent = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${safeSummary}`,
        `DESCRIPTION:${safeDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Hour Before',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT1M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Minute Before',
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');

      veventBlocks.push(vevent);
    });

    const fullIcsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
      'CALSCALE:GREGORIAN',
      ...veventBlocks,
      'END:VCALENDAR'
    ].join('\r\n');

    const encodeBase64 = (str: string) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        return '';
      }
    };

    const fullIcsBase64 = encodeBase64(fullIcsContent);
    const fullIcsDataUrl = `data:text/calendar;charset=utf-8;base64,${fullIcsBase64}`;

    let itemsXml = '';
    
    sortedWeeks.forEach((wRange, itemIndex) => {
      const gDay = gameWeekDaysDict[wRange];
      if (!gDay) return;

      const timeOverride = campaign.gameWeekTimeOverrides?.[wRange] || campaign.sessionTime || '19:30';
      const eventDate = getSpecificWeekdayDate(wRange, gDay, timeOverride);
      const pubDateVal = eventDate ? new Date(eventDate) : new Date();

      const sessionNum = itemIndex + 1;

      // Define single week's individual VEVENT
      let singleIcsDataUrl = '';
      if (eventDate) {
        const start = new Date(eventDate);
        const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

        const dtStart = formatDateToICS(start);
        const dtEnd = formatDateToICS(end);
        const uid = `session-${campaign.id}-${wRange.replace(/\s+/g, '_')}-${sessionNum}@adventure-scheduler`;

        const summary = `🎲 D&D: ${campaign.name} - Session #${sessionNum} (${gDay})`;
        const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application."}`;

        const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

        const singleIcsContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
          'CALSCALE:GREGORIAN',
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${safeSummary}`,
          `DESCRIPTION:${safeDesc}`,
          'BEGIN:VALARM',
          'TRIGGER:-PT1H',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder 1 Hour Before',
          'END:VALARM',
          'BEGIN:VALARM',
          'TRIGGER:-PT1M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder 1 Minute Before',
          'END:VALARM',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        const singleIcsBase64 = encodeBase64(singleIcsContent);
        singleIcsDataUrl = `data:text/calendar;charset=utf-8;base64,${singleIcsBase64}`;
      }

      const title = `🎲 Session #${sessionNum}: ${campaign.name} - ${gDay} (${wRange})`;
      const link = window.location.href;

      // User-friendly template
      const descriptionHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background-color: #ffffff; max-width: 600px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 24px;">🎲</span>
          <h3 style="color: #059669; font-size: 16px; font-weight: 700; margin: 0;">Session #${sessionNum} Scheduled!</h3>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; text-align: left;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600; width: 120px;">Campaign:</th>
            <td style="padding: 6px 0; color: #111827; font-weight: bold;">${campaign.name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Game Day:</th>
            <td style="padding: 6px 0; color: #047857;"><span style="background-color: #ecfdf5; padding: 2px 8px; border-radius: 4px; font-weight: bold; border: 1px solid #d1fae5;">${gDay}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Start Time:</th>
            <td style="padding: 6px 0; color: #111827; font-family: monospace; font-size: 14px; font-weight: 600;">${timeOverride}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Weekly Period:</th>
            <td style="padding: 6px 0; color: #6b7280;">${wRange}</td>
          </tr>
        </table>
        
        ${campaign.campaignMessage ? `
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 12px; color: #78350f; border: 1px solid #fef3c7;">
          <strong style="display: block; margin-bottom: 4px; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">📢 DM Note Override:</strong>
          <span style="white-space: pre-wrap; font-style: italic; line-height: 1.5;">${campaign.campaignMessage}</span>
        </div>` : `
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 12px; color: #6b7280; font-style: italic; text-align: center; border: 1px dashed #e5e7eb;">
          No campaign banner instructions provided by Dungeon Master.
        </div>`}

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📅 Export Calendar Files</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${singleIcsDataUrl ? `<a href="${singleIcsDataUrl}" download="${campaign.name.replace(/\s+/g, '_')}_Session_${sessionNum}.ics" style="display: inline-flex; align-items: center; text-align: center; background-color: #10b981; border: 1px solid #059669; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 1px 2px rgba(16,185,129,0.2);">📥 This Session (.ICS)</a>` : ''}
            <a href="${fullIcsDataUrl}" download="${campaign.name.replace(/\s+/g, '_')}_Full_Calendar.ics" style="display: inline-flex; align-items: center; text-align: center; background-color: #4b5563; border: 1px solid #374151; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">📅 Download All Sessions (.ICS)</a>
          </div>
        </div>
      </div>
      `.trim();

      const escapeXml = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      itemsXml += `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <description><![CDATA[${descriptionHtml}]]></description>
      <pubDate>${pubDateVal.toUTCString()}</pubDate>
      <guid isPermaLink="false">session-${campaign.id}-${wRange.replace(/\s+/g, '_')}-${sessionNum}</guid>
    </item>`;
    });

    const feedDescription = campaign.campaignMessage || `Standard D&D RSS feed tracking active/scheduled table sessions for campaign "${campaign.name}".`;

    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>🎲 ${escapeXml(campaign.name)} - Game Schedule Feed</title>
    <link>${escapeXml(window.location.href)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>en-us</language>
    <generator>Adventure Scheduler Engine</generator>${itemsXml}
  </channel>
</rss>`;

    const blob = new Blob([rssXml], { type: 'application/rss+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${campaign.name.replace(/\s+/g, '_')}_Schedule_Feed.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getDayDateLabel = (day: string) => {
    if (!currentWeekDates) return '';
    const dayNameLower = day.toLowerCase();
    const index = DAY_INDEX[dayNameLower];
    if (index === undefined) return '';
    
    const targetDate = new Date(currentWeekDates.monday);
    targetDate.setDate(currentWeekDates.monday.getDate() + index);
    
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  };

  const getDayEnglishLabel = (day: string) => {
    const dayNameLower = day.toLowerCase();
    return DAY_ENGLISH_LABEL[dayNameLower] || day;
  };

  useEffect(() => {
    const handleDocumentClick = () => {
      if (Object.values(pendingDeletes).some(v => v === true)) {
        setPendingDeletes({});
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pendingDeletes]);

  // Centering the designated Game Day on mobile screens on campaign/week change
  useEffect(() => {
    const activeGameDay = campaign.gameWeekDays?.[campaign.currentWeekRange];
    if (!activeGameDay) return;

    const timer = setTimeout(() => {
      const container = tableScrollRef.current;
      if (!container) return;

      const gameDayTh = container.querySelector('[data-game-day="true"]') as HTMLElement;
      if (gameDayTh) {
        const thLeft = gameDayTh.offsetLeft;
        const thWidth = gameDayTh.offsetWidth;
        const containerWidth = container.clientWidth;
        
        // Calculations to horizontally center the game day column in the container:
        const targetScrollLeft = thLeft - (containerWidth / 2) + (thWidth / 2);
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth'
        });
      }
    }, 200); // 200ms threshold guarantees elements have been fully laid out

    return () => clearTimeout(timer);
  }, [campaign.id, campaign.currentWeekRange, campaign.gameWeekDays]);

  // Dynamically update RSS autodiscovery in the document header
  useEffect(() => {
    const gameWeekDaysDict = campaign.gameWeekDays || {};
    const weekRanges = Object.keys(gameWeekDaysDict);
    if (weekRanges.length === 0) {
      const existingLink = document.getElementById('rss-discover-link') as HTMLLinkElement;
      if (existingLink) {
        existingLink.href = 'data:application/rss+xml;charset=utf-8,<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>D&amp;D Campaign Game Schedule Feed</title><description>Adventure Scheduler Feed</description></channel></rss>';
        existingLink.title = 'No active scheduled sessions';
      }
      return;
    }

    const formatDateToICS = (date: Date): string => {
      return date.getUTCFullYear() +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        String(date.getUTCDate()).padStart(2, '0') +
        'T' +
        String(date.getUTCHours()).padStart(2, '0') +
        String(date.getUTCMinutes()).padStart(2, '0') +
        '00Z';
    };

    const veventBlocks: string[] = [];
    const dtStamp = formatDateToICS(new Date());
    const sortedWeeks = [...weekRanges].sort();

    // Collect all event blocks for the master campaign calendar feed
    sortedWeeks.forEach((wRange) => {
      const gDay = gameWeekDaysDict[wRange];
      if (!gDay) return;

      const timeOverride = campaign.gameWeekTimeOverrides?.[wRange] || campaign.sessionTime || '19:30';
      const eventDate = getSpecificWeekdayDate(wRange, gDay, timeOverride);
      if (!eventDate) return;

      const start = new Date(eventDate);
      const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4-hour slot

      const dtStart = formatDateToICS(start);
      const dtEnd = formatDateToICS(end);
      const uid = `session-${campaign.id}-${wRange.replace(/\s+/g, '_')}@adventure-scheduler`;

      const summary = `🎲 D&D: ${campaign.name} - Game Day (${wRange})`;
      const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application."}`;

      const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

      const vevent = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${safeSummary}`,
        `DESCRIPTION:${safeDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Hour Before',
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT1M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder 1 Minute Before',
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');

      veventBlocks.push(vevent);
    });

    const fullIcsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
      'CALSCALE:GREGORIAN',
      ...veventBlocks,
      'END:VCALENDAR'
    ].join('\r\n');

    const encodeBase64 = (str: string) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        return '';
      }
    };

    const fullIcsBase64 = encodeBase64(fullIcsContent);
    const fullIcsDataUrl = `data:text/calendar;charset=utf-8;base64,${fullIcsBase64}`;

    let itemsXml = '';
    
    sortedWeeks.forEach((wRange, itemIndex) => {
      const gDay = gameWeekDaysDict[wRange];
      if (!gDay) return;

      const timeOverride = campaign.gameWeekTimeOverrides?.[wRange] || campaign.sessionTime || '19:30';
      const eventDate = getSpecificWeekdayDate(wRange, gDay, timeOverride);
      const pubDateVal = eventDate ? new Date(eventDate) : new Date();

      const sessionNum = itemIndex + 1;

      // Define single week's individual VEVENT
      let singleIcsDataUrl = '';
      if (eventDate) {
        const start = new Date(eventDate);
        const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

        const dtStart = formatDateToICS(start);
        const dtEnd = formatDateToICS(end);
        const uid = `session-${campaign.id}-${wRange.replace(/\s+/g, '_')}-${sessionNum}@adventure-scheduler`;

        const summary = `🎲 D&D: ${campaign.name} - Session #${sessionNum} (${gDay})`;
        const description = `${campaign.campaignMessage || "Proposed gaming session coordinated via the Campaign Session Scheduler web application."}`;

        const safeDesc = description.replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        const safeSummary = summary.replace(/,/g, '\\,').replace(/;/g, '\\;');

        const singleIcsContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Adventure Scheduler//NONSGML v2.0//EN',
          'CALSCALE:GREGORIAN',
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${safeSummary}`,
          `DESCRIPTION:${safeDesc}`,
          'BEGIN:VALARM',
          'TRIGGER:-PT1H',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder 1 Hour Before',
          'END:VALARM',
          'BEGIN:VALARM',
          'TRIGGER:-PT1M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder 1 Minute Before',
          'END:VALARM',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        const singleIcsBase64 = encodeBase64(singleIcsContent);
        singleIcsDataUrl = `data:text/calendar;charset=utf-8;base64,${singleIcsBase64}`;
      }

      const title = `🎲 Session #${sessionNum}: ${campaign.name} - ${gDay} (${wRange})`;
      const link = window.location.href;

      // User-friendly template
      const descriptionHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background-color: #ffffff; max-width: 600px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 24px;">🎲</span>
          <h3 style="color: #059669; font-size: 16px; font-weight: 700; margin: 0;">Session #${sessionNum} Scheduled!</h3>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; text-align: left;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600; width: 120px;">Campaign:</th>
            <td style="padding: 6px 0; color: #111827; font-weight: bold;">${campaign.name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Game Day:</th>
            <td style="padding: 6px 0; color: #047857;"><span style="background-color: #ecfdf5; padding: 2px 8px; border-radius: 4px; font-weight: bold; border: 1px solid #d1fae5;">${gDay}</span></td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Start Time:</th>
            <td style="padding: 6px 0; color: #111827; font-family: monospace; font-size: 14px; font-weight: 600;">${timeOverride}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <th style="padding: 6px 0; color: #4b5563; font-weight: 600;">Weekly Period:</th>
            <td style="padding: 6px 0; color: #6b7280;">${wRange}</td>
          </tr>
        </table>
        
        ${campaign.campaignMessage ? `
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 12px; color: #78350f; border: 1px solid #fef3c7;">
          <strong style="display: block; margin-bottom: 4px; color: #92400e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">📢 DM Note Override:</strong>
          <span style="white-space: pre-wrap; font-style: italic; line-height: 1.5;">${campaign.campaignMessage}</span>
        </div>` : `
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 12px; color: #6b7280; font-style: italic; text-align: center; border: 1px dashed #e5e7eb;">
          No campaign banner instructions provided by Dungeon Master.
        </div>`}

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📅 Export Calendar Files</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${singleIcsDataUrl ? `<a href="${singleIcsDataUrl}" download="${campaign.name.replace(/\s+/g, '_')}_Session_${sessionNum}.ics" style="display: inline-flex; align-items: center; text-align: center; background-color: #10b981; border: 1px solid #059669; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 1px 2px rgba(16,185,129,0.2);">📥 This Session (.ICS)</a>` : ''}
            <a href="${fullIcsDataUrl}" download="${campaign.name.replace(/\s+/g, '_')}_Full_Calendar.ics" style="display: inline-flex; align-items: center; text-align: center; background-color: #4b5563; border: 1px solid #374151; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">📅 Download All Sessions (.ICS)</a>
          </div>
        </div>
      </div>
      `.trim();

      const escapeXml = (str: string) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      itemsXml += `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <description><![CDATA[${descriptionHtml}]]></description>
      <pubDate>${pubDateVal.toUTCString()}</pubDate>
      <guid isPermaLink="false">session-${campaign.id}-${wRange.replace(/\s+/g, '_')}-${sessionNum}</guid>
    </item>`;
    });

    const feedDescription = campaign.campaignMessage || `Standard D&D RSS feed tracking active/scheduled table sessions for campaign "${campaign.name}".`;

    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>🎲 ${escapeXml(campaign.name)} - Game Schedule Feed</title>
    <link>${escapeXml(window.location.href)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>en-us</language>
    <generator>Adventure Scheduler Engine</generator>${itemsXml}
  </channel>
</rss>`;

    const rssBase64 = encodeBase64(rssXml);
    const dataUrl = `data:application/rss+xml;charset=utf-8;base64,${rssBase64}`;

    const existingLink = document.getElementById('rss-discover-link') as HTMLLinkElement;
    if (existingLink) {
      existingLink.title = `🎲 ${campaign.name} D&D Schedule Feed`;
      existingLink.href = dataUrl;
    }
  }, [campaign.id, campaign.name, campaign.campaignMessage, campaign.gameWeekDays, campaign.gameWeekTimeOverrides, campaign.sessionTime]);

  const scrollByDay = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const amount = 130;
      tableScrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToStart = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({
        left: 0,
        behavior: 'smooth'
      });
    }
  };

  const scrollToEndOfDays = () => {
    if (tableScrollRef.current) {
      const ths = tableScrollRef.current.querySelectorAll('th');
      if (ths && ths.length >= 2) {
        const lastDayTh = ths[ths.length - 2] as HTMLElement;
        if (lastDayTh) {
          const containerWidth = tableScrollRef.current.clientWidth;
          const targetScrollLeft = lastDayTh.offsetLeft + lastDayTh.offsetWidth - containerWidth;
          tableScrollRef.current.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
          });
        }
      } else {
        tableScrollRef.current.scrollTo({
          left: tableScrollRef.current.scrollWidth - 300,
          behavior: 'smooth'
        });
      }
    }
  };

  const getStatusLabel = (status: AvailabilityStatus) => {
    const sTime = campaign.gameWeekTimeOverrides?.[campaign.currentWeekRange] || campaign.sessionTime || '19:30';
    if (status === 'LATE 1 HR') {
      const timeFormatted = addMinutesToTime(sTime, 60);
      return `${timeFormatted} ⏳`;
    }
    if (status === 'LATE 30 MIN') {
      const timeFormatted = addMinutesToTime(sTime, 30);
      return `${timeFormatted} ⏳`;
    }
    if (status === 'LATE 1.5 HR') {
      const timeFormatted = addMinutesToTime(sTime, 90);
      return `${timeFormatted} ⏳`;
    }
    if (status === 'LATE 2 HR') {
      const timeFormatted = addMinutesToTime(sTime, 120);
      return `${timeFormatted} ⏳`;
    }
    return statusThemes[status]?.label || status;
  };

  const handleTimeOverrideChange = async (val: string) => {
    if (!onUpdateCampaignSettings) return;
    const timeOverrides = { ...(campaign.gameWeekTimeOverrides || {}) };
    if (!val) {
      delete timeOverrides[campaign.currentWeekRange];
    } else {
      timeOverrides[campaign.currentWeekRange] = val;
    }
    await onUpdateCampaignSettings({ gameWeekTimeOverrides: timeOverrides });
  };

  // Configuration settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState(campaign.name);
  const [editSessionCounter, setEditSessionCounter] = useState(campaign.sessionCounter);
  const [editSessionTime, setEditSessionTime] = useState(campaign.sessionTime || '19:30');
  const [editDesignatedDay, setEditDesignatedDay] = useState(campaign.designatedSessionDay || 'Неделя');
  const [editCampaignMessage, setEditCampaignMessage] = useState(campaign.campaignMessage || '');

  // Double-click and click tracking states per weekday column header using useRef
  const clickCountRef = useRef<{ [day: string]: number }>({});
  const clickTimersRef = useRef<{ [day: string]: any }>({});
  const lastDoubleClickTimeRef = useRef<{ [day: string]: number }>({});

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(clickTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer as any);
      });
    };
  }, []);

  const openSettings = () => {
    setEditCampaignName(campaign.name);
    setEditSessionCounter(campaign.sessionCounter);
    setEditSessionTime(campaign.sessionTime || '19:30');
    setEditDesignatedDay(campaign.designatedSessionDay || 'Неделя');
    setEditCampaignMessage(campaign.campaignMessage || '');
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateCampaignSettings) {
      await onUpdateCampaignSettings({
        name: editCampaignName.trim(),
        sessionCounter: Number(editSessionCounter),
        sessionTime: editSessionTime,
        designatedSessionDay: editDesignatedDay,
        campaignMessage: editCampaignMessage.trim()
      });
    }
    setIsSettingsOpen(false);
  };

  const handleHeaderDoubleClick = (day: string) => {
    if (!isDM) return; // Only DM can customize/toggle weekday features

    // Instantly clear the pending single-click timeout
    const activeTimer = clickTimersRef.current[day];
    if (activeTimer) {
      clearTimeout(activeTimer);
      clickTimersRef.current[day] = null;
    }
    clickCountRef.current[day] = 0;

    // Assert that deactivated day can't be set as game day before activating it
    if (campaign.inactiveDays?.includes(day)) {
      alert(`The day "${day}" is currently deactivated. Please click once first to activate it, then you can lock it as the weekly Game Day!`);
      return;
    }

    if (onToggleGameDay) {
      onToggleGameDay(day);
    }
  };

  const handleHeaderClick = (day: string) => {
    if (!isDM) return; // Only DM can customize/toggle weekday features

    const isGameDay = campaign.gameWeekDays?.[campaign.currentWeekRange] === day;

    // Increment click count for this specific day
    clickCountRef.current[day] = (clickCountRef.current[day] || 0) + 1;

    if (clickCountRef.current[day] === 1) {
      // Set up a single click timer
      const timer = setTimeout(async () => {
        // If it was only one click, execute single click action
        if (clickCountRef.current[day] === 1) {
          if (isGameDay) {
            alert(`The day "${day}" is set as the GAME DAY. You must double-click it to remove the Game Day status before you can deactivate/activate it or change its status.`);
          } else if (onToggleDayActive) {
            await onToggleDayActive(day);
          }
        }
        // Clean up
        clickCountRef.current[day] = 0;
        clickTimersRef.current[day] = null;
      }, 400); // Super-comfortable 400ms threshold for slower clicks

      clickTimersRef.current[day] = timer;
    } else if (clickCountRef.current[day] >= 2) {
      // Double click (or more) detected via sequential click timing!
      handleHeaderDoubleClick(day);
    }
  };

  // Generate beautiful calendar week range options for DM / players selection
  const weekOptions = generateWeekOptions();
  if (campaign.currentWeekRange && !weekOptions.includes(campaign.currentWeekRange)) {
    weekOptions.unshift(campaign.currentWeekRange);
  }

  const handleCellSelect = (ava: UserAvailability, day: string, status: AvailabilityStatus) => {
    const activeWeekKey = campaign.currentWeekRange;
    const weekRecord = ava.weeklyData?.[activeWeekKey];
    const currentSelections = weekRecord ? weekRecord.selections : {};
    const currentNotes = weekRecord ? weekRecord.notes : '';

    const nextSelections = { ...currentSelections, [day]: status };
    onUpdateAvailability(ava.userId, nextSelections, currentNotes);
  };

  const handleNotesChange = (ava: UserAvailability, notesVal: string) => {
    const activeWeekKey = campaign.currentWeekRange;
    const weekRecord = ava.weeklyData?.[activeWeekKey];
    const currentSelections = weekRecord ? weekRecord.selections : {};

    onUpdateAvailability(ava.userId, currentSelections, notesVal);
  };

  const handleEnrollPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !onAddRosterPlayer) return;
    const playerNames = newPlayerName
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    for (const name of playerNames) {
      await onAddRosterPlayer(name);
    }
    setNewPlayerName('');
  };

  return (
    <div id={`campaign-table-container-${campaign.id}`} className="bg-white border border-neutral-200 border-t-0 rounded-b-lg rounded-t-none p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-neutral-100">
        <div className="flex items-center gap-3 min-w-0 max-w-full">
          <Calendar className="text-emerald-600 shrink-0 animate-pulse" size={24} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 max-w-full overflow-hidden">
              <span className="text-lg font-extrabold text-neutral-800 uppercase tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none block" title={campaign.name}>
                {campaign.name}
              </span>
              <span className="text-xs bg-neutral-100 text-neutral-600 font-semibold px-2 py-0.5 rounded font-mono shrink-0">
                Session #{campaign.sessionCounter}
              </span>
              {isDM && (
                <button
                  type="button"
                  onClick={openSettings}
                  className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-neutral-100 rounded-full transition-all cursor-pointer shrink-0"
                  title="Configure Campaign Settings (Name, Session Counter, General Hour, Designated Session Day)"
                >
                  <Settings size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 lg:line-clamp-none line-clamp-2 overflow-hidden" title={campaign.campaignMessage || (isDM ? "DM Guide: Click a day header to activate/deactivate. Doubleclick to schedule Game Day!" : "Click on dropdown cells to specify your scheduling scores.")}>
              {campaign.campaignMessage && campaign.campaignMessage.trim() !== ''
                ? campaign.campaignMessage
                : (isDM ? "DM Guide: Click a day header to activate/deactivate. Doubleclick to schedule Game Day!" : "Click on dropdown cells to specify your scheduling scores.")}
            </p>
          </div>
        </div>
      </div>

      {/* Roster Matrix Table */}
      <div ref={tableScrollRef} className="overflow-x-auto no-scrollbar-mobile-tablet rounded border border-neutral-200 bg-neutral-50 mb-3 scroll-smooth">
        <table className="w-full border-collapse text-left text-xs bg-white">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 select-none">
              <th className="px-3.5 py-2.5 font-bold text-neutral-600 font-sans border-r border-neutral-200 text-center uppercase tracking-tight w-48 font-sans">Player</th>
              {campaign.daysTracked.map((day) => {
                const isInactive = campaign.inactiveDays?.includes(day);
                const isGameDay = campaign.gameWeekDays?.[campaign.currentWeekRange] === day;

                let thClass = "px-3 py-3 font-bold text-center border-r border-neutral-200 uppercase tracking-tight font-mono select-none transition-all ";
                if (isDM) {
                  thClass += "cursor-pointer hover:bg-neutral-150 ";
                }

                if (isGameDay) {
                  thClass += "bg-emerald-600 text-white font-extrabold relative shadow-inner ring-2 ring-emerald-500 z-10 animate-pulse";
                } else if (isInactive) {
                  thClass += "bg-neutral-100 text-neutral-400 opacity-60 line-through decoration-rose-300";
                } else {
                  thClass += "bg-neutral-50 text-neutral-600";
                }

                return (
                  <th
                    key={day}
                    className={thClass}
                    onClick={() => handleHeaderClick(day)}
                    title={isDM ? "Click to toggle availability. Doubleclick to designate as actual game day." : ""}
                    data-game-day={isGameDay ? "true" : "false"}
                  >
                    <div className="flex flex-col items-center justify-center min-h-[5.25rem] py-2 relative select-none">
                      <span className="text-xs md:text-sm tracking-wide font-bold">{getDayEnglishLabel(day)}</span>
                      <span className={`text-[10px] font-mono font-bold mt-0.5 ${isGameDay ? 'text-emerald-100' : 'text-neutral-400'}`}>
                        {getDayDateLabel(day)}
                      </span>
                      <div className="absolute bottom-[-1px] left-0 right-0 flex items-center justify-center h-4">
                        {isGameDay ? (
                          <span className="text-[9px] md:text-[10px] bg-emerald-700 border border-emerald-500 text-white px-2 py-0.5 rounded-full font-sans uppercase tracking-wider font-extrabold shadow-md animate-bounce whitespace-nowrap">
                            🎲 GAME DAY
                          </span>
                        ) : isInactive ? (
                          <span className="text-[8px] bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded font-sans uppercase font-bold text-[7px] whitespace-nowrap">
                            Unavailable
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-1 font-sans text-right align-middle w-80">
                <div className="flex flex-col items-end gap-1.5 pr-1">
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono text-right w-12 select-none">Week:</span>
                    <select
                      id="table-header-week-select"
                      value={campaign.currentWeekRange}
                      onChange={(e) => {
                        if (onUpdateCampaignSettings) {
                          onUpdateCampaignSettings({ currentWeekRange: e.target.value });
                        }
                      }}
                      className="bg-white border border-neutral-300 hover:border-emerald-500 text-neutral-800 text-xs font-bold px-2 h-[28px] w-[140px] rounded shadow-sm cursor-pointer select-none font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {weekOptions.map(opt => (
                        <option key={opt} value={opt} className="font-mono bg-white text-neutral-800">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isDM && (
                    <div className="flex items-center justify-end gap-2.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono text-right w-12 select-none">Start:</span>
                      <select
                        id="table-header-hour-override-select"
                        value={campaign.gameWeekTimeOverrides?.[campaign.currentWeekRange] || campaign.sessionTime || '19:30'}
                        onChange={(e) => handleTimeOverrideChange(e.target.value)}
                        className="bg-white border border-neutral-300 hover:border-emerald-500 text-neutral-800 text-xs font-bold px-2 h-[28px] w-[140px] rounded shadow-sm cursor-pointer select-none font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {(() => {
                          const currentVal = campaign.gameWeekTimeOverrides?.[campaign.currentWeekRange] || campaign.sessionTime || '19:30';
                          const processedChoices = timeChoices.includes(currentVal) 
                            ? timeChoices 
                            : [...timeChoices, currentVal].sort();
                          return processedChoices.map(opt => (
                            <option key={opt} value={opt} className="font-mono bg-white text-neutral-800">
                              {opt}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-150">
            {availabilities.length === 0 ? (
              <tr>
                <td colSpan={campaign.daysTracked.length + 2} className="px-4 py-8 text-center text-neutral-400 font-mono">
                  <ShieldAlert className="mx-auto mb-2 text-neutral-350" size={20} />
                  No players currently registered in this campaign roster yet
                </td>
              </tr>
            ) : (
              availabilities.map((ava) => {
                const isMe = ava.userId === currentUserId;
                const isDMDoc = ava.userId.startsWith('seed-dm') || campaign.dmUserId === ava.userId;
                const canEdit = true; // Everyone can edit schedule grids directly

                const activeWeekKey = campaign.currentWeekRange;
                const weekRecord = ava.weeklyData?.[activeWeekKey];
                const resolvedSelections = weekRecord ? weekRecord.selections : {};
                const resolvedNotes = weekRecord ? weekRecord.notes : '';

                // Find most recent past week note with content
                const weeksList = generateWeekOptions();
                const currentWeekIdx = weeksList.indexOf(activeWeekKey);
                let fallbackNotes = '';
                if (currentWeekIdx > 0) {
                  for (let i = currentWeekIdx - 1; i >= 0; i--) {
                    const prevWeekKey = weeksList[i];
                    const prevVal = ava.weeklyData?.[prevWeekKey]?.notes;
                    if (prevVal && prevVal.trim() !== '') {
                      fallbackNotes = prevVal;
                      break;
                    }
                  }
                }

                return (
                  <tr
                    key={ava.userId}
                    className={`transition-colors hover:bg-neutral-50 ${
                      isMe ? 'bg-emerald-50/20 hover:bg-emerald-50/45 border-l-2 border-l-emerald-600' : ''
                    }`}
                  >
                    <td className="px-3.5 py-2 font-semibold text-neutral-750 border-r border-neutral-200 text-center align-middle relative min-h-[42px] group">
                      {/* Name and Tags centered perfectly */}
                      <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
                        {isMe ? (
                          <span className="text-emerald-700 font-bold truncate">✨ {ava.playerName} (You)</span>
                        ) : (
                          <span className="truncate">{ava.playerName}</span>
                        )}
                        {isDMDoc && (
                          <span className="text-[8px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200 uppercase font-bold font-mono shrink-0">
                            DM
                          </span>
                        )}
                      </div>

                      {/* Low profile hover-activated controls on the right side */}
                      {(isDM || isMe) && onRemoveRosterPlayer && (
                        <div 
                          className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center transition-all duration-200 ${
                            pendingDeletes[ava.userId] 
                              ? 'opacity-100' 
                              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                          }`}
                        >
                          {pendingDeletes[ava.userId] ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveRosterPlayer(ava.userId);
                                setPendingDeletes((prev) => ({ ...prev, [ava.userId]: false }));
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer border border-rose-600 z-30 animate-fade-in"
                              title="Click again to confirm delete"
                              id={`delete-confirm-${ava.userId}`}
                            >
                              <Check size={11} className="stroke-[3.5]" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeletes({ [ava.userId]: true });
                              }}
                              className="text-neutral-400 hover:text-rose-600 p-1 hover:bg-rose-50 hover:text-rose-700 rounded transition-colors cursor-pointer shrink-0 shadow-xs bg-white border border-neutral-150"
                              title="Expel player from roster"
                              id={`delete-init-${ava.userId}`}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {campaign.daysTracked.map((day, idx) => {
                      const isInactive = campaign.inactiveDays?.includes(day);
                      const isGameDay = campaign.gameWeekDays?.[campaign.currentWeekRange] === day;
                      const sel = resolvedSelections[day] || 'NO-VOTE';
                      const theme = statusThemes[sel] || statusThemes['NO-VOTE'];

                      let tdClass = "p-1.5 md:p-3.5 text-center min-w-[115px] border-r border-neutral-200 transition-all relative ";
                      if (isGameDay) {
                        tdClass += "bg-emerald-50 font-bold border-x-2 border-emerald-500/15";
                      } else if (isInactive) {
                        tdClass += "bg-neutral-50/80 opacity-55 grayscale line-through";
                      }

                      // Check copy condition
                      const nextDay = campaign.daysTracked[idx + 1];
                      const nextSel = nextDay ? (resolvedSelections[nextDay] || 'NO-VOTE') : null;
                      const showCopyButton = canEdit && nextDay && sel !== 'NO-VOTE' && nextSel !== sel;

                      return (
                        <td key={day} className={tdClass}>
                          {canEdit ? (
                            <div className="relative">
                              <select
                                id={`cell-select-${ava.userId}-${day}`}
                                value={sel}
                                onChange={(e) => handleCellSelect(ava, day, e.target.value as AvailabilityStatus)}
                                className={`w-full px-2.5 py-1.5 text-center text-xs font-bold border rounded transition-all ${isGameDay && sel === 'NO-VOTE' ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : `${theme.bg} ${theme.text} ${theme.border}`} cursor-pointer appearance-none outline-none focus:ring-1 focus:ring-emerald-500 uppercase font-mono`}
                              >
                                {STATUS_ORDER.map((status) => (
                                  <option key={status} value={status} className="bg-white text-neutral-800 font-mono py-1">
                                    {getStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="px-1.5 py-0.5">
                              <span
                                className={`inline-block w-full px-1.5 py-1.5 border rounded text-[10px] font-bold font-mono text-center select-none uppercase ${isGameDay && sel === 'NO-VOTE' ? 'bg-emerald-100/50 text-emerald-800 border-emerald-250' : `${theme.bg} ${theme.text} ${theme.border}`}`}
                              >
                                {getStatusLabel(sel)}
                              </span>
                            </div>
                          )}

                          {showCopyButton && (
                            <button
                              type="button"
                              onClick={() => handleCellSelect(ava, nextDay, sel)}
                              className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 bg-white border border-neutral-300 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-500 rounded-full shadow-md transition-all cursor-pointer group"
                              title={`Copy "${getStatusLabel(sel)}" to ${getDayEnglishLabel(nextDay)}`}
                              id={`copy-avail-${ava.userId}-${day}-to-${nextDay}`}
                            >
                              <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-1 text-xs text-neutral-650">
                      {canEdit ? (
                        <PlayerNotesInput
                          initialNotes={resolvedNotes}
                          onSave={(val) => handleNotesChange(ava, val)}
                          fallbackNotes={fallbackNotes}
                          placeholder="Player notes or availability descriptions..."
                          className="w-full bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-750 placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      ) : (
                        <div className="max-w-[250px] truncate text-neutral-500 font-sans px-1.5" title={resolvedNotes}>
                          {resolvedNotes || '—'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Scroll Navigation Buttons for Mobile and Tablet Touch Devices */}
      <div 
        id="scroll-navigation-touch-controls" 
        className="lg:hidden flex items-center justify-center bg-neutral-50 px-4 py-2 border border-neutral-200 border-t-0 rounded-b mb-4 select-none"
      >
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={scrollToStart}
            className="p-2.5 border border-neutral-250 hover:border-emerald-500 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-neutral-600 rounded-md transition-all shadow-xs cursor-pointer select-none flex items-center justify-center"
            title="Scroll to Player/Start (START)"
          >
            <ChevronsLeft size={15} className="stroke-[2.5]" />
          </button>
          
          <button
            type="button"
            onClick={() => scrollByDay('left')}
            className="p-2.5 border border-neutral-250 hover:border-emerald-500 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-neutral-600 rounded-md transition-all shadow-xs cursor-pointer select-none flex items-center justify-center"
            title="Scroll left by one day"
          >
            <ChevronLeft size={15} className="stroke-[2.5]" />
          </button>
          
          <button
            type="button"
            onClick={() => scrollByDay('right')}
            className="p-2.5 border border-neutral-250 hover:border-emerald-500 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-neutral-600 rounded-md transition-all shadow-xs cursor-pointer select-none flex items-center justify-center"
            title="Scroll right by one day"
          >
            <ChevronRight size={15} className="stroke-[2.5]" />
          </button>
          
          <button
            type="button"
            onClick={scrollToEndOfDays}
            className="p-2.5 border border-neutral-250 hover:border-emerald-500 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-neutral-600 rounded-md transition-all shadow-xs cursor-pointer select-none flex items-center justify-center"
            title="Scroll to last tracked day (before notes) (DAYS END)"
          >
            <ChevronsRight size={15} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Footer Controls Row: Enroll & ICS Calendar Event Exports */}
      <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
        {onAddRosterPlayer ? (
          <form onSubmit={handleEnrollPlayerSubmit} className="flex items-center gap-2 max-w-sm flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Enroll player(s), comma-separated..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded px-2.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-450 focus:outline-none focus:border-emerald-500 font-sans"
            />
            <button
              type="submit"
              disabled={!newPlayerName.trim()}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs cursor-pointer select-none shrink-0 disabled:opacity-40 uppercase tracking-wider font-mono animate-all"
            >
              <Plus size={13} /> ENROLL
            </button>
          </form>
        ) : (
          <div className="flex-1" />
        )}

        {/* Export .ics & RSS Actions */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <button
            type="button"
            onClick={downloadFullCalendarIcs}
            disabled={!hasAnyGameDays}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 font-bold py-1.5 px-3 rounded text-[10px] sm:text-xs border uppercase tracking-wider font-mono transition-all ${
              hasAnyGameDays
                ? 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 shadow-xs cursor-pointer'
                : 'bg-neutral-50 text-neutral-400 border-neutral-200 cursor-not-allowed opacity-50'
            }`}
            title="Download full series of all scheduled Game Days (.ics calendar format)"
          >
            <Calendar size={13} className={hasAnyGameDays ? "text-neutral-600" : ""} />
            <span className="hidden xs:inline">Campaign Calendar (.ics)</span>
            <span className="inline xs:hidden">All (.ics)</span>
          </button>
 
          <button
            type="button"
            onClick={downloadIndividualIcs}
            disabled={!gameDaySelected}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 font-bold py-1.5 px-3 rounded text-[10px] sm:text-xs border uppercase tracking-wider font-mono transition-all ${
              gameDaySelected
                ? 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 shadow-xs cursor-pointer'
                : 'bg-neutral-50 text-neutral-450 border-neutral-200 cursor-not-allowed opacity-50'
            }`}
            title={gameDaySelected ? "Download single iCalendar (.ics) event file for this week's locked Game Day" : "Unavailable: select a Game Day first"}
          >
            <CalendarCheck size={13} className={gameDaySelected ? "text-neutral-600" : ""} />
            <span className="hidden xs:inline">This Game Day (.ics)</span>
            <span className="inline xs:hidden">Week (.ics)</span>
          </button>

          <button
            type="button"
            onClick={downloadRssFeed}
            disabled={!hasAnyGameDays}
            className={`h-[30px] w-[30px] flex-shrink-0 inline-flex items-center justify-center rounded border transition-all ${
              hasAnyGameDays
                ? 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-400 shadow-xs cursor-pointer'
                : 'bg-neutral-50 text-neutral-450 border-neutral-200 cursor-not-allowed opacity-50'
            }`}
            title={hasAnyGameDays ? "Download standard RSS XML scheduled games feed (.xml)" : "Unavailable: scheduled game days required"}
          >
            <Rss size={13} className={hasAnyGameDays ? "text-neutral-600" : ""} />
          </button>
        </div>
      </div>

      {/* Configuration Settings Modal Dialog (DM Only) */}
      {isSettingsOpen && (
        <div id="campaign-settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden transform transition-all animate-all duration-200 shrink-0">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-150 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-tight flex items-center gap-2">
                <Settings className="text-emerald-600" size={17} /> Campaign Configuration Settings
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  value={editCampaignName}
                  onChange={(e) => setEditCampaignName(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                    Current Session #
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editSessionCounter}
                    onChange={(e) => setEditSessionCounter(Number(e.target.value))}
                    className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-800 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                    Standard Start
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 19:30"
                    value={editSessionTime}
                    onChange={(e) => setEditSessionTime(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-800 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Designated Session Day
                </label>
                <select
                  value={editDesignatedDay}
                  onChange={(e) => setEditDesignatedDay(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-emerald-500"
                >
                  {['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-450 mt-1">
                  Once this weekday has passed, the grid is automatically rotation-advanced to the next week label.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                  Campaign Message Override
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Bring extra snacks! Or custom schedules..."
                  value={editCampaignMessage}
                  onChange={(e) => setEditCampaignMessage(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm text-neutral-800 placeholder-neutral-450 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <p className="text-[10px] text-neutral-450 mt-1">
                  Leave empty to let the grid show standard instructions and guides.
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-150 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-[10px] font-bold text-neutral-500 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded uppercase tracking-wider shadow-sm cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
