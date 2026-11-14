/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, googleSignIn, logout, OperationType, handleFirestoreError } from './firebase';
import { Campaign, UserAvailability, UserProfile, GameSession, AvailabilityStatus } from './types';
import { seedCampaignsIfEmpty } from './utils/dbSeed';
import { parseWeekRangeToDates, getWeekRangeLabel, getSpecificWeekdayDate } from './utils/weekUtils';
import {
  notifyDmOfAvailabilityChange,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  sendDmPreGameSummary,
  sendGmailMessage
} from './utils/googleApis';

// Modular Layout components
import Header from './components/Header';
import CampaignSelector from './components/CampaignSelector';
import AvailabilityTable from './components/AvailabilityTable';
import EditProfileModal from './components/EditProfileModal';
import UserManagementModal from './components/UserManagementModal';

// Icons
import { Shield, HelpCircle, Swords, Calendar, Flame, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Core application states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastSelectedCampaignId') || 'thekeep';
    }
    return 'thekeep';
  });
  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || null;
  
  // Sync selectedCampaignId with localStorage
  useEffect(() => {
    if (selectedCampaignId) {
      localStorage.setItem('lastSelectedCampaignId', selectedCampaignId);
    }
  }, [selectedCampaignId]);

  const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);

  // Status flags
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isSyncingPlayerCalendar, setIsSyncingPlayerCalendar] = useState(false);
  const [isSendingPreGameSummary, setIsSendingPreGameSummary] = useState(false);
  const [isDmSubmitting, setIsDmSubmitting] = useState(false);

  // Modals visibility
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);

  // Input states for Add Campaign
  const [newCampName, setNewCampName] = useState('');
  const [newCampWeek, setNewCampWeek] = useState('11-17 June');
  const [newCampTrackDays, setNewCampTrackDays] = useState('7'); // "7" or "weekend"
  const [newCampRoster, setNewCampRoster] = useState('Alex, Victoria, Stefan');

  // Toast notifications state
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Notification refs to avoid initial load/switching spam
  const isInitialAvailsLoad = useRef(true);
  const isInitialCampaignLoad = useRef(true);
  const isInitialSessionLoad = useRef(true);
  
  const prevAvailabilitiesRef = useRef<UserAvailability[]>([]);
  const prevActiveCampaignRef = useRef<Campaign | null>(null);
  const prevActiveSessionRef = useRef<GameSession | null>(null);

  // Trigger local browser push notifications
  const triggerNotification = useCallback((title: string, body: string) => {
    if (!userProfile?.browserNotificationsEnabled) return;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch (err) {
          console.warn('Failed to send browser notification:', err);
        }
      }
    }
  }, [userProfile?.browserNotificationsEnabled]);

  // Trigger seeding and listen to campaigns (unlogged or logged users)
  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsSeeding(true);
      try {
        // Run seed check first with user context to link DM roles if empty
        await seedCampaignsIfEmpty(user?.email || undefined, user?.uid || 'seed-dm');
      } catch (err) {
        console.warn('Seeding check skipped or failed:', err);
      } finally {
        setIsSeeding(false);
      }
    };
    fetchCampaigns();

    // Listen to Campaign collection live snapshot
    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const list: Campaign[] = [];
        snap.forEach((d) => {
          list.push(d.data() as Campaign);
        });
        setCampaigns(list);
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('lastSelectedCampaignId') : null;
        if (storedId && list.some(c => c.id === storedId)) {
          if (selectedCampaignId !== storedId) {
            setSelectedCampaignId(storedId);
          }
        } else if (list.length > 0 && !list.some(c => c.id === selectedCampaignId)) {
          setSelectedCampaignId(list[0].id);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'campaigns');
      }
    );

    return () => unsubCampaigns();
  }, [user]);

  // Set up Firebase auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Look up profile in Firestore
        const profileRef = doc(db, 'users', firebaseUser.uid);
        try {
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data() as UserProfile);
          } else {
            // First time registration profile
            const nickname = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player';
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: nickname,
              gmailCalendarSync: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(profileRef, defaultProfile);
            setUserProfile(defaultProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setAccessToken(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // Listen to all registered users (only when signed in)
  useEffect(() => {
    if (!user) {
      setRegisteredUsers([]);
      return;
    }
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          list.push(d.data() as UserProfile);
        });
        setRegisteredUsers(list);
      },
      (error) => {
        console.error('Failed to listen to users collection:', error);
      }
    );
    return () => unsubUsers();
  }, [user]);

  // Listen to availabilities and session for current selectedCampaignId
  useEffect(() => {
    if (!selectedCampaignId) {
      setAvailabilities([]);
      setActiveSession(null);
      return;
    }

    // Listen to player availabilities
    const availRef = collection(db, 'campaigns', selectedCampaignId, 'availabilities');
    const unsubAvails = onSnapshot(
      availRef,
      (snap) => {
        const list: UserAvailability[] = [];
        snap.forEach((d) => {
          list.push(d.data() as UserAvailability);
        });
        setAvailabilities(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `campaigns/${selectedCampaignId}/availabilities`);
      }
    );

    // Listen to session scheduler current document
    const sessRef = doc(db, 'campaigns', selectedCampaignId, 'sessions', 'current');
    const unsubSession = onSnapshot(
      sessRef,
      (snap) => {
        if (snap.exists()) {
          setActiveSession(snap.data() as GameSession);
        } else {
          setActiveSession(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `campaigns/${selectedCampaignId}/sessions/current`);
      }
    );

    return () => {
      unsubAvails();
      unsubSession();
    };
  }, [selectedCampaignId]);

  // Reset initial load and ref states on campaign change to prevent false-alert spam
  useEffect(() => {
    isInitialAvailsLoad.current = true;
    isInitialCampaignLoad.current = true;
    isInitialSessionLoad.current = true;
    prevAvailabilitiesRef.current = [];
    prevActiveCampaignRef.current = null;
    prevActiveSessionRef.current = null;
  }, [selectedCampaignId]);

  // Poll & detect availability changes to trigger browser push notifications
  useEffect(() => {
    if (!activeCampaign) return;

    if (isInitialAvailsLoad.current) {
      if (availabilities.length > 0) {
        isInitialAvailsLoad.current = false;
        prevAvailabilitiesRef.current = availabilities;
      }
      return;
    }

    const prev = prevAvailabilitiesRef.current;
    const currentWeek = activeCampaign.currentWeekRange;

    // Check newly added or updated player availabilities
    availabilities.forEach((newAva) => {
      const oldAva = prev.find((a) => a.userId === newAva.userId);
      
      // Skip notifications for self-edits
      if (user && newAva.userId === user.uid) return;

      if (!oldAva) {
        // Enrolled roster player slot added!
        triggerNotification(
          '⚔️ Roster Updated',
          `${newAva.playerName} has enrolled on the roster!`
        );
      } else {
        // Evaluate selections and notes difference
        const oldWeek = oldAva.weeklyData?.[currentWeek] || { selections: {}, notes: '' };
        const newWeek = newAva.weeklyData?.[currentWeek] || { selections: {}, notes: '' };

        const changedDays: string[] = [];
        activeCampaign.daysTracked.forEach((day) => {
          const oldVal = oldWeek.selections?.[day] || 'NO-VOTE';
          const newVal = newWeek.selections?.[day] || 'NO-VOTE';
          if (oldVal !== newVal) {
            changedDays.push(`${day} (${newVal})`);
          }
        });

        if (changedDays.length > 0) {
          triggerNotification(
            '🗳️ Roster Votes Changed',
            `${newAva.playerName} changed availability for week ${currentWeek}: ${changedDays.join(', ')}`
          );
        } else if (oldWeek.notes !== newWeek.notes) {
          triggerNotification(
            '📝 Note Changed',
            `${newAva.playerName} updated week ${currentWeek} notes: "${newWeek.notes}"`
          );
        }
      }
    });

    // Check removed player availabilities
    prev.forEach((oldAva) => {
      if (!availabilities.some((a) => a.userId === oldAva.userId)) {
        if (user && oldAva.userId === user.uid) return;
        triggerNotification(
          '⚔️ Roster Updated',
          `${oldAva.playerName} was removed from the roster.`
        );
      }
    });

    prevAvailabilitiesRef.current = availabilities;
  }, [availabilities, activeCampaign, user, triggerNotification]);

  // Poll & detect active campaign setting updates to trigger browser push notifications
  useEffect(() => {
    if (!activeCampaign) return;

    if (isInitialCampaignLoad.current) {
      isInitialCampaignLoad.current = false;
      prevActiveCampaignRef.current = activeCampaign;
      return;
    }

    const prev = prevActiveCampaignRef.current;
    if (prev && prev.id === activeCampaign.id) {
      // 1. Days track/untrack list or disabled/inactive days changes (available/unavailable days)
      const prevInactive = prev.inactiveDays || [];
      const currInactive = activeCampaign.inactiveDays || [];
      
      const inactivated = currInactive.filter((d) => !prevInactive.includes(d));
      const activated = prevInactive.filter((d) => !currInactive.includes(d));

      if (inactivated.length > 0 || activated.length > 0) {
        // Skip self-edited notification (DM is editing their settings)
        const isSelfDm = user && prev.dmUserId === user.uid;
        if (!isSelfDm) {
          const detailsList: string[] = [];
          if (inactivated.length > 0) detailsList.push(`unavailable: ${inactivated.join(', ')}`);
          if (activated.length > 0) detailsList.push(`available: ${activated.join(', ')}`);
          
          triggerNotification(
            '📅 Calendar Days Changed',
            `Dungeon Master changed schedule bounds list (${detailsList.join('; ')}).`
          );
        }
      }

      // 2. Game day is selected (gameWeekDays changed)
      const currentWeek = activeCampaign.currentWeekRange;
      const prevGameDay = prev.gameWeekDays?.[currentWeek];
      const currGameDay = activeCampaign.gameWeekDays?.[currentWeek];

      if (prevGameDay !== currGameDay && currGameDay) {
        const isSelfDm = user && prev.dmUserId === user.uid;
        if (!isSelfDm) {
          triggerNotification(
            '🎲 Game Day Selected!',
            `The Dungeon Master locked in ${currGameDay} as the game session day for week "${currentWeek}"!`
          );
        }
      }
    }

    prevActiveCampaignRef.current = activeCampaign;
  }, [activeCampaign, user, triggerNotification]);

  // Poll & detect session status modifications to trigger browser push notifications
  useEffect(() => {
    if (!activeSession || !activeCampaign) return;

    if (isInitialSessionLoad.current) {
      isInitialSessionLoad.current = false;
      prevActiveSessionRef.current = activeSession;
      return;
    }

    const prev = prevActiveSessionRef.current;
    if (prev && prev.id === activeSession.id) {
      // A session has scheduled status: proposed -> scheduled
      if (prev.status !== 'scheduled' && activeSession.status === 'scheduled') {
        const formattedDate = activeSession.scheduledDateTime
          ? new Date(activeSession.scheduledDateTime).toLocaleDateString('bg-BG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';
        triggerNotification(
          '⚡ Session Scheduled!',
          `Bring your gear! Game session is officially scheduled start on ${formattedDate}!`
        );
      } else if (prev.status === 'scheduled' && activeSession.status === 'cancelled') {
        triggerNotification(
          '❌ Session Cancelled',
          `The scheduled campaign session has been cancelled or moved back to proposal.`
        );
      }
    }

    prevActiveSessionRef.current = activeSession;
  }, [activeSession, activeCampaign, triggerNotification]);

  // Automatically move currentWeekRange to next week once designated session day passes
  useEffect(() => {
    if (!activeCampaign) return;

    const performAutoRotation = async () => {
      try {
        const parsed = parseWeekRangeToDates(activeCampaign.currentWeekRange);
        if (!parsed) return;

        const { monday } = parsed;
        const weekGameDay = activeCampaign.gameWeekDays?.[activeCampaign.currentWeekRange];
        let sessionDayDate: Date | null = null;

        if (weekGameDay) {
          const currentWeekTime = activeCampaign.gameWeekTimeOverrides?.[activeCampaign.currentWeekRange] || activeCampaign.sessionTime || '19:30';
          sessionDayDate = getSpecificWeekdayDate(activeCampaign.currentWeekRange, weekGameDay, currentWeekTime);
          // Add standard game duration (e.g., 4 hours) buffer so it counts after game ends or passes
          if (sessionDayDate) {
            sessionDayDate = new Date(sessionDayDate.getTime() + 4 * 60 * 60 * 1000);
          }
        } else {
          // Fallback to designatedSessionDay or Sunday
          const designated = activeCampaign.designatedSessionDay || 'Неделя';
          sessionDayDate = getSpecificWeekdayDate(activeCampaign.currentWeekRange, designated, '23:59');
        }

        if (sessionDayDate) {
          const now = new Date();
          if (now > sessionDayDate) {
            const nextMonday = new Date(monday);
            nextMonday.setDate(monday.getDate() + 7);
            const nextWeekLabel = getWeekRangeLabel(nextMonday);

            console.log(`Auto-advancing campaign "${activeCampaign.name}" to next week: ${nextWeekLabel} (passed ${sessionDayDate.toLocaleString()})`);

            const updatedFields: Partial<Campaign> = {
              currentWeekRange: nextWeekLabel
            };

            // Increment sessionCounter if a game day was selected and completed
            if (weekGameDay) {
              updatedFields.sessionCounter = activeCampaign.sessionCounter + 1;
              showToast('Session passed! Count updated.', 'success');
            }

            await handleUpdateCampaignSettings(updatedFields);
            showToast(`Moved forward to ${nextWeekLabel}!`, 'info');
          }
        }
      } catch (err) {
        console.warn('Auto week rotation check skipped/failed:', err);
      }
    };

    performAutoRotation();
  }, [
    activeCampaign?.id, 
    activeCampaign?.currentWeekRange, 
    activeCampaign?.designatedSessionDay, 
    activeCampaign?.gameWeekDays,
    activeCampaign?.gameWeekTimeOverrides,
    activeCampaign?.sessionTime
  ]);

  // Handle SignIn
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setUserProfile(null);
    setAccessToken(null);
  };

  // Profile save Preferences callback
  const handleSaveProfileSettings = async (
    displayName: string,
    gmailSync: boolean,
    browserNotificationsEnabled: boolean,
    emailNotificationsEnabled: boolean
  ) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    const updated: UserProfile = {
      ...userProfile,
      uid: user.uid,
      email: user.email || '',
      displayName,
      gmailCalendarSync: gmailSync,
      browserNotificationsEnabled,
      emailNotificationsEnabled,
      createdAt: userProfile?.createdAt || new Date().toISOString(),
    };
    await setDoc(profileRef, updated);
    setUserProfile(updated);

    // Sync player's own active availability record if enrolled
    if (activeCampaign && availabilities.some(a => a.userId === user.uid)) {
      const myAvailRef = doc(db, 'campaigns', activeCampaign.id, 'availabilities', user.uid);
      const existingAva = availabilities.find(a => a.userId === user.uid);
      if (existingAva) {
        await setDoc(myAvailRef, {
          ...existingAva,
          playerName: displayName,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // Save user permissions (DM assignments & campaign access controls)
  const handleSaveUserPermissions = async (
    targetUserId: string,
    isDmStatus: boolean,
    managedCampaignIds: string[],
    gmailCalendarSync: boolean,
    browserNotificationsEnabled: boolean,
    emailNotificationsEnabled: boolean
  ) => {
    try {
      // 1. Update the UserProfile in Firestore
      const userRef = doc(db, 'users', targetUserId);
      await updateDoc(userRef, {
        isDm: isDmStatus,
        managedCampaignIds: managedCampaignIds,
        gmailCalendarSync,
        browserNotificationsEnabled,
        emailNotificationsEnabled
      });

      // 2. Adjust campaign coDms lists
      for (const camp of campaigns) {
        const isManagedNow = managedCampaignIds.includes(camp.id);
        let updatedCoDms = camp.coDms || [];
        const containsUser = updatedCoDms.includes(targetUserId);

        if (isManagedNow && !containsUser) {
          updatedCoDms = [...updatedCoDms, targetUserId];
          await updateDoc(doc(db, 'campaigns', camp.id), { coDms: updatedCoDms });
        } else if (!isManagedNow && containsUser) {
          updatedCoDms = updatedCoDms.filter((uid) => uid !== targetUserId);
          await updateDoc(doc(db, 'campaigns', camp.id), { coDms: updatedCoDms });
        }
      }

      showToast("Permissions updated!", "success");
    } catch (err) {
      console.error("Failed to update user permissions:", err);
      showToast("Error updating permissions", "error");
    }
  };

  // Claim rank DM for selected campaign
  const handleClaimDM = async () => {
    if (!user || !activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      const campRef = doc(db, 'campaigns', activeCampaign.id);
      const nameToSet = userProfile?.displayName || user.displayName || 'Anon DM';
      const updatedCampaignFields = {
        ...activeCampaign,
        dmUserId: user.uid,
        dmEmail: user.email || '',
        dmName: nameToSet + ' (DM)',
      };
      await setDoc(campRef, updatedCampaignFields);
      alert(`You are now the DM for "${activeCampaign.name}"!`);
    } catch (err) {
      console.error('Claim DM rank failed:', err);
      alert('Could not update rank. Please check your connections.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Re-assign campaign DM status (DM designation/delegation)
  const handleReassignDm = async (newDmId: string, newDmName: string, newDmEmail: string) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      const campRef = doc(db, 'campaigns', activeCampaign.id);
      const updatedCampaignFields = {
        ...activeCampaign,
        dmUserId: newDmId,
        dmEmail: newDmEmail,
        dmName: newDmName,
      };
      await setDoc(campRef, updatedCampaignFields);
      alert(`Authority transferred to "${newDmName}"!`);
    } catch (err) {
      console.error('Reassign DM failed:', err);
      alert('Failed to reassign DM. Check your connection.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Update Campaign metadata (DM action)
  const handleUpdateCampaignSettings = async (updatedFields: Partial<Campaign>) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      const campRef = doc(db, 'campaigns', activeCampaign.id);
      await setDoc(campRef, { ...activeCampaign, ...updatedFields });
    } catch (err) {
      console.error('Campaign settings save failed:', err);
      alert('Could not save settings. Please check your connection.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Toggle active / deactivated weekday status (DM action)
  const handleToggleDayActive = async (day: string) => {
    if (!activeCampaign) return;
    const currentWeek = activeCampaign.currentWeekRange;
    const isGameDay = activeCampaign.gameWeekDays?.[currentWeek] === day;
    if (isGameDay) {
      alert(`"${day}" is the locked Game Day! Please unlock it first.`);
      return;
    }
    const inactiveDays = activeCampaign.inactiveDays || [];
    let nextInactiveDays: string[];
    if (inactiveDays.includes(day)) {
      nextInactiveDays = inactiveDays.filter(d => d !== day);
      showToast(`${day} is active!`, 'success');
    } else {
      nextInactiveDays = [...inactiveDays, day];
      showToast(`${day} is deactivated.`, 'info');
    }
    await handleUpdateCampaignSettings({ inactiveDays: nextInactiveDays });
  };

  // Toggle weekly Game Day lock / unlock (DM action)
  const handleToggleGameDay = async (day: string) => {
    if (!activeCampaign) return;

    setIsDmSubmitting(true);
    try {
      const currentWeek = activeCampaign.currentWeekRange;
      const gameWeekDays = { ...(activeCampaign.gameWeekDays || {}) };
      const gameWeekCalendarEvents = { ...(activeCampaign.gameWeekCalendarEvents || {}) };

      const isCurrentGameDay = gameWeekDays[currentWeek] === day;
      const hasGoogleAccess = !!accessToken;

      if (isCurrentGameDay) {
        // Deselecting game day!
        delete gameWeekDays[currentWeek];
        const prevEventId = gameWeekCalendarEvents[currentWeek];
        
        if (prevEventId && hasGoogleAccess) {
          try {
            await deleteGoogleCalendarEvent(accessToken as string, prevEventId);
          } catch (calErr) {
            console.warn('Could not delete calendar event:', calErr);
          }
          delete gameWeekCalendarEvents[currentWeek];
        }

        if (hasGoogleAccess) {
          // Send cancellations to all campaign players in registeredUsers list
          const emailsToSendTo = registeredUsers
            .filter(u => activeCampaign.playerUids.includes(u.uid) || u.email === activeCampaign.dmEmail)
            .map(u => u.email);

          const uniqueEmails = Array.from(new Set(emailsToSendTo));

          for (const playerEmail of uniqueEmails) {
            try {
              const subject = `[D&D Scheduler] Session Cancelled / Rescheduled - ${activeCampaign.name}`;
              const body = `
                <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                  <div style="font-size: 24px; margin-bottom: 16px;">🎲</div>
                  <h3 style="color: #e11d48; margin-top: 0; font-size: 18px; font-weight: 700;">Session Cancelled or Rescheduled</h3>
                  <p style="font-size: 15px; color: #475569; line-height: 1.6;">
                    Greetings Adventurer,<br/><br/>
                    The game session scheduled for <strong>${day}</strong> (week of ${currentWeek}) for the campaign <strong>${activeCampaign.name}</strong> has been cancelled or rescheduled by your Dungeon Master.
                  </p>
                  <p style="font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
                    Please check the Campaign Scheduler grid to update your availability scores.
                  </p>
                </div>
              `;
              await sendGmailMessage(accessToken as string, playerEmail as string, subject, body);
            } catch (err) {
              console.warn(`Failed to send cancellation email to ${playerEmail}:`, err);
            }
          }
        }

        await handleUpdateCampaignSettings({
          gameWeekDays,
          gameWeekCalendarEvents
        });

        if (hasGoogleAccess) {
          showToast(`Removed Game Day and notified players!`, 'info');
        } else {
          showToast(`Game Day deselected.`, 'info');
        }
      } else {
        // Selecting game day!
        gameWeekDays[currentWeek] = day;

        const sessionTime = activeCampaign.gameWeekTimeOverrides?.[currentWeek] || activeCampaign.sessionTime || '19:30';
        const targetDate = getSpecificWeekdayDate(currentWeek, day, sessionTime);
        if (!targetDate) {
          throw new Error(`Failed to calculate session Date for day ${day}`);
        }

        if (hasGoogleAccess) {
          // Gather all eligible emails
          const skippedUserIds = availabilities
            .filter(ava => {
              const weekRecord = ava.weeklyData?.[currentWeek];
              const sel = weekRecord?.selections?.[day];
              return (sel || 'NO-VOTE') === 'SKIP';
            })
            .map(ava => ava.userId);

          const eligibleUsers = registeredUsers.filter(u => 
            (activeCampaign.playerUids.includes(u.uid) || u.uid === activeCampaign.dmUserId) && 
            !skippedUserIds.includes(u.uid)
          );

          const eligibleEmails: string[] = eligibleUsers
            .map(u => u.email)
            .filter((value, index, self) => self.indexOf(value) === index);

          // Create Google Calendar event
          let calId = undefined;
          try {
            const calendarResult = await createGoogleCalendarEvent(
              accessToken as string,
              activeCampaign.name,
              `Game Session (${currentWeek})`,
              targetDate.toISOString(),
              240, // 4 hours
              eligibleEmails
            );
            calId = calendarResult.id;
            gameWeekCalendarEvents[currentWeek] = calId;
          } catch (calErr) {
            console.warn('Google Calendar event creation failed:', calErr);
            showToast('Calendar sync failed; sending emails instead.', 'info');
          }

          // Send scheduled email notifications to everyone eligible
          for (const playerEmail of eligibleEmails) {
            try {
              const formattedDateStr = targetDate.toLocaleDateString('bg-BG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              const formattedTimeStr = targetDate.toLocaleTimeString('bg-BG', {
                hour: '2-digit',
                minute: '2-digit'
              });

              const subject = `[D&D Scheduler] GAME DAY scheduled for ${activeCampaign.name}!`;
              const body = `
                <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                  <div style="font-size: 24px; margin-bottom: 16px;">🎲</div>
                  <h3 style="color: #10b981; margin-top: 0; font-size: 18px; font-weight: 700;">Dice Are Rolling! Session Scheduled!</h3>
                  <p style="font-size: 15px; color: #475569; line-height: 1.6;">
                    Greetings Adventurer,<br/><br/>
                    Your Dungeon Master has locked in the game day for campaign <strong>${activeCampaign.name}</strong>!
                  </p>
                  <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 8px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #065f46;">
                      <strong>Campaign:</strong> ${activeCampaign.name}<br/>
                      <strong>When:</strong> ${formattedDateStr} at ${formattedTimeStr} (Bulgarian Time / Europe/Sofia)<br/>
                      <strong>Week Range:</strong> ${currentWeek}<br/>
                    </p>
                  </div>
                  <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                    The calendar invitation has been generated and sent to all eligible party members' calendars.
                  </p>
                  <p style="font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
                    Prepare your character sheets and spell slots! Safe travels!
                  </p>
                </div>
              `;
              await sendGmailMessage(accessToken as string, playerEmail as string, subject, body);
            } catch (err) {
              console.warn(`Failed to send scheduling email to ${playerEmail}:`, err);
            }
          }
        }

        await handleUpdateCampaignSettings({
          gameWeekDays,
          gameWeekCalendarEvents
        });

        if (hasGoogleAccess) {
          showToast(`Game Day set for ${day}! Invites sent.`, 'success');
        } else {
          showToast(`Game Day set for ${day}! Sign in with Google to sync calendars.`, 'success');
        }
      }
    } catch (err: any) {
      console.error('Toggle Game Day failed:', err);
      alert('Unable to change Game Day. Please check connection.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Propose days options list (DM action)
  const handleProposeDays = async (proposedDays: string[]) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      const sessRef = doc(db, 'campaigns', activeCampaign.id, 'sessions', 'current');
      const sessionData: GameSession = {
        id: 'current',
        status: 'proposed',
        scheduledDateTime: '',
        proposedDays,
        createdAt: activeSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(sessRef, sessionData);
    } catch (err) {
      console.error('Propose session failed:', err);
      alert('Failed to propose days.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Finalize selected session date (DM action)
  const handleFinalizeSession = async (dateTimeStr: string) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      // 1. Google Calendar event creation
      let calId = undefined;
      if (accessToken) {
        try {
          const calendarResult = await createGoogleCalendarEvent(
            accessToken,
            activeCampaign.name,
            `Session #${activeCampaign.sessionCounter + 1}`,
            dateTimeStr
          );
          calId = calendarResult.id;
        } catch (calErr) {
          console.warn('Google Calendar Event insert failed, proceeding to update DB regardless:', calErr);
        }
      }

      // 2. Save session documentation
      const sessRef = doc(db, 'campaigns', activeCampaign.id, 'sessions', 'current');
      const sessionData: GameSession = {
        id: 'current',
        status: 'scheduled',
        scheduledDateTime: new Date(dateTimeStr).toISOString(),
        calendarEventId: calId,
        sentOneDaySummary: false,
        createdAt: activeSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(sessRef, sessionData);

      // 3. Increment counters
      const campRef = doc(db, 'campaigns', activeCampaign.id);
      await setDoc(campRef, {
        ...activeCampaign,
        sessionCounter: activeCampaign.sessionCounter + 1,
      });

    } catch (err) {
      console.error('Finalize session failed:', err);
      alert('Failed to finalize session schedule.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Reset or clear current sessions status (DM option)
  const handleClearSession = async () => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      // Delete event from calendar if has Id
      if (accessToken && activeSession?.calendarEventId) {
        try {
          await deleteGoogleCalendarEvent(accessToken, activeSession.calendarEventId);
        } catch (calDelErr) {
          console.warn('Could not remove calendar event, clearing db anyway:', calDelErr);
        }
      }

      const sessRef = doc(db, 'campaigns', activeCampaign.id, 'sessions', 'current');
      await deleteDoc(sessRef);
    } catch (err) {
      console.error('Reset session failed:', err);
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Add / Enroll player name to active camp roster (DM action)
  const handleAddRosterPlayer = async (playerName: string) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      // Generate standard pseudo-id for stubs with high-resolution randomness to prevent collisions in multiple parallel/loop adds
      const mockPlayerId = `roster-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const avaRef = doc(db, 'campaigns', activeCampaign.id, 'availabilities', mockPlayerId);

      const selectionsObj: Record<string, AvailabilityStatus> = {};
      activeCampaign.daysTracked.forEach(d => {
        selectionsObj[d] = 'NO-VOTE';
      });

      const defaultAva: UserAvailability = {
        userId: mockPlayerId,
        playerName,
        notes: '',
        selections: selectionsObj,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(avaRef, defaultAva);
    } catch (err) {
      console.error('Failed to enroll roster player:', err);
      alert('Error building roster member.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Delete roster player (DM action)
  const handleRemoveRosterPlayer = async (userId: string) => {
    if (!activeCampaign) return;
    setIsDmSubmitting(true);
    try {
      const avaRef = doc(db, 'campaigns', activeCampaign.id, 'availabilities', userId);
      await deleteDoc(avaRef);
    } catch (err) {
      console.error('Failed to remove roster player:', err);
    } finally {
      setIsDmSubmitting(false);
    }
  };

  // Unified Player/Guest/DM updating selections & notes
  const handleUpdateAvailability = async (
    targetUserId: string,
    selections: { [day: string]: AvailabilityStatus },
    notes: string
  ) => {
    if (!activeCampaign) return;
    setIsSavingAvailability(true);
    try {
      const avaRef = doc(db, 'campaigns', activeCampaign.id, 'availabilities', targetUserId);
      const targetAva = availabilities.find(a => a.userId === targetUserId);

      const oldAva = targetAva;
      
      const activeWeekKey = activeCampaign.currentWeekRange;
      const weeklyData = { ...(targetAva?.weeklyData || {}) };
      weeklyData[activeWeekKey] = {
        selections,
        notes
      };

      const updatedAva: UserAvailability = {
        userId: targetUserId,
        playerName: targetAva?.playerName || 'Player',
        notes, // Maintain flat structure as fallback/backwards-compatible
        selections, // Maintain flat structure as fallback/backwards-compatible
        weeklyData,
        updatedAt: new Date().toISOString(),
      };

      let changedDay = '';
      let newSelValue: AvailabilityStatus | undefined = undefined;
      const oldSelections = oldAva?.weeklyData?.[activeWeekKey]?.selections || {};

      activeCampaign.daysTracked.forEach(d => {
        const oldVal = oldSelections[d] || 'NO-VOTE';
        const newVal = selections[d] || 'NO-VOTE';
        if (oldVal !== newVal) {
          changedDay = d;
          newSelValue = newVal;
        }
      });

      let toastMsg = 'Sync Saved to Firestore!';
      if (changedDay && newSelValue) {
        const statusLabels: Record<AvailabilityStatus, string> = {
          'PLAY': 'PLAY ✅',
          'SKIP': 'SKIP ❌',
          'MAYBE': 'MAYBE ❓',
          'LATE 1 HR': 'LATE 1H ⏳',
          'LATE 30 MIN': 'LATE 30M ⏳',
          'LATE 1.5 HR': 'LATE 1.5H ⏳',
          'LATE 2 HR': 'LATE 2H ⏳',
          'NO-VOTE': 'NO VOTE ⚪'
        };

        const getFormattedLabel = (status: AvailabilityStatus) => {
          const sTime = activeCampaign.gameWeekTimeOverrides?.[activeWeekKey] || activeCampaign.sessionTime || '19:30';
          if (status === 'LATE 1 HR') {
            if (sTime.includes(':')) {
              const [hoursStr, minutesStr] = sTime.split(':');
              const hours = parseInt(hoursStr, 10);
              const minutes = parseInt(minutesStr, 10);
              if (!isNaN(hours) && !isNaN(minutes)) {
                const totalMinutes = hours * 60 + minutes + 60;
                const newHours = Math.floor(totalMinutes / 60) % 24;
                const newMinutes = totalMinutes % 60;
                return `~${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')} ⏳`;
              }
            }
            return 'LATE 1H ⏳';
          }
          if (status === 'LATE 30 MIN') {
            if (sTime.includes(':')) {
              const [hoursStr, minutesStr] = sTime.split(':');
              const hours = parseInt(hoursStr, 10);
              const minutes = parseInt(minutesStr, 10);
              if (!isNaN(hours) && !isNaN(minutes)) {
                const totalMinutes = hours * 60 + minutes + 30;
                const newHours = Math.floor(totalMinutes / 60) % 24;
                const newMinutes = totalMinutes % 60;
                return `~${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')} ⏳`;
              }
            }
            return 'LATE 30M ⏳';
          }
          if (status === 'LATE 1.5 HR') {
            if (sTime.includes(':')) {
              const [hoursStr, minutesStr] = sTime.split(':');
              const hours = parseInt(hoursStr, 10);
              const minutes = parseInt(minutesStr, 10);
              if (!isNaN(hours) && !isNaN(minutes)) {
                const totalMinutes = hours * 60 + minutes + 90;
                const newHours = Math.floor(totalMinutes / 60) % 24;
                const newMinutes = totalMinutes % 60;
                return `~${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')} ⏳`;
              }
            }
            return 'LATE 1.5H ⏳';
          }
          if (status === 'LATE 2 HR') {
            if (sTime.includes(':')) {
              const [hoursStr, minutesStr] = sTime.split(':');
              const hours = parseInt(hoursStr, 10);
              const minutes = parseInt(minutesStr, 10);
              if (!isNaN(hours) && !isNaN(minutes)) {
                const totalMinutes = hours * 60 + minutes + 120;
                const newHours = Math.floor(totalMinutes / 60) % 24;
                const newMinutes = totalMinutes % 60;
                return `~${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')} ⏳`;
              }
            }
            return 'LATE 2H ⏳';
          }
          return statusLabels[status] || status;
        };

        toastMsg = `Saved count for ${changedDay}!`;
      } else if (oldAva && oldAva.notes !== notes) {
        toastMsg = 'Notes saved!';
      } else {
        toastMsg = 'Synced!';
      }

      await setDoc(avaRef, updatedAva);
      showToast(toastMsg, 'success');

      // Find selection difference for email log compilation
      if (accessToken && user && user.uid === targetUserId) {
        let diffText = '';
        const oldSelectionsForDiff = oldAva?.weeklyData?.[activeWeekKey]?.selections || {};
        const oldNotesForDiff = oldAva?.weeklyData?.[activeWeekKey]?.notes || '';
        activeCampaign.daysTracked.forEach(d => {
          const oldVal = oldSelectionsForDiff[d] || 'NO-VOTE';
          const newVal = selections[d] || 'NO-VOTE';
          if (oldVal !== newVal) {
            diffText += `• ${d}: ${oldVal} → ${newVal}\n`;
          }
        });
        if (oldNotesForDiff !== notes) {
          diffText += `• Notes updated: "${oldNotesForDiff}" → "${notes}"`;
        }

        if (diffText) {
          try {
            await notifyDmOfAvailabilityChange(
              accessToken,
              activeCampaign.dmEmail,
              activeCampaign.dmName,
              activeCampaign.name,
              updatedAva.playerName,
              diffText,
              activeCampaign.currentWeekRange
            );
          } catch (mailErr) {
            console.warn('Gmail change alert failed:', mailErr);
          }
        }
      }

    } catch (err) {
      console.error('Failed to update availability selections:', err);
      showToast("Couldn't save changes.", 'error');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  // Sync to Player's primary calendar (Player action)
  const handleSyncCalendarPlayer = async () => {
    if (!accessToken || !activeCampaign || !activeSession || !isScheduled) return;
    setIsSyncingPlayerCalendar(true);
    try {
      await createGoogleCalendarEvent(
        accessToken,
        activeCampaign.name,
        `Play: Session #${activeCampaign.sessionCounter}`,
        activeSession.scheduledDateTime
      );
      alert('Event successfully synchronized with your Google Calendar! 📅');
    } catch (err) {
      console.error(err);
      alert('Failed to insert event into your calendar.');
    } finally {
      setIsSyncingPlayerCalendar(false);
    }
  };

  // Send a pre-game digest notification summary to DM (DM action or player trigger)
  const handleSendPreGameSummary = async () => {
    if (!accessToken || !activeCampaign || !activeSession) return;
    setIsSendingPreGameSummary(true);
    try {
      // Build text string of player choices
      let reportStr = '';
      availabilities.forEach(ava => {
        reportStr += `• ${ava.playerName}:\n`;
        const weekRecord = ava.weeklyData?.[activeCampaign.currentWeekRange];
        const resolvedSelections = weekRecord ? weekRecord.selections : {};
        const resolvedNotes = weekRecord ? weekRecord.notes : '';
        activeCampaign.daysTracked.forEach(d => {
          reportStr += `  - ${d}: ${resolvedSelections[d] || 'NO-VOTE'}\n`;
        });
        if (resolvedNotes) reportStr += `  - Notes: "${resolvedNotes}"\n`;
      });

      await sendDmPreGameSummary(
        accessToken,
        activeCampaign.dmEmail,
        activeCampaign.dmName,
        activeCampaign.name,
        activeSession,
        reportStr
      );

      // Confirm success
      alert(`Briefing email successfully sent to ${activeCampaign.dmName} (${activeCampaign.dmEmail}) via Gmail!`);
    } catch (err) {
      console.error(err);
      alert('Failed to dispatch preflight summary briefing.');
    } finally {
      setIsSendingPreGameSummary(false);
    }
  };

  // Add Campaign form creation handle
  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim()) return;
    setIsDmSubmitting(true);
    try {
      const campId = newCampName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const campRef = doc(db, 'campaigns', campId);

      const daysArr = newCampTrackDays === 'weekend' ? ['Събота', 'Неделя'] : ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'];

      const dmUserId = user ? user.uid : 'seed-dm';
      const dmEmail = user ? (user.email || '') : '';
      const dmName = user ? ((userProfile?.displayName || user.displayName || 'DM') + ' (DM)') : 'Anon DM (DM)';

      const newCamp: Campaign = {
        id: campId,
        name: newCampName.trim(),
        sessionCounter: 0,
        currentWeekRange: newCampWeek,
        dmUserId,
        dmEmail,
        dmName,
        playerUids: [],
        daysTracked: daysArr,
      };

      await setDoc(campRef, newCamp);

      // Add default players to availability subcollection
      const parsedRoster = newCampRoster.split(',').map(s => s.trim()).filter(Boolean);
      for (let i = 0; i < parsedRoster.length; i++) {
        const pName = parsedRoster[i];
        const pUid = `custom-${campId}-player-${i}`;
        const avaRef = doc(db, 'campaigns', campId, 'availabilities', pUid);

        const selectionsObj: Record<string, AvailabilityStatus> = {};
        daysArr.forEach(d => {
          selectionsObj[d] = 'NO-VOTE';
        });

        const newAva: UserAvailability = {
          userId: pUid,
          playerName: pName,
          notes: '',
          selections: selectionsObj,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(avaRef, newAva);
      }

      setSelectedCampaignId(campId);
      setShowCreateCampaignModal(false);
      setNewCampName('');
      setNewCampRoster('Alex, Victoria, Stefan');
      showToast(`"${newCampName}" is alive!`, 'success');
    } catch (err) {
      console.error('Failed to add campaign:', err);
      alert('Unable to spawn campaign.');
    } finally {
      setIsDmSubmitting(false);
    }
  };

  const isScheduled = activeSession?.status === 'scheduled';
  // Allow unlogged users (or creator DM) to manage sessions by default, which is super helpful!
  const showDmControls = activeCampaign && (
    !user || 
    activeCampaign.dmUserId === user.uid || 
    userProfile?.isDm === true ||
    userProfile?.managedCampaignIds?.includes(activeCampaign.id) ||
    activeCampaign.coDms?.includes(user.uid) ||
    (user.email && activeCampaign.dmEmail?.toLowerCase() === user.email.toLowerCase()) ||
    activeCampaign.dmUserId === 'seed-dm' ||
    activeCampaign.dmUserId === 'seed-dm-apostol'
  );

  return (
    <div id="app-root-container" className="min-h-screen pb-12 bg-neutral-50 text-neutral-850 flex flex-col font-sans">
      <Header
        userProfile={userProfile}
        activeCampaign={activeCampaign}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettingsModal(true)}
        isLoggingIn={isLoggingIn}
        onClaimDM={handleClaimDM}
        isClaiming={isDmSubmitting}
        onOpenUserManagement={() => setShowUserManagementModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 h-full">
        {/* Banner callout if unauthenticated */}
        {!user && (
          <div id="welcome-callout" className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-6 shadow-sm flex flex-col md:flex-row items-center gap-5 justify-between">
            <div className="flex items-start gap-3.5">
              <div className="bg-emerald-100 p-2.5 rounded border border-emerald-250 shrink-0">
                <Swords className="text-emerald-700 rotate-12" size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-850 tracking-tight uppercase">
                  Gather Your D&D Party
                </h2>
                <p className="text-xs text-neutral-600 mt-1 max-w-xl leading-relaxed">
                  Avoid scheduling chaos! Choose a game tab, or Sign in with Google to claim your roster player slot. Anyone (guests/unlogged) can edit selections in the roster table immediately!
                </p>
              </div>
            </div>
            <button
              onClick={handleLogin}
              className="text-white bg-emerald-600 hover:bg-emerald-750 font-bold px-5 py-2.5 rounded shadow-sm hover:shadow transition-all text-xs uppercase cursor-pointer"
            >
              🚀 Join Roster & Schedule
            </button>
          </div>
        )}

        {/* Campaign cards grid selector */}
        <CampaignSelector
          campaigns={campaigns}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
          currentUserId={user?.uid || null}
          onOpenCreateModal={() => {
            setShowCreateCampaignModal(true);
          }}
        />

        {activeCampaign ? (
          <div id="main-active-campaign-layout" className="flex flex-col mt-0">
            
            {/* Matrix Scheduler View (Always FULL WIDTH at the top, touching active tabs) */}
            <AvailabilityTable
              campaign={activeCampaign}
              availabilities={availabilities}
              currentUserId={user?.uid || null}
              currentUserDisplayName={userProfile?.displayName || null}
              onUpdateAvailability={handleUpdateAvailability}
              isSaving={isSavingAvailability}
              isDM={showDmControls}
              onAddRosterPlayer={handleAddRosterPlayer}
              onRemoveRosterPlayer={handleRemoveRosterPlayer}
              onUpdateCampaignSettings={handleUpdateCampaignSettings}
              onToggleDayActive={handleToggleDayActive}
              onToggleGameDay={handleToggleGameDay}
            />
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-500 flex flex-col items-center justify-center">
            {isSeeding ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={20} className="animate-spin text-emerald-600" />
                <p className="text-xs font-mono text-neutral-500">Loading original campaign rosters...</p>
              </div>
            ) : (
              <p className="text-xs">Select or add a campaign to initialize scheduler.</p>
            )}
          </div>
        )}

        {/* Floating Custom Toast List */}
        <div id="toast-manager" className="fixed bottom-6 right-6 space-y-2 z-50 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`transform transition-all duration-300 ease-out translate-y-0 opacity-100 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-semibold select-none pointer-events-auto shrink-0 bg-white min-w-[205px] border-neutral-200 ${
                toast.type === 'success'
                  ? 'text-emerald-800 border-l-4 border-l-emerald-500 animate-slide-in'
                  : toast.type === 'error'
                  ? 'text-rose-800 border-l-4 border-l-rose-500 animate-slide-in'
                  : 'text-neutral-800 border-l-4 border-l-neutral-400 animate-slide-in'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${toast.type === 'success' ? 'bg-emerald-500 animate-pulse' : toast.type === 'error' ? 'bg-rose-500' : 'bg-neutral-400'}`} />
              <p className="flex-1 font-sans">{toast.message}</p>
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 py-5 border-t border-neutral-200 text-center text-[11px] text-neutral-400 font-mono">
        Adventure Scheduler © {new Date().getFullYear()} — Made with 💖 for GMs & Heroes everywhere.
      </footer>

      {/* Settings Dialog Modals */}
      {showSettingsModal && (
        <EditProfileModal
          profile={userProfile}
          onSave={handleSaveProfileSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Spawners Dialog */}
      {showCreateCampaignModal && (
        <div id="camp-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-neutral-200 w-full max-w-lg rounded-lg p-5 shadow-lg relative">
            <h3 className="text-sm font-bold text-neutral-800 uppercase mb-4">
              ⚔️ Spawn New D&D Campaign Tracker
            </h3>

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  placeholder="e.g. Curse of Strahd"
                  className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1 col-span-1">Week</label>
                  <input
                    type="text"
                    value={newCampWeek}
                    onChange={(e) => setNewCampWeek(e.target.value)}
                    placeholder="e.g. 15-21 June"
                    className="font-mono w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1 col-span-1">Tracked Days</label>
                  <select
                    value={newCampTrackDays}
                    onChange={(e) => setNewCampTrackDays(e.target.value)}
                    className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none"
                  >
                    <option value="7">Full Week (7 Days)</option>
                    <option value="weekend">Weekends only (Sat/Sun)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-550 uppercase font-bold mb-1">Initial Roster Players (comma separated list)</label>
                <input
                  type="text"
                  value={newCampRoster}
                  onChange={(e) => setNewCampRoster(e.target.value)}
                  placeholder="e.g. Alex, Vicky, George, Nick"
                  className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded p-2 text-neutral-800 text-xs focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                  Providing these stubs immediately hydrates your roster grid, similar to the default campaign views. Players can later join or claim slots.
                </p>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCampaignModal(false)}
                  className="flex-1 rounded py-2 text-xs font-bold border border-neutral-200 text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDmSubmitting || !newCampName.trim()}
                  className="flex-1 rounded py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  {isDmSubmitting ? 'Spawning...' : 'Spawn Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Management Dialog Modal */}
      {showUserManagementModal && (
        <UserManagementModal
          currentUserProfile={userProfile}
          registeredUsers={registeredUsers}
          campaigns={campaigns}
          onSaveUserPermissions={handleSaveUserPermissions}
          onClose={() => setShowUserManagementModal(false)}
        />
      )}
    </div>
  );
}
