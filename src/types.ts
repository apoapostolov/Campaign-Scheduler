export type AvailabilityStatus = 'PLAY' | 'SKIP' | 'MAYBE' | 'LATE 1 HR' | 'LATE 30 MIN' | 'LATE 1.5 HR' | 'LATE 2 HR' | 'NO-VOTE';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  gmailCalendarSync: boolean;
  browserNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  isDm?: boolean;
  managedCampaignIds?: string[];
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  sessionCounter: number;
  currentWeekRange: string;
  dmUserId: string;
  dmEmail: string;
  dmName: string;
  playerUids: string[];
  coDms?: string[];
  // Initial roster names to display if players haven't signed up yet
  initialRosterNames?: string[];
  // Selected days constraint (e.g., all days or just weekend)
  daysTracked: string[];
  // Designated weekly session day name for auto-week rotation
  designatedSessionDay?: string;
  // Track inactive days (greyed-out) for campaigns
  inactiveDays?: string[];
  // Track per-week scheduled game day
  gameWeekDays?: { [weekRange: string]: string };
  // Track per-week scheduled starting hour overrides
  gameWeekTimeOverrides?: { [weekRange: string]: string };
  // Default session hours (e.g., "19:30")
  sessionTime?: string;
  // Track calendar event IDs created for each week
  gameWeekCalendarEvents?: { [weekRange: string]: string };
  // Visual/Instruction guidance message override
  campaignMessage?: string;
}

export interface UserAvailability {
  userId: string;
  playerName: string;
  notes: string;
  selections: { [weekday: string]: AvailabilityStatus };
  updatedAt: string;
  weeklyData?: {
    [weekRange: string]: {
      selections: { [weekday: string]: AvailabilityStatus };
      notes: string;
    };
  };
}

export interface GameSession {
  id: string;
  status: 'proposed' | 'scheduled' | 'cancelled';
  scheduledDateTime: string; // ISO String
  proposedDays?: string[];
  calendarEventId?: string;
  sentOneDaySummary?: boolean;
  createdAt: string;
  updatedAt: string;
}
