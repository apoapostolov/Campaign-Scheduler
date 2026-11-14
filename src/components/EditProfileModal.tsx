import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, Calendar, Settings, Shield, Bell } from 'lucide-react';

interface EditProfileModalProps {
  profile: UserProfile | null;
  onSave: (
    displayName: string,
    gmailCalendarSync: boolean,
    browserNotificationsEnabled: boolean,
    emailNotificationsEnabled: boolean
  ) => Promise<void>;
  onClose: () => void;
}

export default function EditProfileModal({
  profile,
  onSave,
  onClose,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [gmailSync, setGmailSync] = useState(profile?.gmailCalendarSync || false);
  const [browserNotifications, setBrowserNotifications] = useState(profile?.browserNotificationsEnabled || false);
  const [emailNotifications, setEmailNotifications] = useState(profile?.emailNotificationsEnabled || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            setBrowserNotifications(true);
          } else {
            alert('Notification permission was denied. Please enable notifications in your browser settings to opt-in.');
            setBrowserNotifications(false);
          }
        } catch (err) {
          console.error('Error requesting notification permission:', err);
          alert('Notification permission request failed or was blocked by your browser/iframe context.');
          setBrowserNotifications(false);
        }
      } else {
        alert('Your browser does not support web notifications.');
        setBrowserNotifications(false);
      }
    } else {
      setBrowserNotifications(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      await onSave(displayName, gmailSync, browserNotifications, emailNotifications);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="profile-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-4">
      <div id="profile-modal-content" className="bg-white border border-neutral-250 w-full max-w-md rounded-lg p-5 shadow-lg relative overflow-hidden">
        <button
          onClick={onClose}
          id="btn-close-profile-modal"
          className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
          <Settings className="text-emerald-600 shrink-0" size={16} />
          <h3 className="text-neutral-850 font-bold text-xs uppercase">Account Settings & Preferences</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">My Display Name on Roster</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Nicola"
              className="w-full bg-white border border-neutral-200 rounded px-2.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">Gmail Email Address</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-xs text-neutral-450 cursor-not-allowed font-mono"
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Securely imported via Google sign-in.
            </p>
          </div>
 
          <div className="bg-neutral-50 border border-neutral-150 p-3.5 rounded flex items-start gap-3">
            <input
              type="checkbox"
              id="pref-calendar-sync"
              checked={gmailSync}
              onChange={(e) => setGmailSync(e.target.checked)}
              className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer animate-none"
            />
            <label htmlFor="pref-calendar-sync" className="cursor-pointer text-[11px] leading-relaxed select-none">
              <span className="font-bold text-neutral-700 block mb-0.5">Enable Google Calendar Sync</span>
              <span className="text-neutral-500 font-normal block leading-normal font-sans">
                Auto-generates calendar entries with finalized date-times on your primary calendar when synchronized.
              </span>
            </label>
          </div>
 
          <div className="bg-neutral-50 border border-neutral-150 p-3.5 rounded flex items-start gap-3">
            <input
              type="checkbox"
              id="pref-email-notifications"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer animate-none"
            />
            <label htmlFor="pref-email-notifications" className="cursor-pointer text-[11px] leading-relaxed select-none">
              <span className="font-bold text-neutral-700 block mb-0.5">Opt-in Email Notifications</span>
              <span className="text-neutral-500 font-normal block leading-normal font-sans">
                Receive recap emails, roster updates, session schedules, and cancellations for active campaigns.
              </span>
            </label>
          </div>
 
          <div className="bg-neutral-50 border border-neutral-150 p-3.5 rounded flex items-start gap-3">
            <input
              type="checkbox"
              id="pref-browser-notifications"
              checked={browserNotifications}
              onChange={(e) => handleNotificationToggle(e.target.checked)}
              className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer animate-none"
            />
            <label htmlFor="pref-browser-notifications" className="cursor-pointer text-[11px] leading-relaxed select-none">
              <span className="font-bold text-neutral-700 block mb-0.5">Opt-in Browser Notifications</span>
              <span className="text-neutral-500 font-normal block leading-normal">
                Live push notifications when other players update votes or notes, or when game days are scheduled.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving || !displayName.trim()}
            id="btn-save-profile-settings"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs cursor-pointer transition-colors"
          >
            {isSaving ? 'Saving Changes...' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </div>
  );
}
