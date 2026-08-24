const { generateSlots } = require('./src/utils/slot-generator');

const workingHoursJson = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "12:00" },
  wednesday: { enabled: false, start: null, end: null },
  thursday: { enabled: true, start: "09:00", end: "09:45" },
  friday: { enabled: true, start: "14:00", end: "14:20" },
  saturday: { enabled: false, start: null, end: null },
  sunday: { enabled: false, start: null, end: null },
};

function test(name, result, expected) {
  const resultStr = JSON.stringify(result);
  const expectedStr = JSON.stringify(expected);
  if (resultStr === expectedStr) {
    console.log(`[PASS] ${name}`);
  } else {
    console.error(`[FAIL] ${name}\n  Expected: ${expectedStr}\n  Got:      ${resultStr}`);
  }
}

// 2026-08-24 is a Monday
test('Standard 30 min slots (Monday)', generateSlots(workingHoursJson, 30, '2026-08-24'), 
  ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);

// 2026-08-26 is a Wednesday (disabled)
test('Disabled day returns empty array (Wednesday)', generateSlots(workingHoursJson, 30, '2026-08-26'), []);

// 2026-08-27 is a Thursday (45 min total, 30 min slot duration)
test('Slots fit entirely inside working period (Thursday)', generateSlots(workingHoursJson, 30, '2026-08-27'), ["09:00"]);

// 2026-08-28 is a Friday (20 min total, 30 min slot duration)
test('No slot fits in short period (Friday)', generateSlots(workingHoursJson, 30, '2026-08-28'), []);

// Leave tests
const leaves = [{ leaveDate: '2026-08-31T00:00:00.000Z' }]; // 2026-08-31 is a Monday
test('Leave day returns empty array (Monday)', generateSlots(workingHoursJson, 30, '2026-08-31', leaves), []);

console.log('Slot generation tests complete.');
