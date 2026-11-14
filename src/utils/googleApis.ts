import { GameSession } from '../types';

/**
 * Encodes a string as base64url (required by Gmail send API)
 */
function base64urlEncode(str: string): string {
  // We use btoa for browser-compatible base64. Ensure we handle UTF-8 symbols gracefully by using string conversions.
  const encoded = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sends an email notification using the user's verified Gmail API token.
 */
export async function sendGmailMessage(
  accessToken: string,
  toEmail: string,
  subject: string,
  emailBody: string
): Promise<void> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error('Authorized user email check failed.');
    }
    const userInfo = await response.json();
    const fromEmail = userInfo.email || 'me';

    // Construct simple MIME text
    const mimeParts = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      emailBody, // Note: body can be HTML or plane text
    ];

    const rawMessage = base64urlEncode(mimeParts.join('\r\n'));

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!gmailResponse.ok) {
      const errText = await gmailResponse.text();
      console.error('Gmail API send Error response:', errText);
      throw new Error(`Gmail API returned error status: ${gmailResponse.status}`);
    }
  } catch (error) {
    console.error('sendGmailMessage failed:', error);
    throw error;
  }
}

/**
 * Sends a notification of a player's schedule adjustment to the campaign's DM
 */
export async function notifyDmOfAvailabilityChange(
  accessToken: string,
  dmEmail: string,
  dmName: string,
  campaignName: string,
  playerName: string,
  changeDetails: string,
  weekRange: string
): Promise<void> {
  const subject = `[D&D Scheduler] Availability Change for ${campaignName} - ${playerName}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e8ed; border-radius: 8px;">
      <h3 style="color: #2c3e50; margin-top: 0;">Hail Dungeon Master ${dmName},</h3>
      <p style="font-size: 15px; color: #34495e;">
        A player of your legendary campaign <strong>${campaignName}</strong> has adjusted their availability for the week <strong>${weekRange}</strong>.
      </p>
      <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #2c3e50;">
          <strong>Player:</strong> ${playerName}<br/>
          <strong>Changes made:</strong><br/>
          ${changeDetails.replace(/\n/g, '<br/>')}
        </p>
      </div>
      <p style="font-size: 13px; color: #7f8c8d; margin-bottom: 0;">
        You can coordinate and finalize gaming times directly via the Campaign Scheduler web application.
      </p>
    </div>
  `;
  await sendGmailMessage(accessToken, dmEmail, subject, htmlBody);
}

/**
 * Sends a final schedule summary notification to the DM 1 day before the game
 */
export async function sendDmPreGameSummary(
  accessToken: string,
  dmEmail: string,
  dmName: string,
  campaignName: string,
  session: GameSession,
  playerAvasText: string
): Promise<void> {
  const formattedDate = new Date(session.scheduledDateTime).toLocaleString('bg-BG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC', // Ensure consistent display
  });

  const subject = `[D&D Scheduler] GAME TOMORROW! ${campaignName} Session Summary`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e8ed; border-radius: 8px;">
      <h3 style="color: #c0392b; margin-top: 0;">🎲 Dice Are Ready! Game Tomorrow!</h3>
      <p style="font-size: 15px; color: #34495e;">
        Your campaign <strong>${campaignName}</strong> is scheduled to commence tomorrow! Here is the briefing for the upcoming session:
      </p>
      <div style="background-color: #fff9db; border-left: 4px solid #f1c40f; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #2c3e50;">
          <strong>Scheduled Time:</strong> ${formattedDate}<br/>
          <strong>Campaign:</strong> ${campaignName}<br/>
        </p>
      </div>
      <h4 style="color: #2c3e50; margin-bottom: 8px;">Player Roster Status Summary:</h4>
      <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.6; color: #334155;">
        ${playerAvasText.replace(/\n/g, '<br/>')}
      </div>
      <p style="font-size: 13px; color: #7f8c8d; margin-top: 20px; margin-bottom: 0;">
        Prepare your notes and gather the party! Safe travels through the realm!
      </p>
    </div>
  `;
  await sendGmailMessage(accessToken, dmEmail, subject, htmlBody);
}

/**
 * Creates a Google Calendar Event and returns the Event object containing its ID.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  campaignName: string,
  sessionLabel: string,
  scheduledTimeIso: string,
  durationMinutes: number = 240,
  attendeeEmails: string[] = []
): Promise<{ id: string; htmlLink: string }> {
  try {
    const startTime = new Date(scheduledTimeIso);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const event: any = {
      summary: `🎲 D&D: ${campaignName} - ${sessionLabel}`,
      description: `Proposed gaming session coordinated via the Campaign Session Scheduler web application. Prepare your character sheets!`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/Sofia'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/Sofia'
      },
      reminders: {
        useDefault: true
      }
    };

    if (attendeeEmails && attendeeEmails.length > 0) {
      event.attendees = attendeeEmails.map(email => ({ email }));
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Calendar Create Event Error Response:', errText);
      throw new Error(`Calendar API returned error status: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (error) {
    console.error('createGoogleCalendarEvent failed:', error);
    throw error;
  }
}

/**
 * Deletes a Google Calendar Event.
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      // Allow 404 in case event was already deleted manually
      const errText = await response.text();
      console.error('Calendar Delete Event Error Response:', errText);
      throw new Error(`Calendar API returned error status: ${response.status}`);
    }
  } catch (error) {
    console.error('deleteGoogleCalendarEvent failed:', error);
    throw error;
  }
}
