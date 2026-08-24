function generateSlots(workingHoursJson, slotDurationMinutes, targetDate, leaves = []) {
  const dateObj = new Date(targetDate);
  if (isNaN(dateObj.getTime())) {
    return [];
  }

  // Check if targetDate is a leave day
  const targetDateString = dateObj.toISOString().split('T')[0];
  const isLeave = leaves.some(leave => {
    const leaveDate = new Date(leave.leaveDate || leave);
    return leaveDate.toISOString().split('T')[0] === targetDateString;
  });

  if (isLeave) {
    return [];
  }

  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const daySchedule = workingHoursJson[dayOfWeek];

  if (!daySchedule || !daySchedule.enabled || !daySchedule.start || !daySchedule.end) {
    return [];
  }

  const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
  const [endHour, endMinute] = daySchedule.end.split(':').map(Number);

  if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
    return [];
  }

  let currentMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  if (currentMinutes >= endTotalMinutes) {
    return [];
  }

  const slots = [];
  while (currentMinutes + slotDurationMinutes <= endTotalMinutes) {
    const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
    const m = (currentMinutes % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMinutes += slotDurationMinutes;
  }

  return slots;
}

module.exports = { generateSlots };
