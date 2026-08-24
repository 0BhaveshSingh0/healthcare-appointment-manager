const express = require('express');
const { z } = require('zod');
const authService = require('../services/auth-service');
const { authenticate } = require('../middleware/auth');
const prisma = require('../db/prisma');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.register(validatedData);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const err = new Error(error.errors.map(e => e.message).join(', '));
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const err = new Error(error.errors.map(e => e.message).join(', '));
      err.statusCode = 400;
      return next(err);
    }
    next(error);
  }
});

// Helper route to get current user data using token
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const token = await prisma.oAuthToken.findFirst({
      where: { userId: req.user.userId }
    });
    res.status(200).json({ 
      user: req.user,
      hasCalendar: !!token
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
