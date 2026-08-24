const { Resend } = require('resend');
const prisma = require('../db/prisma');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Enqueue an email notification in the database to be processed asynchronously.
 * This function NEVER blocks or throws errors related to email sending.
 */
async function enqueueEmail(appointmentId, recipient, type) {
  try {
    const emailLog = await prisma.emailLog.create({
      data: {
        appointmentId,
        recipient,
        type,
        status: 'PENDING',
      },
    });
    
    // We immediately fire-and-forget the processing function
    // so emails go out quickly if possible, without blocking the response.
    processEmailLog(emailLog.id).catch(err => {
      console.error(`Failed to process email log ${emailLog.id} asynchronously:`, err.message);
    });
    
    return emailLog;
  } catch (err) {
    console.error('Failed to enqueue email:', err.message);
  }
}

/**
 * Processes a specific EmailLog entry.
 */
async function processEmailLog(emailLogId) {
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      appointment: {
        include: {
          doctor: true,
          patient: true
        }
      },
      medicationReminder: true
    }
  });

  if (!emailLog || emailLog.status === 'SUCCESS') return;

  const { appointment } = emailLog;
  if (!appointment) return;

  let subject = '';
  let text = '';
  
  const formattedDate = new Date(appointment.slotStart).toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  if (emailLog.type === 'CONFIRMATION') {
    subject = `Appointment Confirmed: ${formattedDate}`;
    if (emailLog.recipient === appointment.patient.email) {
      text = `Hello ${appointment.patient.name},\n\nYour appointment with Dr. ${appointment.doctor.name} has been confirmed for ${formattedDate}.\n\nThank you.`;
    } else {
      text = `Hello Dr. ${appointment.doctor.name},\n\nA new appointment has been booked by ${appointment.patient.name} for ${formattedDate}.\n\nThank you.`;
    }
  } else if (emailLog.type === 'CANCELLATION') {
    subject = `Appointment Cancelled: ${formattedDate}`;
    if (emailLog.recipient === appointment.patient.email) {
      text = `Hello ${appointment.patient.name},\n\nYour appointment with Dr. ${appointment.doctor.name} on ${formattedDate} has been cancelled.\n\nThank you.`;
    } else {
      text = `Hello Dr. ${appointment.doctor.name},\n\nYour appointment with ${appointment.patient.name} on ${formattedDate} has been cancelled.\n\nThank you.`;
    }
  } else if (emailLog.type === 'RESCHEDULE') {
    subject = `Appointment Rescheduled: ${formattedDate}`;
    if (emailLog.recipient === appointment.patient.email) {
      text = `Hello ${appointment.patient.name},\n\nYour appointment with Dr. ${appointment.doctor.name} has been rescheduled to ${formattedDate}.\n\nThank you.`;
    } else {
      text = `Hello Dr. ${appointment.doctor.name},\n\nYour appointment with ${appointment.patient.name} has been rescheduled to ${formattedDate}.\n\nThank you.`;
    }
  } else if (emailLog.type === 'MEDICATION_REMINDER' && emailLog.medicationReminder) {
    const med = emailLog.medicationReminder;
    subject = `Medication Reminder: ${med.medicationName}`;
    text = `Hello ${appointment.patient.name},\n\nIt is time to take your medication:\nMedication: ${med.medicationName}\nDosage: ${med.dosage || 'As prescribed'}\n\nThank you.`;
  } else {
    // Unknown type
    return;
  }

  try {
    // Attempt to send
    const { data, error } = await resend.emails.send({
      from: "Healthcare Appointment Manager <onboarding@resend.dev>",
      to: emailLog.recipient,
      subject,
      text,
    });

    if (error) {
      throw new Error(error.message);
    }

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'SUCCESS',
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 }
      }
    });
  } catch (err) {
    console.error(`Email send failed for log ${emailLog.id}:`, err.message);
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'FAILED',
        errorInfo: err.message,
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 }
      }
    });
  }
}

module.exports = {
  enqueueEmail,
  processEmailLog
};
