const cron = require('node-cron');
const prisma = require('../db/prisma');
const notificationService = require('../services/notification-service');

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running email retry worker...');
  
  try {
    // Find emails that are FAILED or PENDING but not updated recently
    // Maximum 3 retries
    const emailsToRetry = await prisma.emailLog.findMany({
      where: {
        OR: [
          { status: 'FAILED' },
          { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }
        ],
        retryCount: { lt: 3 }
      },
      take: 20 // process in batches
    });

    for (const email of emailsToRetry) {
      console.log(`Retrying email log: ${email.id}`);
      await notificationService.processEmailLog(email.id).catch(err => {
        console.error(`Error processing retry for ${email.id}:`, err.message);
      });
    }
  } catch (err) {
    console.error('Email retry worker encountered an error:', err.message);
  }
});
