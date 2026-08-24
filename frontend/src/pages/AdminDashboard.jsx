import React, { useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/error-handler';
import { getDoctors, createDoctorProfile, updateDoctorProfile, markLeave, cancelLeave, checkLeaveImpact } from '../api/adminApi';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

const DEFAULT_HOURS = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: null, end: null },
  sunday: { enabled: false, start: null, end: null },
};

const WEEKDAYS_ORDER = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const getNext7Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    days.push({
      dateObj: d,
      dateString: d.toISOString().split('T')[0],
      displayDate: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      dayName
    });
  }
  return days;
};

const AdminDashboard = () => {
  const { showToast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Confirmation Modal
  const [leaveConfirmModal, setLeaveConfirmModal] = useState({ isOpen: false, impact: 0 });
  const [cancelLeaveConfirmModal, setCancelLeaveConfirmModal] = useState({ isOpen: false, leaveId: null });

  // Profile Form State
  const [specialisation, setSpecialisation] = useState('');
  const [slotDuration, setSlotDuration] = useState(30);
  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Leave Form State
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const data = await getDoctors();
      setDoctors(data);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleOpenProfile = (doctor) => {
    setSelectedDoctor(doctor);
    if (doctor.doctorProfile) {
      setSpecialisation(doctor.doctorProfile.specialisation);
      setSlotDuration(doctor.doctorProfile.slotDurationMinutes);
      setWorkingHours(doctor.doctorProfile.workingHoursJson);
    } else {
      setSpecialisation('');
      setSlotDuration(30);
      setWorkingHours(DEFAULT_HOURS);
    }
    setShowProfileModal(true);
  };

  const handleOpenLeave = (doctor) => {
    setSelectedDoctor(doctor);
    setLeaveDate('');
    setLeaveReason('');
    setShowLeaveModal(true);
  };

  const handleOpenSchedule = (doctor) => {
    setSelectedDoctor(doctor);
    setShowScheduleModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    try {
      const payload = {
        specialisation,
        slotDurationMinutes: parseInt(slotDuration, 10),
        workingHoursJson: workingHours
      };

      if (selectedDoctor.doctorProfile) {
        await updateDoctorProfile(selectedDoctor.id, payload);
      } else {
        await createDoctorProfile(selectedDoctor.id, payload);
      }
      
      setShowProfileModal(false);
      fetchDoctors();
      showToast('Profile saved successfully!', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const initiateLeaveSave = async (e) => {
    e.preventDefault();
    setIsSubmittingLeave(true);
    try {
      const impact = await checkLeaveImpact(selectedDoctor.id, leaveDate);
      if (impact.count > 0) {
        setLeaveConfirmModal({ isOpen: true, impact: impact.count });
        setIsSubmittingLeave(false);
      } else {
        await executeLeaveSave();
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      setIsSubmittingLeave(false);
    }
  };

  const executeLeaveSave = async () => {
    setIsSubmittingLeave(true);
    try {
      await markLeave(selectedDoctor.id, { leaveDate, reason: leaveReason });
      setLeaveDate('');
      setLeaveReason('');
      await fetchDoctors();
      setShowLeaveModal(false);
      setLeaveConfirmModal({ isOpen: false, impact: 0 });
      showToast('Leave marked successfully!', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const initiateCancelLeave = (leaveId) => {
    setCancelLeaveConfirmModal({ isOpen: true, leaveId });
  };

  const executeCancelLeave = async () => {
    const leaveId = cancelLeaveConfirmModal.leaveId;
    setCancelLeaveConfirmModal({ isOpen: false, leaveId: null });
    try {
      await cancelLeave(selectedDoctor.id, leaveId);
      await fetchDoctors();
      
      setSelectedDoctor(prev => ({
        ...prev,
        doctorProfile: {
          ...prev.doctorProfile,
          leaves: (prev.doctorProfile.leaves || []).filter(l => l.id !== leaveId)
        }
      }));
      
      showToast('Leave cancelled successfully!', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const updateDaySchedule = (day, field, value) => {
    setWorkingHours(prev => {
      const updated = { ...prev };
      const current = { ...updated[day] };
      current[field] = value;
      
      if (field === 'enabled') {
        if (value) {
          current.start = "09:00";
          current.end = "17:00";
        } else {
          current.start = null;
          current.end = null;
        }
      }
      updated[day] = current;
      return updated;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ margin: '0 0 8px 0' }}>Admin Dashboard</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Manage pre-registered Doctor accounts, set their profiles and working hours.</p>
      </div>

      <Card noPadding>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Doctor Management</h3>
          <Button variant="secondary" onClick={fetchDoctors}>Refresh</Button>
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Spinner size="32px" color="var(--primary)" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'var(--text-secondary)' }}>Doctor Details</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'var(--text-secondary)' }}>Profile Status</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(doctor => (
                  <tr key={doctor.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{doctor.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{doctor.email}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {doctor.doctorProfile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <Badge status="SUCCESS">Complete</Badge>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{doctor.doctorProfile.specialisation}</span>
                        </div>
                      ) : (
                        <Badge status="PENDING">Pending</Badge>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button 
                          variant={doctor.doctorProfile ? "secondary" : "primary"}
                          onClick={() => handleOpenProfile(doctor)}
                        >
                          {doctor.doctorProfile ? 'Edit Profile' : 'Create Profile'}
                        </Button>
                        {doctor.doctorProfile && (
                          <>
                            <Button variant="secondary" onClick={() => handleOpenSchedule(doctor)}>
                              View Schedule
                            </Button>
                            <Button 
                              variant="secondary" 
                              onClick={() => handleOpenLeave(doctor)}
                              style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)', color: 'var(--warning-text)' }}
                            >
                              Leave Management
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {doctors.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No doctors found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title={`${selectedDoctor?.doctorProfile ? 'Edit' : 'Create'} Profile for ${selectedDoctor?.name}`}
        maxWidth="600px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowProfileModal(false)} disabled={isSubmittingProfile}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveProfile} isLoading={isSubmittingProfile}>Save Profile</Button>
          </>
        }
      >
        <form id="profileForm" onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <Input 
              label="Specialisation"
              value={specialisation} 
              onChange={(e) => setSpecialisation(e.target.value)} 
              required
            />
            <Input 
              label="Slot Duration (minutes)"
              type="number" 
              min="5" 
              value={slotDuration} 
              onChange={(e) => setSlotDuration(e.target.value)} 
              required
            />
          </div>

          <h4 style={{ margin: '0 0 16px 0' }}>Working Hours</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {WEEKDAYS_ORDER.map(day => (
              <div key={day} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', background: 'var(--bg-hover)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}>
                <label style={{ width: '120px', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={workingHours[day].enabled} 
                    onChange={(e) => updateDaySchedule(day, 'enabled', e.target.checked)} 
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  {day}
                </label>
                {workingHours[day].enabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Input 
                      type="time" 
                      value={workingHours[day].start || ''} 
                      onChange={(e) => updateDaySchedule(day, 'start', e.target.value)} 
                      required 
                      style={{ marginBottom: 0 }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>to</span>
                    <Input 
                      type="time" 
                      value={workingHours[day].end || ''} 
                      onChange={(e) => updateDaySchedule(day, 'end', e.target.value)} 
                      required 
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Not Working</span>
                )}
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* Leave Management Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title={`Leave Management: ${selectedDoctor?.name}`}
        maxWidth="800px"
      >
        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>Existing Leaves</h4>
          {selectedDoctor?.doctorProfile?.leaves && selectedDoctor.doctorProfile.leaves.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Day</th>
                    <th style={{ padding: '12px' }}>Reason</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(selectedDoctor.doctorProfile.leaves || [])]
                    .sort((a, b) => new Date(a.leaveDate) - new Date(b.leaveDate))
                    .map((l, idx) => {
                    const d = new Date(l.leaveDate);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px' }}>{d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</td>
                        <td style={{ padding: '12px' }}>{l.reason || '-'}</td>
                        <td style={{ padding: '12px' }}><Badge status="DANGER">Leave</Badge></td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <Button variant="danger" onClick={() => initiateCancelLeave(l.id)}>Cancel Leave</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No leaves marked.</p>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>Add Future Leave</h4>
          <form onSubmit={initiateLeaveSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <Input 
                label="Leave Date"
                type="date" 
                value={leaveDate} 
                onChange={(e) => setLeaveDate(e.target.value)} 
                required 
                min={new Date().toISOString().split('T')[0]} 
              />
              <Input 
                label="Reason (Optional)"
                type="text" 
                value={leaveReason} 
                onChange={(e) => setLeaveReason(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setShowLeaveModal(false)}>Close</Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingLeave}>Add Leave</Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Leave Conflict Confirmation Modal */}
      <Modal
        isOpen={leaveConfirmModal.isOpen}
        onClose={() => { setLeaveConfirmModal({ isOpen: false, impact: 0 }); setIsSubmittingLeave(false); }}
        title="Mark Doctor Leave"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setLeaveConfirmModal({ isOpen: false, impact: 0 }); setIsSubmittingLeave(false); }}>Cancel</Button>
            <Button variant="danger" onClick={executeLeaveSave} isLoading={isSubmittingLeave}>Confirm Leave</Button>
          </>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <strong>Doctor:</strong> Dr. {selectedDoctor?.name}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <strong>Date:</strong> {leaveDate}
        </div>
        <div style={{ marginBottom: '24px' }}>
          <strong>Affected appointments:</strong> {leaveConfirmModal.impact}
        </div>
        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', padding: '16px', borderRadius: 'var(--border-radius)', display: 'flex', gap: '8px', color: 'var(--warning-text)' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠</span>
          <p style={{ margin: 0 }}>This action will cancel <strong>{leaveConfirmModal.impact}</strong> existing appointment(s) and notify the affected patients. Proceed?</p>
        </div>
      </Modal>

      <Modal
        isOpen={cancelLeaveConfirmModal.isOpen}
        onClose={() => setCancelLeaveConfirmModal({ isOpen: false, leaveId: null })}
        title="Cancel Leave"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelLeaveConfirmModal({ isOpen: false, leaveId: null })}>Go Back</Button>
            <Button variant="danger" onClick={executeCancelLeave}>Yes, Cancel Leave</Button>
          </>
        }
      >
        <p>Are you sure you want to cancel this leave?</p>
      </Modal>

      {/* Schedule / Calendar Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={`7-Day Schedule: ${selectedDoctor?.name}`}
        maxWidth="700px"
        footer={<Button onClick={() => setShowScheduleModal(false)}>Close</Button>}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Date</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Day</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Working Hours</th>
              <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {selectedDoctor?.doctorProfile && getNext7Days().map((dayInfo, idx) => {
              const leaves = selectedDoctor.doctorProfile.leaves || [];
              const isLeave = leaves.some(l => new Date(l.leaveDate).toISOString().split('T')[0] === dayInfo.dateString);
              const dayConfig = selectedDoctor.doctorProfile.workingHoursJson[dayInfo.dayName];
              
              let status = "Working";
              let hoursDisplay = "-";
              let statusBadge = <Badge status="SUCCESS">Working</Badge>;

              if (isLeave) {
                status = "LEAVE";
                hoursDisplay = dayConfig?.enabled ? `${dayConfig.start}–${dayConfig.end}` : "—";
                statusBadge = <Badge status="DANGER">LEAVE</Badge>;
              } else if (!dayConfig || !dayConfig.enabled) {
                status = "Not Working";
                hoursDisplay = "—";
                statusBadge = <Badge status="DEFAULT">Not Working</Badge>;
              } else {
                hoursDisplay = `${dayConfig.start}–${dayConfig.end}`;
              }

              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{dayInfo.displayDate}</td>
                  <td style={{ padding: '12px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{dayInfo.dayName}</td>
                  <td style={{ padding: '12px', color: status === 'Not Working' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{hoursDisplay}</td>
                  <td style={{ padding: '12px' }}>{statusBadge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
