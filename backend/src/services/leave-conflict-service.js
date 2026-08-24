const prisma = require('../db/prisma');
const notificationService = require('./notification-service');
const calendarService = require('./calendar-service');

async function getAffectedAppointments(doctorId, leaveDateStr) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true }
  });

  if (!doctor || !doctor.doctorProfile) {
    throw new Error('DoctorProfile not found for this user');
  }

  const leaveDate = new Date(leaveDateStr);
  const startOfDay = new Date(Date.UTC(leaveDate.getUTCFullYear(), leaveDate.getUTCMonth(), leaveDate.getUTCDate()));
  
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const now = new Date();

  // Appointments are affected if they are CONFIRMED, fall on the leave day, and are in the future
  return await prisma.appointment.findMany({
    where: {
      doctorId,
      status: 'SCHEDULED',
      slotStart: {
        gte: startOfDay > now ? startOfDay : now, // Only future appointments
        lt: endOfDay
      }
    },
    include: {
      patient: { select: { id: true, email: true, name: true } },
      doctor: { select: { id: true, email: true, name: true } }
    }
  });
}

async function markLeaveAndCascade(doctorId, leaveData) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true }
  });

  if (!doctor || !doctor.doctorProfile) {
    throw new Error('DoctorProfile not found for this user');
  }

  const profile = doctor.doctorProfile;
  const leaveDate = new Date(leaveData.leaveDate);
  const startOfDay = new Date(Date.UTC(leaveDate.getUTCFullYear(), leaveDate.getUTCMonth(), leaveDate.getUTCDate()));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (startOfDay < today) {
    throw new Error('Cannot mark leave in the past');
  }

  const existingLeave = await prisma.doctorLeave.findUnique({
    where: {
      doctorProfileId_leaveDate: {
        doctorProfileId: profile.id,
        leaveDate: startOfDay
      }
    }
  });

  if (existingLeave) {
    throw new Error('Leave already exists for this date');
  }

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  // Perform database operations inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the leave
    const newLeave = await tx.doctorLeave.create({
      data: {
        doctorProfileId: profile.id,
        leaveDate: startOfDay,
        reason: leaveData.reason
      }
    });

    // 2. Identify affected appointments
    const affectedAppointments = await tx.appointment.findMany({
      where: {
        doctorId,
        status: 'SCHEDULED',
        slotStart: {
          gte: startOfDay > now ? startOfDay : now,
          lt: endOfDay
        }
      },
      include: {
        patient: { select: { id: true, email: true } },
        doctor: { select: { id: true, email: true } }
      }
    });

    if (affectedAppointments.length > 0) {
      // 3. Mark them as cancelled
      await tx.appointment.updateMany({
        where: {
          id: { in: affectedAppointments.map(a => a.id) }
        },
        data: {
          status: 'CANCELLED'
        }
      });
    }

    return { newLeave, affectedAppointments };
  });

  // 4. Trigger integrations safely outside the transaction
  for (const appt of result.affectedAppointments) {
    try {
      notificationService.enqueueEmail(appt.id, appt.patient.email, 'CANCELLATION');
      notificationService.enqueueEmail(appt.id, appt.doctor.email, 'CANCELLATION');
      calendarService.enqueueCalendarSync(appt.id, appt.patientId, appt.doctorId);
    } catch (err) {
      console.error(`Failed to enqueue cancellation for appointment ${appt.id}:`, err);
    }
  }

  return result.newLeave;
}

module.exports = {
  getAffectedAppointments,
  markLeaveAndCascade
};
