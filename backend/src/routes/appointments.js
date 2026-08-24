const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const bookingService = require('../services/booking-service');
const { z } = require('zod');

const router = express.Router();

// GET /appointments/doctors
// Patient searches for doctors
router.get('/doctors', authenticate, authorizeRole('PATIENT'), async (req, res, next) => {
  try {
    const specialisation = req.query.specialisation || '';
    const doctors = await bookingService.getDoctors(specialisation);
    res.status(200).json({ doctors });
  } catch (err) {
    next(err);
  }
});

// GET /appointments/doctors/:id/slots
// Patient gets available slots for a doctor on a specific date (Doctor also uses this to reschedule)
router.get('/doctors/:id/slots', authenticate, (req, res, next) => {
  if (req.user.role !== 'PATIENT' && req.user.role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}, async (req, res, next) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      const err = new Error("Missing 'date' query parameter");
      err.statusCode = 400;
      throw err;
    }
    const slots = await bookingService.getAvailableSlots(req.params.id, dateStr);
    res.status(200).json({ slots });
  } catch (err) {
    next(err);
  }
});

// PUT /appointments/:id/reschedule
// Doctor reschedules an existing appointment
const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, use YYYY-MM-DD"),
  slotTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format, use HH:mm")
});

router.put('/:id/reschedule', authenticate, authorizeRole('DOCTOR'), async (req, res, next) => {
  try {
    const parsed = rescheduleSchema.parse(req.body);
    const appointment = await bookingService.rescheduleAppointment(
      req.user.userId,
      req.params.id,
      parsed.date,
      parsed.slotTime
    );
    res.status(200).json({ appointment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new Error(err.issues.map(i => i.message).join(', '));
      error.statusCode = 400;
      return next(error);
    }
    next(err);
  }
});

// POST /appointments
// Patient books an appointment
const bookSchema = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, use YYYY-MM-DD"),
  slotTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format, use HH:mm")
});

router.post('/', authenticate, authorizeRole('PATIENT'), async (req, res, next) => {
  try {
    const parsed = bookSchema.parse(req.body);
    const appointment = await bookingService.bookAppointment(
      req.user.userId,
      parsed.doctorId,
      parsed.date,
      parsed.slotTime
    );
    res.status(201).json({ appointment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new Error(err.issues.map(i => i.message).join(', '));
      error.statusCode = 400;
      return next(error);
    }
    next(err);
  }
});

// PUT /appointments/:id/cancel
// Patient or Doctor cancels an appointment
router.put('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'PATIENT' && req.user.role !== 'DOCTOR') {
      const err = new Error('Unauthorized');
      err.statusCode = 403;
      throw err;
    }
    const appointment = await bookingService.cancelAppointment(req.user.userId, req.user.role, req.params.id);
    res.status(200).json({ appointment });
  } catch (err) {
    next(err);
  }
});

// GET /appointments/patient
// Patient views their own appointments
router.get('/patient', authenticate, authorizeRole('PATIENT'), async (req, res, next) => {
  try {
    const appointments = await bookingService.getPatientAppointments(req.user.userId);
    res.status(200).json({ appointments });
  } catch (err) {
    next(err);
  }
});

// GET /appointments/doctor
// Doctor views their own appointments
router.get('/doctor', authenticate, authorizeRole('DOCTOR'), async (req, res, next) => {
  try {
    const appointments = await bookingService.getDoctorAppointments(req.user.userId);
    res.status(200).json({ appointments });
  } catch (err) {
    next(err);
  }
});

// POST /appointments/:id/symptoms
// Patient submits symptom form
const symptomSchema = z.object({
  rawSymptomsText: z.string().min(1, "Symptoms cannot be empty")
});

router.post('/:id/symptoms', authenticate, authorizeRole('PATIENT'), async (req, res, next) => {
  try {
    const parsed = symptomSchema.parse(req.body);
    const appointmentId = req.params.id;

    // Check if symptom form already exists in the route layer or service layer
    // Let's do a quick DB check to return 409
    const dbClient = require('../db/prisma');
    if (!dbClient.symptomForm) {
       console.error("DEBUG: dbClient.symptomForm is undefined. Available keys:", Object.keys(dbClient).join(', '));
    }
    const existing = await dbClient.symptomForm.findUnique({
      where: { appointmentId }
    });
    if (existing) {
      const err = new Error('Symptom form already submitted for this appointment');
      err.statusCode = 409;
      return next(err);
    }

    // Verify ownership
    const appointment = await dbClient.appointment.findUnique({
      where: { id: appointmentId }
    });
    if (!appointment || appointment.patientId !== req.user.userId) {
      const err = new Error('Appointment not found or unauthorized');
      err.statusCode = 404;
      return next(err);
    }

    const symptomService = require('../services/symptom-service');
    const symptomForm = await symptomService.processSymptomForm(appointmentId, parsed.rawSymptomsText);
    
    res.status(201).json({ symptomForm });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new Error(err.issues.map(i => i.message).join(', '));
      error.statusCode = 400;
      return next(error);
    }
    next(err);
  }
});

// POST /appointments/:id/notes
// Doctor submits post-visit clinical notes and prescription
const notesSchema = z.object({
  clinicalNotes: z.string().min(1, "Clinical notes cannot be empty"),
  prescription: z.any().optional() // Can be object or array
});

router.post('/:id/notes', authenticate, authorizeRole('DOCTOR'), async (req, res, next) => {
  try {
    const parsed = notesSchema.parse(req.body);
    const appointmentId = req.params.id;
    const doctorId = req.user.userId;

    const visitNotesService = require('../services/visit-notes-service');
    const visitNote = await visitNotesService.processVisitNotes(
      doctorId, 
      appointmentId, 
      parsed.clinicalNotes, 
      parsed.prescription
    );
    
    res.status(201).json({ visitNote });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const error = new Error(err.issues.map(i => i.message).join(', '));
      error.statusCode = 400;
      return next(error);
    }
    if (err.message === 'Appointment not found' || err.message.startsWith('Unauthorized')) {
      err.statusCode = 403;
    }
    if (err.message === 'Visit notes already submitted for this appointment') {
      err.statusCode = 409;
    }
    if (err.message.includes('concluded')) {
      err.statusCode = 400;
    }
    next(err);
  }
});

module.exports = router;
