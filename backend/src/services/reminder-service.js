const prisma = require('../db/prisma');

// Mapping frequency string to times per day
function parseFrequency(freqStr) {
  if (!freqStr || typeof freqStr !== 'string') return 1;
  const str = freqStr.toLowerCase();
  if (/four|4|qid/.test(str)) return 4;
  if (/three|3|tid/.test(str)) return 3;
  if (/twice|2|bid/.test(str)) return 2;
  return 1;
}

// Extract duration days
function parseDuration(durStr) {
  if (!durStr || typeof durStr !== 'string') return 1;
  const match = durStr.match(/(\d+)/);
  if (match) {
    const days = parseInt(match[1], 10);
    return days > 0 ? days : 1;
  }
  return 1; // Default to 1 day if not specified or unparseable
}

function getDailyHours(timesPerDay) {
  if (timesPerDay === 4) return [8, 12, 16, 20];
  if (timesPerDay === 3) return [8, 14, 20];
  if (timesPerDay === 2) return [9, 21];
  return [9]; // Default 1 time a day
}

/**
 * Generate medication reminders and save them to the database.
 * Time generation correctly maps local Asia/Kolkata hours to UTC Date objects.
 */
async function generateReminders(visitNoteId, patientId, prescriptionJson) {
  if (!prescriptionJson) return;

  // Normalize to array
  let prescriptions = [];
  if (Array.isArray(prescriptionJson)) {
    prescriptions = prescriptionJson;
  } else if (typeof prescriptionJson === 'object') {
    // Check if it's actually an empty object {}
    if (!prescriptionJson.medication && !prescriptionJson.dosage) return;
    prescriptions = [prescriptionJson];
  } else {
    return;
  }

  const remindersToCreate = [];

  for (const pres of prescriptions) {
    if (!pres.medication) continue;
    
    const freq = parseFrequency(pres.frequency);
    const dur = parseDuration(pres.duration);
    const hours = getDailyHours(freq);
    
    for (let dayOffset = 1; dayOffset <= dur; dayOffset++) {
      for (const hour of hours) {
        // Calculate the specific day/time in Asia/Kolkata
        // Using native JS Date:
        const now = new Date();
        // Shift to IST by adding 5.5 hours to UTC
        const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        
        // Add days (starting from tomorrow)
        istNow.setUTCDate(istNow.getUTCDate() + dayOffset);
        // Set exact hour in IST
        istNow.setUTCHours(hour, 0, 0, 0);
        
        // Convert IST exact instant back to UTC
        const utcScheduledTime = new Date(istNow.getTime() - (5.5 * 60 * 60 * 1000));

        remindersToCreate.push({
          visitNoteId,
          patientId,
          medicationName: pres.medication,
          dosage: pres.dosage || null,
          scheduledTime: utcScheduledTime,
          status: 'PENDING'
        });
      }
    }
  }

  if (remindersToCreate.length > 0) {
    await prisma.medicationReminder.createMany({
      data: remindersToCreate
    });
    console.log(`Generated ${remindersToCreate.length} medication reminders for VisitNote ${visitNoteId}`);
  }
}

module.exports = {
  generateReminders,
  parseFrequency,
  parseDuration,
  getDailyHours
};
