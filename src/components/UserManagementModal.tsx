import React, { useState } from 'react';
import { UserProfile, Campaign } from '../types';
import { X, Shield, Search, Check, Folder, Sparkles, User, Info, Cog } from 'lucide-react';

interface UserManagementModalProps {
  currentUserProfile: UserProfile | null;
  registeredUsers: UserProfile[];
  campaigns: Campaign[];
  onSaveUserPermissions: (
    targetUserId: string,
    isDmStatus: boolean,
    managedCampaignIds: string[],
    gmailCalendarSync: boolean,
    browserNotificationsEnabled: boolean,
    emailNotificationsEnabled: boolean
  ) => Promise<void>;
  onClose: () => void;
}

export default function UserManagementModal({
  currentUserProfile,
  registeredUsers,
  campaigns,
  onSaveUserPermissions,
  onClose,
}: UserManagementModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // States for the selected user configuration
  const [isDm, setIsDm] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [gmailSync, setGmailSync] = useState(false);
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // Filter registered users (excluding current DM to prevent lockouts,
  // or showing them to let them see their status, but let's allow configuring other users)
  const filteredUsers = registeredUsers.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.uid !== currentUserProfile?.uid &&
      (u.displayName?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
    );
  });

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUserId(user.uid);
    setIsDm(user.isDm || false);
    setSelectedCampaignIds(user.managedCampaignIds || []);
    setGmailSync(user.gmailCalendarSync || false);
    setBrowserNotifications(user.browserNotificationsEnabled || false);
    setEmailNotifications(user.emailNotificationsEnabled || false);
  };

  const handleCampaignToggle = (campId: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campId) ? prev.filter((id) => id !== campId) : [...prev, campId]
    );
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setIsSaving(true);
    try {
      await onSaveUserPermissions(
        selectedUserId,
        isDm,
        selectedCampaignIds,
        gmailSync,
        browserNotifications,
        emailNotifications
      );
      // Keep selected user but reload values from state or refresh
      setIsSaving(false);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const activeSelectedUser = registeredUsers.find((u) => u.uid === selectedUserId);

  return (
    <div
      id="user-management-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs"
    >
      <div
        id="user-management-modal-container"
        className="w-full max-w-4xl h-[600px] bg-white border border-neutral-200 rounded-xl shadow-xl flex flex-col overflow-hidden font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-600">
              <Cog size={18} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-850 uppercase tracking-tight">
                🛡️ DM Authority & Access Management Panel
              </h2>
              <p className="text-[10px] text-neutral-500 font-mono">
                Give logged-in accounts DM Rank & access to manage specific campaigns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body (Split view panel) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel: Accounts List */}
          <div className="w-1/3 border-r border-neutral-200 flex flex-col bg-neutral-50/50">
            {/* Search Input */}
            <div className="p-3 border-b border-neutral-150 relative shrink-0">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
              <input
                type="text"
                placeholder="Search registered users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            {/* List of Users */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1">
                Registered Players ({filteredUsers.length})
              </div>
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400 font-mono">
                  No other active users found
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isUserActive = selectedUserId === u.uid;
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between gap-1 cursor-pointer ${
                        isUserActive
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-xs'
                          : 'bg-white border-neutral-150 hover:bg-neutral-50 hover:border-neutral-250 text-neutral-700'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <p className="font-bold truncate">{u.displayName}</p>
                        <p className="text-[10px] text-neutral-400 font-mono truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {u.isDm && (
                          <span className="text-[8px] font-mono font-bold bg-amber-150 text-amber-900 px-1 py-0.2 rounded border border-amber-300 uppercase shrink-0">
                            DM
                          </span>
                        )}
                        {u.managedCampaignIds && u.managedCampaignIds.length > 0 && (
                          <span className="text-[8px] font-mono bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold uppercase shrink-0" title={`${u.managedCampaignIds.length} campaigns managed`}>
                            {u.managedCampaignIds.length}C
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Configurations */}
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            {activeSelectedUser ? (
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  {/* User Profile Header Header */}
                  <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-lg flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 border border-emerald-250 flex items-center justify-center text-emerald-800 font-bold font-sans text-sm shadow-inner shrink-0">
                      {activeSelectedUser.displayName ? activeSelectedUser.displayName[0].toUpperCase() : 'U'}
                    </div>
                    <div className="truncate">
                      <h3 className="font-bold text-sm text-neutral-800 truncate">{activeSelectedUser.displayName}</h3>
                      <p className="text-xs text-neutral-500 font-mono trunk-width truncate">{activeSelectedUser.email}</p>
                    </div>
                  </div>

                  {/* Section 1: Promote Toggle */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono">
                      1. Global DM rank Authority
                    </h4>
                    <div className="bg-white border border-neutral-200 p-4 rounded-lg flex items-start gap-4 hover:border-neutral-250 transition-colors">
                      <input
                        type="checkbox"
                        id="user-is-dm-toggle"
                        checked={isDm}
                        onChange={(e) => setIsDm(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="user-is-dm-toggle" className="cursor-pointer select-none">
                        <span className="font-bold text-xs text-neutral-700 block mb-0.5">
                          Promote to Global Dungeon Master
                        </span>
                        <span className="text-neutral-500 text-[11px] leading-normal block">
                          Activating this gives the user full DM privileges across the entire application, allowing them to schedule games, delete players, and manage permissions.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Section 2: Campaigns Access Checklist */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono">
                      2. Campaign-Specific Management Rights
                    </h4>
                    <span className="text-[11px] text-neutral-500 block leading-normal">
                      Authorize this account to co-manage, override start-times, and lock weekly schedule layouts for specific campaigns (even without global system DM privileges):
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[180px] overflow-y-auto pr-1">
                      {campaigns.map((camp) => {
                        const isChecked = selectedCampaignIds.includes(camp.id);
                        return (
                          <div
                            key={camp.id}
                            onClick={() => handleCampaignToggle(camp.id)}
                            className={`p-3 border rounded-lg flex items-center justify-between gap-2.5 cursor-pointer select-none transition-all ${
                              isChecked
                                ? 'bg-emerald-50/40 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-white hover:bg-neutral-50 border-neutral-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Folder size={14} className={isChecked ? 'text-emerald-600' : 'text-neutral-400'} />
                              <span className="text-xs truncate">{camp.name}</span>
                            </div>
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-neutral-300 bg-white'
                              }`}
                            >
                              {isChecked && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Communication & Notification Preferences */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono">
                      3. Manage User Notification Opt-ins
                    </h4>
                    <span className="text-[11px] text-neutral-500 block leading-normal">
                      Manually override communication and integration settings on behalf of this user:
                    </span>

                    <div className="space-y-2.5 bg-neutral-50/50 border border-neutral-200 p-3.5 rounded-lg">
                      {/* Email Notifications */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px] leading-snug">
                          <span className="font-bold text-neutral-700 block">Opt-in Email Notifications</span>
                          <span className="text-neutral-500 font-normal">
                            Deliver email recaps, scheduled game sessions, or notifications on agenda changes.
                          </span>
                        </div>
                      </label>

                      <div className="border-t border-neutral-150" />

                      {/* Google Calendar Sync */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={gmailSync}
                          onChange={(e) => setGmailSync(e.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px] leading-snug">
                          <span className="font-bold text-neutral-700 block">Enable Google Calendar Sync</span>
                          <span className="text-neutral-500 font-normal">
                            Create and synchronize dynamic schedule events onto their Google Calendar list programmatically.
                          </span>
                        </div>
                      </label>

                      <div className="border-t border-neutral-150" />

                      {/* Browser Push Notifications */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={browserNotifications}
                          onChange={(e) => setBrowserNotifications(e.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px] leading-snug">
                          <span className="font-bold text-neutral-700 block">Opt-in Browser Notifications</span>
                          <span className="text-neutral-500 font-normal">
                            Grant push alerts on active browser contexts whenever votes, schedules, or rosters shift.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Save Block Footer */}
                <div className="pt-4 mt-6 border-t border-neutral-150 flex items-center justify-end gap-3 bg-white shrink-0">
                  <span className="text-[11px] text-neutral-400 italic">
                    Changes take effect live instantly.
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="bg-emerald-650 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded shadow-xs focus:outline-none transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Permissions'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-400">
                <Shield size={32} className="mb-3 text-neutral-250 animate-pulse" />
                <p className="font-bold text-neutral-700 text-sm">No Player Account Selected</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  Click on any player account in the left panel list to edit their global DM privileges and campaign control assignments.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
