const prisma = require('../db/prisma');

async function getDoctors() {
  return await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    include: {
      doctorProfile: {
        include: {
          leaves: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function createProfile(userId, profileData) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }
  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a DOCTOR');
  }

  const existingProfile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (existingProfile) {
    throw new Error('DoctorProfile already exists for this user');
  }

  return await prisma.doctorProfile.create({
    data: {
      userId,
      specialisation: profileData.specialisation,
      workingHoursJson: profileData.workingHoursJson,
      slotDurationMinutes: profileData.slotDurationMinutes
    }
  });
}

async function updateProfile(userId, profileData) {
  const existingProfile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!existingProfile) {
    throw new Error('DoctorProfile not found');
  }

  return await prisma.doctorProfile.update({
    where: { userId },
    data: {
      specialisation: profileData.specialisation,
      workingHoursJson: profileData.workingHoursJson,
      slotDurationMinutes: profileData.slotDurationMinutes
    }
  });
}

async function createLeave(userId, leaveData) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error('DoctorProfile not found for this user');
  }

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

  return await prisma.doctorLeave.create({
    data: {
      doctorProfileId: profile.id,
      leaveDate: startOfDay,
      reason: leaveData.reason
    }
  });
}

async function deleteLeave(userId, leaveId) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error('DoctorProfile not found for this user');
  }

  const existingLeave = await prisma.doctorLeave.findUnique({ where: { id: leaveId } });
  if (!existingLeave) {
    throw new Error('Leave not found');
  }

  if (existingLeave.doctorProfileId !== profile.id) {
    throw new Error('Leave does not belong to this doctor');
  }

  return await prisma.doctorLeave.delete({ where: { id: leaveId } });
}

module.exports = {
  getDoctors,
  createProfile,
  updateProfile,
  createLeave,
  deleteLeave
};
