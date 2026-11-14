import React, { useState } from 'react';
import { Campaign, UserProfile, UserAvailability } from '../types';
import { Shield, Sparkles, UserCheck, AlertCircle } from 'lucide-react';

interface DmAuthorityDashboardProps {
  campaign: Campaign;
  availabilities: UserAvailability[];
  registeredUsers: UserProfile[];
  onReassignDm: (newDmId: string, newDmName: string, newDmEmail: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function DmAuthorityDashboard({
  campaign,
  availabilities,
  registeredUsers,
  onReassignDm,
  isSubmitting,
}: DmAuthorityDashboardProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // Custom input fields as fallback / override
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // Combine real users & roster players to give a list of potential new DMs
  const candidates: { id: string; name: string; email: string }[] = [];

  // Add registered users
  registeredUsers.forEach((u) => {
    if (!candidates.some((c) => c.id === u.uid)) {
      candidates.push({ id: u.uid, name: u.displayName, email: u.email });
    }
  });

  // Add roster members if not already listed
  availabilities.forEach((a) => {
    if (!candidates.some((c) => c.id === a.userId)) {
      // Stub users don't have explicit email, we assume a placeholder
      candidates.push({
        id: a.userId,
        name: a.playerName,
        email: a.userId.startsWith('roster-') ? `${a.playerName.toLowerCase().replace(/\s+/g, '')}@no-gcal.com` : '',
      });
    }
  });

  const handleUpdateDM = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetId = '';
    let targetName = '';
    let targetEmail = '';

    if (useCustom) {
      if (!customName.trim() || !customEmail.trim()) {
        alert('Please fill out custom DM name and email');
        return;
      }
      targetId = `custom-dm-${Date.now()}`;
      targetName = customName.trim();
      targetEmail = customEmail.trim();
    } else {
      const match = candidates.find((c) => c.id === selectedUserId);
      if (!match) {
        alert('Please choose a candidate first');
        return;
      }
      targetId = match.id;
      targetName = match.name;
      targetEmail = match.email || `${match.name.toLowerCase()}@example.com`;
    }

    const confirmTransfer = window.confirm(
      `Transfer Dungeon Master Authority of "${campaign.name}" to ${targetName} (${targetEmail})?\n\nThey will gain write permissions for schedule locking, notifications, and DM panels.`
    );

    if (confirmTransfer) {
      await onReassignDm(targetId, targetName, targetEmail);
      // Reset custom inputs
      setCustomName('');
      setCustomEmail('');
      setUseCustom(false);
      setSelectedUserId('');
    }
  };

  return (
    <div id="dm-authority-dashboard" className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3.5 border-b border-neutral-100">
        <div className="bg-rose-50 p-1.5 rounded border border-rose-200 shrink-0">
          <Shield className="text-rose-700 font-bold" size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-tight">
            DM Designation & Transfer Desk
          </h3>
          <p className="text-[10px] text-neutral-500 font-mono">
            Directly re-assign campaign lead and authority
          </p>
        </div>
      </div>

      <p className="text-xs text-neutral-600 leading-normal">
        Select any player in the system or on the active roster, or type in new credentials to instantly promote them to be the campaign's active Dungeon Master.
      </p>

      <form onSubmit={handleUpdateDM} className="space-y-4 text-xs">
        {/* Toggle Mode */}
        <div className="flex items-center gap-4 bg-neutral-50 p-2.5 rounded border border-neutral-200">
          <label className="flex items-center gap-1.5 font-semibold text-neutral-700 cursor-pointer select-none">
            <input
              type="radio"
              checked={!useCustom}
              onChange={() => setUseCustom(false)}
              className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            Pick Existing Player
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-neutral-700 cursor-pointer select-none">
            <input
              type="radio"
              checked={useCustom}
              onChange={() => setUseCustom(true)}
              className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            Manual Override DM Details
          </label>
        </div>

        {!useCustom ? (
          <div>
            <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1">
              Select Candidate Player
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-rose-500"
              required={!useCustom}
            >
              <option value="">-- Choose Roster Player / Signed-up Account --</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.email ? `(${c.email})` : ''} {c.id === campaign.dmUserId ? '⭐️ (Current DM)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1">
                New DM Display Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Nicola"
                className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-rose-500 font-sans"
                required={useCustom}
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1">
                New DM Calendar Email
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="e.g. master@gcal.com"
                className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-rose-500 font-mono"
                required={useCustom}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || (!useCustom && !selectedUserId)}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded text-xs cursor-pointer select-none disabled:opacity-40"
        >
          <UserCheck size={14} /> Promote to Dungeon Master
        </button>
      </form>

      <div className="flex items-start gap-1.5 bg-neutral-50 p-2.5 rounded text-[10px] text-neutral-500 leading-normal border border-neutral-150">
        <AlertCircle size={12} className="shrink-0 mt-0.5" />
        <p>
          Current Active DM is <span className="font-semibold text-neutral-700">{campaign.dmName}</span> ({campaign.dmEmail}). Promoting shifts all scheduling permissions over instantly.
        </p>
      </div>
    </div>
  );
}
