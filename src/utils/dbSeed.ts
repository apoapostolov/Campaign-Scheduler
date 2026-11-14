import { collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Campaign, UserAvailability } from '../types';

export async function seedCampaignsIfEmpty(currentUserEmail?: string, currentUserId?: string) {
  const campaignsRef = collection(db, 'campaigns');
  let campaignsSnapshot;
  try {
    campaignsSnapshot = await getDocs(campaignsRef);
  } catch (error) {
    // If permission issue or other, gracefully exit
    console.warn('Could not read campaigns for seeding in block:', error);
    return;
  }

  if (!campaignsSnapshot.empty) {
    return; // Already populated
  }

  console.log('Database empty. Seeding initial campaign and availability tables from spreadsheet schema...');

  const initialCampaigns: Campaign[] = [
    {
      id: 'vaults',
      name: 'Vaults',
      sessionCounter: 120,
      currentWeekRange: '8-14 June',
      dmUserId: currentUserEmail === 'theapoapostolov@gmail.com' && currentUserId ? currentUserId : 'seed-dm-apostol',
      dmEmail: 'theapoapostolov@gmail.com',
      dmName: 'Апостол (GM)',
      playerUids: [],
      initialRosterNames: ['Алекс', 'Виктория', 'Светлана', 'Стефан'],
      daysTracked: ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя']
    },
    {
      id: 'thekeep',
      name: 'The Keep',
      sessionCounter: 7,
      currentWeekRange: '1-7 June',
      dmUserId: currentUserEmail === 'theapoapostolov@gmail.com' && currentUserId ? currentUserId : 'seed-dm-apostol',
      dmEmail: 'theapoapostolov@gmail.com',
      dmName: 'Апостол (GM)',
      playerUids: [],
      initialRosterNames: ['Алекс', 'Асен', 'Божидар', 'Иво', 'Стоян'],
      daysTracked: ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя']
    },
    {
      id: 'edgewach',
      name: 'Edgewach',
      sessionCounter: 0,
      currentWeekRange: '06-07 June',
      dmUserId: 'seed-dm-yanko',
      dmEmail: 'dm.yanko@example.com',
      dmName: 'Янко (DM)',
      playerUids: [],
      initialRosterNames: ['Вики', 'Светлана', 'Иво', 'Стоян', 'Асен', 'Борис', 'Сава', 'Божо', 'Мариела'],
      daysTracked: ['Събота', 'Неделя']
    },
    {
      id: 'vampire5e',
      name: 'Vampire 5E',
      sessionCounter: 3,
      currentWeekRange: '1-7 June',
      dmUserId: 'seed-dm-stoyan',
      dmEmail: 'stoyan.gm@example.com',
      dmName: 'Stoyan (GM)',
      playerUids: [],
      initialRosterNames: ['Анди', 'Апостол', 'Асен', 'Асен Дъртия', 'Вики', 'Дея', 'Иво'],
      daysTracked: ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя']
    }
  ];

  // Seed campaigns
  for (const campaign of initialCampaigns) {
    try {
      await setDoc(doc(db, 'campaigns', campaign.id), campaign);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaign.id}`);
    }
  }

  // Seed default availabilities for The Keep
  const keepAvailabilities: { name: string; notes: string; selections: Record<string, string> }[] = [
    {
      name: 'Апостол (GM)',
      notes: '',
      selections: {
        'Понеделник': 'SKIP',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'PLAY',
        'Петък': 'PLAY',
        'Събота': 'PLAY',
        'Неделя': 'PLAY'
      }
    },
    {
      name: 'Алекс',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'LATE 1 HR',
        'Петък': 'SKIP',
        'Събота': 'LATE 1 HR',
        'Неделя': 'LATE 1 HR'
      }
    },
    {
      name: 'Асен',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'SKIP',
        'Петък': 'SKIP',
        'Събота': 'LATE 30 MIN',
        'Неделя': 'SKIP'
      }
    },
    {
      name: 'Божидар',
      notes: 'неделя зависи от началния час',
      selections: {}
    },
    {
      name: 'Иво',
      notes: '',
      selections: {}
    },
    {
      name: 'Стоян',
      notes: '',
      selections: {
        'Четвъртък': 'PLAY',
        'Събота': 'PLAY'
      }
    }
  ];

  // Seed default availabilities for Vaults
  const vaultsAvailabilities: { name: string; notes: string; selections: Record<string, string> }[] = [
    {
      name: 'Апостол (GM)',
      notes: '',
      selections: {
        'Понеделник': 'SKIP',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'PLAY',
        'Петък': 'PLAY',
        'Събота': 'PLAY',
        'Неделя': 'PLAY'
      }
    },
    { name: 'Алекс', notes: '', selections: {} },
    { name: 'Виктория', notes: '', selections: {} },
    { name: 'Светлана', notes: '', selections: {} },
    { name: 'Стефан', notes: '', selections: {} }
  ];

  // Seed default availabilities for Edgewach
  const edgewachAvailabilities: { name: string; notes: string; selections: Record<string, string> }[] = [
    {
      name: 'Янко (DM)',
      notes: '',
      selections: {
        'Събота': 'SKIP',
        'Неделя': 'PLAY'
      }
    },
    {
      name: 'Вики',
      notes: '',
      selections: {
        'Неделя': 'PLAY'
      }
    },
    { name: 'Светлана', notes: '', selections: {} },
    {
      name: 'Иво',
      notes: '',
      selections: {
        'Събота': 'SKIP',
        'Неделя': 'PLAY'
      }
    },
    { name: 'Стоян', notes: '', selections: {} },
    { name: 'Асен', notes: '', selections: {} },
    { name: 'Борис', notes: '', selections: {} },
    { name: 'Сава', notes: '', selections: {} },
    { name: 'Божо', notes: '', selections: {} },
    { name: 'Мариела', notes: '', selections: {} }
  ];

  // Seed default availabilities for Vampire 5E
  const vampireAvailabilities: { name: string; notes: string; selections: Record<string, string> }[] = [
    {
      name: 'Stoyan (GM)',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'SKIP',
        'Сряда': 'SKIP',
        'Четвъртък': 'PLAY',
        'Петък': 'PLAY',
        'Събота': 'SKIP',
        'Неделя': 'SKIP'
      }
    },
    { name: 'Анди', notes: '', selections: {} },
    {
      name: 'Апостол',
      notes: '',
      selections: {
        'Понеделник': 'SKIP',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'PLAY',
        'Петък': 'PLAY',
        'Събота': 'PLAY',
        'Неделя': 'PLAY'
      }
    },
    {
      name: 'Асен',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'SKIP',
        'Сряда': 'PLAY',
        'Четвъртък': 'LATE 1 HR',
        'Петък': 'PLAY',
        'Събота': 'SKIP',
        'Неделя': 'SKIP'
      }
    },
    {
      name: 'Асен Дъртия',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'PLAY',
        'Сряда': 'SKIP',
        'Четвъртък': 'SKIP',
        'Петък': 'PLAY',
        'Събота': 'MAYBE',
        'Неделя': 'MAYBE'
      }
    },
    {
      name: 'Вики',
      notes: '',
      selections: {
        'Понеделник': 'LATE 1 HR',
        'Четвъртък': 'PLAY',
        'Петък': 'PLAY'
      }
    },
    { name: 'Дея', notes: '', selections: {} },
    {
      name: 'Иво',
      notes: '',
      selections: {
        'Понеделник': 'PLAY',
        'Вторник': 'PLAY',
        'Сряда': 'PLAY',
        'Четвъртък': 'MAYBE',
        'Петък': 'PLAY',
        'Събота': 'MAYBE',
        'Неделя': 'MAYBE'
      }
    }
  ];

  const seedBatch = async (campaignId: string, roster: { name: string; notes: string; selections: Record<string, string> }[]) => {
    // Generate simple documentIds based on roster name
    const batch = writeBatch(db);
    roster.forEach((p, idx) => {
      const pId = `seed-${campaignId}-player-${idx}`;
      const docRef = doc(db, 'campaigns', campaignId, 'availabilities', pId);
      const data: UserAvailability = {
        userId: pId,
        playerName: p.name,
        notes: p.notes,
        selections: {},
        updatedAt: new Date().toISOString()
      };
      // Fill all selections to NO-VOTE by default, unless matching sheet values
      const days = campaignId === 'edgewach' ? ['Събота', 'Неделя'] : ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'];
      days.forEach(d => {
        data.selections[d] = (p.selections[d] as any) || 'NO-VOTE';
      });
      batch.set(docRef, data);
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error(`Failed to seed roster for ${campaignId}:`, err);
    }
  };

  await seedBatch('vaults', vaultsAvailabilities);
  await seedBatch('thekeep', keepAvailabilities);
  await seedBatch('edgewach', edgewachAvailabilities);
  await seedBatch('vampire5e', vampireAvailabilities);

  console.log('Seeding completed successfully!');
}
