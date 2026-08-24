const { google } = require('googleapis');
const prisma = require('../db/prisma');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Sync an appointment to a user's calendar.
 * Completely independent per user. If the user has no token, it skips gracefully.
 */
async function syncCalendarEvent(appointmentId, userId) {
  try {
    const tokenRecord = await prisma.oAuthToken.findUnique({ where: { userId } });
    if (!tokenRecord) {
      // User hasn't connected calendar - skip gracefully
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
        patient: true
      }
    });

    if (!appointment) return;

    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Find or create our local tracker
    let calendarEvent = await prisma.calendarEvent.findFirst({
      where: { appointmentId, userId }
    });

    if (!calendarEvent) {
      calendarEvent = await prisma.calendarEvent.create({
        data: {
          appointmentId,
          userId,
          status: 'PENDING'
        }
      });
    }

    const event = {
      summary: `Appointment: ${appointment.patient.name} & Dr. ${appointment.doctor.name}`,
      description: `Healthcare Appointment System`,
      start: {
        dateTime: new Date(appointment.slotStart).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: new Date(appointment.slotEnd).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    };

    if (appointment.status === 'CANCELLED') {
      if (calendarEvent.googleEventId) {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: calendarEvent.googleEventId,
        });
        await prisma.calendarEvent.update({
          where: { id: calendarEvent.id },
          data: { status: 'CANCELLED' }
        });
      }
      return;
    }

    // Insert or Update
    if (calendarEvent.googleEventId) {
      // Update existing
      await calendar.events.update({
        calendarId: 'primary',
        eventId: calendarEvent.googleEventId,
        resource: event,
      });
      await prisma.calendarEvent.update({
        where: { id: calendarEvent.id },
        data: { status: 'SUCCESS' }
      });
    } else {
      // Insert new
      const res = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      await prisma.calendarEvent.update({
        where: { id: calendarEvent.id },
        data: { 
          googleEventId: res.data.id,
          status: 'SUCCESS' 
        }
      });
    }

  } catch (err) {
    console.error(`Calendar sync failed for user ${userId}, appointment ${appointmentId}:`, err.message);
    // Best effort: mark failed if tracker exists
    try {
      const existing = await prisma.calendarEvent.findFirst({
        where: { appointmentId, userId }
      });
      if (existing) {
        await prisma.calendarEvent.update({
          where: { id: existing.id },
          data: { status: 'FAILED' }
        });
      }
    } catch(e) {}
  }
}

/**
 * Enqueue calendar syncs for both patient and doctor asynchronously.
 * They run independently and never block each other.
 */
function enqueueCalendarSync(appointmentId, patientId, doctorId) {
  // Fire and forget
  syncCalendarEvent(appointmentId, patientId).catch(e => console.error(e));
  syncCalendarEvent(appointmentId, doctorId).catch(e => console.error(e));
}

module.exports = {
  enqueueCalendarSync
};
