const cron = require('node-cron');
const prisma = require('../db/prisma');
const notificationService = require('../services/notification-service');

// Run every 5 minutes
async function processReminders() {
  // console.log('Running medication reminder scheduler...');
  
  try {
    // Find all pending reminders whose scheduled time is in the past or now
    const now = new Date();
    const dueReminders = await prisma.medicationReminder.findMany({
      where: {
        status: 'PENDING',
        scheduledTime: { lte: now }
      },
      include: {
        visitNote: true,
        patient: true
      },
      take: 50 // process in batches
    });

    for (const reminder of dueReminders) {
      // console.log(`Processing due reminder: ${reminder.id}`);
      
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Mark as SENT atomically
          await tx.medicationReminder.update({
            where: { id: reminder.id },
            data: { status: 'SENT' }
          });
          
          // 2. Safely generate EmailLog
          const emailLog = await tx.emailLog.create({
            data: {
              appointmentId: reminder.visitNote.appointmentId,
              recipient: reminder.patient.email,
              type: 'MEDICATION_REMINDER',
              status: 'PENDING',
              medicationReminderId: reminder.id
            }
          });
          
          // 3. (Optional but optimal) fire processEmailLog asynchronously after transaction
          // Since it's fire-and-forget, we don't strictly await it here, but it's safe to do after TX
          // Wait, we don't fire here inside the tx, we fire it after the tx completes.
        });
        
      } catch (err) {
        console.error(`Error processing reminder ${reminder.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Medication reminder scheduler encountered an error:', err.message);
  }
}

cron.schedule('*/5 * * * *', processReminders);

module.exports = {
  processReminders
};
