const prisma = require('../db/prisma');
const { generateSlots } = require('../utils/slot-generator');
const notificationService = require('./notification-service');
const calendarService = require('./calendar-service');
const crypto = require('crypto');

// Deterministic 64-bit advisory lock key derived from a UUID string
function getAdvisoryLockKeys(uuidStr) {
  const hash = crypto.createHash('sha256').update(uuidStr).digest();
  const int1 = hash.readInt32BE(0);
  const int2 = hash.readInt32BE(4);
  return { int1, int2 };
}

async function getDoctors(specialisation) {
  const where = { role: 'DOCTOR' };
  if (specialisation) {
    where.doctorProfile = {
      specialisation: { contains: specialisation, mode: 'insensitive' }
    };
  }
  return await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      doctorProfile: {
        select: {
          specialisation: true,
          slotDurationMinutes: true
        }
      }
    }
  });
}

async function getAvailableSlots(doctorId, dateString) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: {
      doctorProfile: {
        include: { leaves: true }
      }
    }
  });

  if (!doctor || doctor.role !== 'DOCTOR' || !doctor.doctorProfile) {
    throw new Error('Doctor not found or has no profile');
  }

  const allSlots = generateSlots(
    doctor.doctorProfile.workingHoursJson,
    doctor.doctorProfile.slotDurationMinutes,
    dateString,
    doctor.doctorProfile.leaves
  );

  if (allSlots.length === 0) {
    return [];
  }

  const targetDateStart = new Date(`${dateString}T00:00:00+05:30`);
  const targetDateEnd = new Date(`${dateString}T23:59:59.999+05:30`);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { not: 'CANCELLED' },
      slotStart: {
        gte: targetDateStart,
        lte: targetDateEnd
      }
    },
    select: { slotStart: true }
  });

  const bookedSlotTimes = appointments.map(app => {
    return new Date(app.slotStart).toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  const now = new Date();
  
  return allSlots.filter(slot => {
    if (bookedSlotTimes.includes(slot)) return false;
    const slotStart = new Date(`${dateString}T${slot}:00+05:30`);
    if (slotStart < now) return false;
    return true;
  });
}

async function validatePatientRules(tx, patientId, doctorProfile, slotStart, slotEnd, dateString, excludeAppointmentId = null) {
  const targetDateStart = new Date(`${dateString}T00:00:00+05:30`);
  const targetDateEnd = new Date(`${dateString}T23:59:59.999+05:30`);
  
  const patientAppointments = await tx.appointment.findMany({
    where: {
      patientId,
      status: 'SCHEDULED',
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      slotStart: {
        gte: targetDateStart,
        lte: targetDateEnd
      }
    },
    include: {
      doctor: { select: { doctorProfile: { select: { specialisation: true } } } }
    }
  });

  for (const app of patientAppointments) {
    if (app.doctor.doctorProfile.specialisation === doctorProfile.specialisation) {
      const err = new Error(`You already have a ${doctorProfile.specialisation} appointment on this date.`);
      err.statusCode = 409;
      throw err;
    }
    
    if (slotStart < app.slotEnd && app.slotStart < slotEnd) {
      const err = new Error('You already have another appointment during this time.');
      err.statusCode = 409;
      throw err;
    }
  }
}

async function bookAppointment(patientId, doctorId, dateString, slotTimeStr) {
  // REQUIREMENT 1: Google Calendar Connection check for PATIENT
  const patientUser = await prisma.user.findUnique({ where: { id: patientId } });
  if (patientUser && patientUser.role === 'PATIENT') {
    const token = await prisma.oAuthToken.findFirst({ where: { userId: patientId } });
    if (!token) {
      const err = new Error('Please connect your Google Calendar before making an appointment. This allows you to receive reminders about your appointment.');
      err.statusCode = 403;
      throw err;
    }
  }

  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: {
      doctorProfile: { include: { leaves: true } }
    }
  });

  if (!doctor || doctor.role !== 'DOCTOR' || !doctor.doctorProfile) {
    throw new Error('Doctor not found or has no profile');
  }

  const allSlots = generateSlots(
    doctor.doctorProfile.workingHoursJson,
    doctor.doctorProfile.slotDurationMinutes,
    dateString,
    doctor.doctorProfile.leaves
  );

  if (!allSlots.includes(slotTimeStr)) {
    const err = new Error('This doctor is on leave on the selected date or slot is invalid');
    err.statusCode = 400;
    throw err;
  }

  const slotStart = new Date(`${dateString}T${slotTimeStr}:00+05:30`);
  if (slotStart < new Date()) {
    const err = new Error('Cannot book an appointment in the past');
    err.statusCode = 400;
    throw err;
  }

  const slotEnd = new Date(slotStart.getTime() + doctor.doctorProfile.slotDurationMinutes * 60000);
  const { int1, int2 } = getAdvisoryLockKeys(patientId);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${int1}, ${int2})`;

    await validatePatientRules(tx, patientId, doctor.doctorProfile, slotStart, slotEnd, dateString);

    try {
      const appointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId,
          slotStart,
          slotEnd
        },
        include: {
          doctor: { select: { name: true, email: true, doctorProfile: { select: { specialisation: true } } } },
          patient: { select: { name: true, email: true } }
        }
      });
      return appointment;
    } catch (err) {
      if (err.code === 'P2002') {
        const customErr = new Error("This doctor's selected slot is no longer available.");
        customErr.statusCode = 409;
        throw customErr;
      }
      throw err;
    }
  });

  // Phase 6 async non-blocking integrations
  if (result) {
    notificationService.enqueueEmail(result.id, result.patient.email, 'CONFIRMATION');
    notificationService.enqueueEmail(result.id, result.doctor.email, 'CONFIRMATION');
    calendarService.enqueueCalendarSync(result.id, result.patientId, result.doctorId);
  }
  return result;
}

async function rescheduleAppointment(doctorId, appointmentId, dateString, slotTimeStr) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true }
  });

  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  if (appointment.doctorId !== doctorId) {
    const err = new Error('You cannot reschedule another doctor\'s appointment');
    err.statusCode = 403;
    throw err;
  }

  if (appointment.status !== 'SCHEDULED') {
    const err = new Error('You can only reschedule SCHEDULED appointments');
    err.statusCode = 400;
    throw err;
  }

  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: {
      doctorProfile: { include: { leaves: true } }
    }
  });

  const allSlots = generateSlots(
    doctor.doctorProfile.workingHoursJson,
    doctor.doctorProfile.slotDurationMinutes,
    dateString,
    doctor.doctorProfile.leaves
  );

  if (!allSlots.includes(slotTimeStr)) {
    const err = new Error('This doctor is on leave on the selected date or slot is invalid');
    err.statusCode = 400;
    throw err;
  }

  const slotStart = new Date(`${dateString}T${slotTimeStr}:00+05:30`);
  if (slotStart < new Date()) {
    const err = new Error('Cannot book an appointment in the past');
    err.statusCode = 400;
    throw err;
  }

  const slotEnd = new Date(slotStart.getTime() + doctor.doctorProfile.slotDurationMinutes * 60000);
  const { int1, int2 } = getAdvisoryLockKeys(appointment.patientId);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${int1}, ${int2})`;

    await validatePatientRules(tx, appointment.patientId, doctor.doctorProfile, slotStart, slotEnd, dateString, appointmentId);

    try {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          slotStart,
          slotEnd,
          rescheduledByDoctor: true
        },
        include: {
          doctor: { select: { name: true, email: true, doctorProfile: { select: { specialisation: true } } } },
          patient: { select: { name: true, email: true } }
        }
      });
      return updated;
    } catch (err) {
      if (err.code === 'P2002') {
        const customErr = new Error("This doctor's selected slot is no longer available.");
        customErr.statusCode = 409;
        throw customErr;
      }
      throw err;
    }
  });

  // Phase 6 async non-blocking integrations
  if (result) {
    notificationService.enqueueEmail(result.id, result.patient.email, 'RESCHEDULE');
    notificationService.enqueueEmail(result.id, result.doctor.email, 'RESCHEDULE');
    calendarService.enqueueCalendarSync(result.id, result.patientId, result.doctorId);
  }
  return result;
}

async function cancelAppointment(userId, role, appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { select: { id: true, email: true } },
      doctor: { select: { id: true, email: true } }
    }
  });

  if (!appointment) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }

  if (role === 'PATIENT' && appointment.patientId !== userId) {
    const err = new Error('Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  if (role === 'DOCTOR' && appointment.doctorId !== userId) {
    const err = new Error('Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  if (appointment.status === 'CANCELLED') {
    const err = new Error('Appointment is already cancelled');
    err.statusCode = 400;
    throw err;
  }

  const result = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' }
  });

  // Phase 6 async non-blocking integrations
  notificationService.enqueueEmail(appointment.id, appointment.patient.email, 'CANCELLATION');
  notificationService.enqueueEmail(appointment.id, appointment.doctor.email, 'CANCELLATION');
  calendarService.enqueueCalendarSync(appointment.id, appointment.patientId, appointment.doctorId);
  
  return result;
}

async function getPatientAppointments(patientId) {
  return await prisma.appointment.findMany({
    where: { patientId },
    orderBy: { slotStart: 'asc' },
    include: {
      doctor: { select: { name: true, doctorProfile: { select: { specialisation: true } } } },
      symptomForm: true,
      visitNote: true
    }
  });
}

async function getDoctorAppointments(doctorId) {
  return await prisma.appointment.findMany({
    where: { doctorId },
    orderBy: { slotStart: 'asc' },
    include: {
      patient: { select: { name: true, email: true } },
      symptomForm: true,
      visitNote: true
    }
  });
}

module.exports = {
  getDoctors,
  getAvailableSlots,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getPatientAppointments,
  getDoctorAppointments
};
