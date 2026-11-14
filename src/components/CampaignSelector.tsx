import React, { useEffect, useRef } from 'react';
import { Campaign } from '../types';
import { Shield, Sparkles, Plus } from 'lucide-react';

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaignId: string;
  onSelectCampaign: (id: string) => void;
  currentUserId: string | null;
  onOpenCreateModal: () => void;
}

export default function CampaignSelector({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  currentUserId,
  onOpenCreateModal,
}: CampaignSelectorProps) {
  const tabsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const activeTab = tabsRef.current[selectedCampaignId];
    if (activeTab) {
      // Smoothly scroll the active tab into the center of the scroll container
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedCampaignId]);

  return (
    <div id="campaign-selector-container" className="mb-0">
      {/* GCal Sheets Workbook Tabs bar resting directly on top of the container below */}
      <div className="flex flex-row items-end justify-between gap-2 border-b border-neutral-200 px-1 pt-1.5 overflow-hidden">
        {/* Dynamic Sheets tabs containing campaigns */}
        <div className="flex flex-nowrap items-end gap-1 overflow-x-auto pt-1 pb-0 scrollbar-none max-w-full">
          {campaigns.map((c) => {
            const isSelected = c.id === selectedCampaignId;
            const isDM = currentUserId && c.dmUserId === currentUserId;

            return (
              <div
                key={c.id}
                ref={(el) => {
                  tabsRef.current[c.id] = el;
                }}
                id={`campaign-card-${c.id}`}
                onClick={() => onSelectCampaign(c.id)}
                className={`relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border-t-2 select-none h-9 shrink-0 ${
                  isSelected
                    ? 'bg-white border-t-emerald-600 border-x border-b-white border-x-neutral-200 text-emerald-700 rounded-t -mb-[1px] z-10'
                    : 'bg-transparent border-t-transparent hover:bg-neutral-200/55 text-neutral-600 border-x border-x-transparent hover:border-x-neutral-200 hover:border-t-neutral-250 rounded-t'
                }`}
              >
                {/* Visual dropdown/indicator like Google Sheets tab OR DM badge */}
                {isDM ? (
                  <span
                    className={`text-[8px] font-mono font-extrabold px-1 py-0.2 rounded shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-emerald-600 border border-emerald-600 text-white' 
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                    }`}
                    title="Dungeon Master Permission Rank"
                  >
                    DM
                  </span>
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                )}
                
                <span className="font-semibold tracking-tight max-w-[140px] truncate hidden sm:inline">
                  {c.name}
                </span>
                <span className="font-semibold tracking-tight truncate inline sm:hidden">
                  {c.name.length > 8 ? `${c.name.slice(0, 8)}...` : c.name}
                </span>

                <span className="font-mono text-[9px] bg-neutral-100 border border-neutral-200 text-neutral-500 px-1 py-0.2 rounded font-medium">
                  #{c.sessionCounter}
                </span>
              </div>
            );
          })}
        </div>

        {/* Add sheet / plus button */}
        <button
          onClick={onOpenCreateModal}
          id="btn-add-campaign"
          className="inline-flex items-center justify-center gap-1 text-xs bg-white hover:bg-emerald-50 text-emerald-700 border border-neutral-200 hover:border-emerald-300 font-semibold px-2.5 sm:px-3 py-1 rounded-t border-b-0 -mb-[1px] transition-all cursor-pointer h-8 shrink-0 self-end mb-0.5 sm:mb-0"
          title="Add New Game Campaign"
        >
          <Plus size={14} className="stroke-[2.5]" />
          <span className="hidden sm:inline">Add Game</span>
        </button>
      </div>
    </div>
  );
}
