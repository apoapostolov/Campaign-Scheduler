import { Shield, Settings, LogOut, CheckCircle, Flame, UserCog } from 'lucide-react';
import GSIButton from './GSIButton';
import { UserProfile, Campaign } from '../types';

interface HeaderProps {
  userProfile: UserProfile | null;
  activeCampaign: Campaign | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  isLoggingIn: boolean;
  onClaimDM: () => Promise<void>;
  isClaiming: boolean;
  onOpenUserManagement?: () => void;
}

export default function Header({
  userProfile,
  activeCampaign,
  onLogin,
  onLogout,
  onOpenSettings,
  isLoggingIn,
  onClaimDM,
  isClaiming,
  onOpenUserManagement,
}: HeaderProps) {
  const isDM = userProfile && (
    userProfile.isDm === true ||
    (activeCampaign && (
      activeCampaign.dmUserId === userProfile.uid ||
      userProfile.managedCampaignIds?.includes(activeCampaign.id) ||
      activeCampaign.coDms?.includes(userProfile.uid) ||
      (userProfile.email && activeCampaign.dmEmail?.toLowerCase() === userProfile.email.toLowerCase()) ||
      activeCampaign.dmUserId === 'seed-dm' ||
      activeCampaign.dmUserId === 'seed-dm-apostol'
    ))
  );

  return (
    <header className="bg-white border-b border-neutral-200 py-2.5 px-4 sm:px-6 mb-4 flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        {/* Elegant Spreadsheet Green Icon Style logo */}
        <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 shadow-sm flex items-center justify-center shrink-0">
          <Flame className="text-emerald-600 rotate-12 shrink-0" size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <h1 className="text-sm sm:text-base font-bold text-neutral-800 tracking-tight truncate">
              Adventure Scheduler
            </h1>
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-150 px-1 py-0.2 rounded font-mono font-semibold shrink-0">
              v2.0
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-neutral-500 truncate mt-0.5">
            <span className="inline md:hidden">DMs & players grid</span>
            <span className="hidden md:inline">Roster availability coordinates for DMs & players</span>
          </p>
        </div>
      </div>

      {userProfile ? (
        <div className="flex items-center gap-2 shrink-0">
          {/* Claim DM Override Button */}
          {activeCampaign && !isDM && (
            <button
              onClick={onClaimDM}
              disabled={isClaiming}
              id="header-claim-dm-btn"
              className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-2 py-1 text-[10px] rounded border border-amber-200 transition-all cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
              title="Claim being Dungeon Master on this active campaign settings"
            >
              <Shield size={10} />
              <span className="hidden xs:inline">{isClaiming ? 'Claiming...' : 'Claim DM'}</span>
              <span className="inline xs:hidden">{isClaiming ? '...' : 'Claim'}</span>
            </button>
          )}

          {/* Account profile menu dropdown resembling Google Workspace account status */}
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 p-1 rounded-lg shadow-sm">
            <div className="text-right pl-1.5 hidden md:block">
              <div className="flex items-center justify-end gap-1.5 leading-none">
                {isDM && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1 py-0.2 rounded font-extrabold font-mono tracking-tight shrink-0 select-none">
                    DM
                  </span>
                )}
                <p className="text-xs font-bold text-neutral-700 truncate max-w-[100px]">
                  {userProfile.displayName}
                </p>
              </div>
              <p className="text-[9px] text-neutral-400 truncate max-w-[100px] mt-0.5">
                {userProfile.email}
              </p>
            </div>

            {isDM && onOpenUserManagement && (
              <button
                onClick={onOpenUserManagement}
                className="p-1 text-neutral-500 hover:text-emerald-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                title="Manage DM Authority and Co-DM Assignments"
                id="header-user-management-btn"
              >
                <UserCog size={13} />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-1 text-neutral-500 hover:text-emerald-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              title="Preferences and Google sync profile settings"
            >
              <Settings size={13} />
            </button>

            <button
              onClick={onLogout}
              className="p-1 text-neutral-500 hover:text-rose-650 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              title="Sign out of scheduler session"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 scale-90 sm:scale-100 origin-right">
          <GSIButton onClick={onLogin} isLoading={isLoggingIn} />
        </div>
      )}
    </header>
  );
}
