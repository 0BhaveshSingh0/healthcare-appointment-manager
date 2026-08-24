const express = require('express');
const { z } = require('zod');
const doctorService = require('../services/doctor-service');
const { authenticate, authorizeRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('ADMIN'));

const daySchema = z.object({
  enabled: z.boolean(),
  start: z.string().nullable().refine(val => {
    if (val === null) return true;
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
  }, { message: "start must be in HH:mm format" }),
  end: z.string().nullable().refine(val => {
    if (val === null) return true;
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
  }, { message: "end must be in HH:mm format" })
});

const workingHoursSchema = z.object({
  monday: daySchema,
  tuesday: daySchema,
  wednesday: daySchema,
  thursday: daySchema,
  friday: daySchema,
  saturday: daySchema,
  sunday: daySchema,
}).superRefine((data, ctx) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    const schedule = data[day];
    if (schedule.enabled) {
      if (!schedule.start || !schedule.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${day} is enabled but missing start or end time`,
          path: [day]
        });
      } else if (schedule.start >= schedule.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${day} start time must be before end time`,
          path: [day]
        });
      }
    } else {
      if (schedule.start !== null || schedule.end !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${day} is disabled, start and end must be null`,
          path: [day]
        });
      }
    }
  }
});

const profileSchema = z.object({
  specialisation: z.string().min(1, 'Specialisation is required'),
  workingHoursJson: workingHoursSchema,
  slotDurationMinutes: z.number().int().min(5, 'Slot duration must be at least 5 minutes')
});

const leaveSchema = z.object({
  leaveDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  reason: z.string().optional().nullable()
});

router.get('/doctors', async (req, res, next) => {
  try {
    const doctors = await doctorService.getDoctors();
    res.status(200).json({ doctors });
  } catch (error) {
    next(error);
  }
});

router.post('/doctors/:id/profile', async (req, res, next) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const profile = await doctorService.createProfile(req.params.id, validatedData);
    res.status(201).json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const err = new Error(error.issues.map(e => e.message).join(', '));
      err.statusCode = 400;
      return next(err);
    }
    if (error.message === 'User not found' || error.message === 'User is not a DOCTOR' || error.message === 'DoctorProfile already exists for this user') {
       const err = new Error(error.message);
       err.statusCode = 400;
       return next(err);
    }
    next(error);
  }
});

router.put('/doctors/:id/profile', async (req, res, next) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const profile = await doctorService.updateProfile(req.params.id, validatedData);
    res.status(200).json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const err = new Error(error.issues.map(e => e.message).join(', '));
      err.statusCode = 400;
      return next(err);
    }
    if (error.message === 'DoctorProfile not found') {
       const err = new Error(error.message);
       err.statusCode = 404;
       return next(err);
    }
    next(error);
  }
});

const leaveConflictService = require('../services/leave-conflict-service');

router.get('/doctors/:id/leave/impact', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    
    const affected = await leaveConflictService.getAffectedAppointments(req.params.id, date);
    res.status(200).json({ count: affected.length, appointments: affected });
  } catch (error) {
    if (error.message === 'DoctorProfile not found for this user') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/doctors/:id/leave', async (req, res, next) => {
  try {
    const validatedData = leaveSchema.parse(req.body);
    const leave = await leaveConflictService.markLeaveAndCascade(req.params.id, validatedData);
    res.status(201).json({ leave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const err = new Error(error.issues.map(e => e.message).join(', '));
      err.statusCode = 400;
      return next(err);
    }
    if (error.message === 'Cannot mark leave in the past' || error.message === 'Leave already exists for this date') {
       const err = new Error(error.message);
       err.statusCode = 409;
       return next(err);
    }
    if (error.message === 'DoctorProfile not found for this user') {
       const err = new Error(error.message);
       err.statusCode = 404;
       return next(err);
    }
    next(error);
  }
});

router.delete('/doctors/:id/leave/:leaveId', async (req, res, next) => {
  try {
    await doctorService.deleteLeave(req.params.id, req.params.leaveId);
    res.status(200).json({ message: 'Leave successfully deleted' });
  } catch (error) {
    if (error.message === 'Leave not found' || error.message === 'DoctorProfile not found for this user') {
      const err = new Error(error.message);
      err.statusCode = 404;
      return next(err);
    }
    if (error.message === 'Leave does not belong to this doctor') {
      const err = new Error(error.message);
      err.statusCode = 403;
      return next(err);
    }
    next(error);
  }
});

module.exports = router;
