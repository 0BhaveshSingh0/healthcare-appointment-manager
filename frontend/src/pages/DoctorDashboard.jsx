import React, { useState, useEffect } from 'react';
import { getDoctorAppointments, getDoctorAvailableSlots, rescheduleAppointment, submitNotes, cancelAppointment, connectGoogleCalendar } from '../api/doctorApi';
import { checkCalendarStatus } from '../api/patientApi'; // Assuming this is shared
import { getErrorMessage } from '../utils/error-handler';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(true);
  const [hasCalendar, setHasCalendar] = useState(null);
  
  // Reschedule state
  const [rescheduleAppId, setRescheduleAppId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);

  // AI Summary state
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [activeSymptomForm, setActiveSymptomForm] = useState(null);

  // Post-Visit Notes state
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeAppointmentForNotes, setActiveAppointmentForNotes] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescription, setPrescription] = useState({ medication: '', dosage: '', frequency: '', duration: '' });
  const [isSubmittingNotes, setIsSubmittingNotes] = useState(false);

  // Confirm Modals
  const [confirmRescheduleModal, setConfirmRescheduleModal] = useState({ isOpen: false, slotTime: null });
  const [confirmCancelModal, setConfirmCancelModal] = useState({ isOpen: false, appointmentId: null });

  const fetchAuthStatus = async () => {
    try {
      const status = await checkCalendarStatus();
      setHasCalendar(status);
    } catch (err) {
      console.error('Error fetching calendar status:', err);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
    window.addEventListener('focus', fetchAuthStatus);
    return () => window.removeEventListener('focus', fetchAuthStatus);
  }, []);

  const fetchAppointments = async () => {
    setIsFetchingAppointments(true);
    try {
      const data = await getDoctorAppointments();
      setAppointments(data.appointments);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsFetchingAppointments(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleDateChange = async (e) => {
    const d = e.target.value;
    setRescheduleDate(d);
    if (d) {
      try {
        const data = await getDoctorAvailableSlots(user.id || user.userId, d);
        setAvailableSlots(data.slots);
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
      }
    }
  };

  const initiateReschedule = (slotTime) => {
    setConfirmRescheduleModal({ isOpen: true, slotTime });
  };

  const executeReschedule = async () => {
    const slotTime = confirmRescheduleModal.slotTime;
    setConfirmRescheduleModal({ isOpen: false, slotTime: null });
    try {
      await rescheduleAppointment(rescheduleAppId, rescheduleDate, slotTime);
      showToast('Appointment rescheduled successfully!', 'success');
      setRescheduleAppId(null);
      fetchAppointments();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      if (rescheduleDate) {
        const data = await getDoctorAvailableSlots(user.id || user.userId, rescheduleDate);
        setAvailableSlots(data.slots);
      }
    }
  };

  const handleOpenAiSummary = (symptomForm) => {
    setActiveSymptomForm(symptomForm);
    setAiSummaryModalOpen(true);
  };

  const handleOpenNotesModal = (app) => {
    setActiveAppointmentForNotes(app);
    setClinicalNotes('');
    setPrescription({ medication: '', dosage: '', frequency: '', duration: '' });
    setNotesModalOpen(true);
  };

  const handleSubmitNotes = async () => {
    if (!clinicalNotes.trim()) {
      showToast("Clinical notes are required.", "warning");
      return;
    }
    setIsSubmittingNotes(true);
    try {
      await submitNotes(activeAppointmentForNotes.id, clinicalNotes, prescription);
      showToast('Post-visit notes submitted successfully!', 'success');
      setNotesModalOpen(false);
      fetchAppointments();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSubmittingNotes(false);
    }
  };

  const initiateCancel = (id) => {
    setConfirmCancelModal({ isOpen: true, appointmentId: id });
  };

  const executeCancel = async () => {
    const id = confirmCancelModal.appointmentId;
    setConfirmCancelModal({ isOpen: false, appointmentId: null });
    try {
      await cancelAppointment(id);
      showToast('Appointment cancelled successfully!', 'success');
      fetchAppointments();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0' }}>Doctor Dashboard</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Welcome back, Dr. {user?.name}</p>
        </div>
      </div>

      {/* Google Calendar Status Section */}
      <Card style={{ 
        borderLeft: `4px solid ${hasCalendar === true ? 'var(--success)' : hasCalendar === false ? 'var(--danger)' : 'var(--border-color)'}`,
        background: hasCalendar === true ? 'var(--success-bg)' : hasCalendar === false ? 'var(--danger-bg)' : 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            {hasCalendar === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Spinner size="16px" /> Checking Google Calendar connection...
              </div>
            ) : hasCalendar === true ? (
              <>
                <h3 style={{ color: 'var(--success-text)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>📅</span> Google Calendar Connected
                </h3>
                <p style={{ margin: 0, color: 'var(--success-text)', opacity: 0.9 }}>Your schedule is automatically synchronized.</p>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--danger-text)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔴</span> Google Calendar Not Connected
                </h3>
                <p style={{ margin: 0, color: 'var(--danger-text)', opacity: 0.9 }}>Connect your Google Calendar to synchronize your schedule.</p>
              </>
            )}
          </div>
          {hasCalendar === false && (
            <Button onClick={connectGoogleCalendar} style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
              Connect Google Calendar
            </Button>
          )}
        </div>
      </Card>
      
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>My Schedule & Appointments</h3>
          <Button variant="secondary" onClick={fetchAppointments}>Refresh</Button>
        </div>
        
        {isFetchingAppointments ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Spinner size="32px" color="var(--primary)" />
          </div>
        ) : appointments.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Patient Info</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pre-Visit Info</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(app => {
                  const d = new Date(app.slotStart);
                  const isRescheduling = rescheduleAppId === app.id;
                  return (
                    <React.Fragment key={app.id}>
                      <tr style={{ borderBottom: isRescheduling ? 'none' : '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            {d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 500 }}>{app.patient.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{app.patient.email}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Badge status={app.status} />
                        </td>
                        <td style={{ padding: '16px' }}>
                          {app.symptomForm ? (
                            <Button 
                              variant="secondary" 
                              onClick={() => handleOpenAiSummary(app.symptomForm)}
                              style={{ background: 'var(--info-bg)', borderColor: 'var(--info)', color: 'var(--info-text)' }}
                            >
                              View Summary
                            </Button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No Data</span>
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {app.status === 'SCHEDULED' && (
                              <>
                                <Button 
                                  variant="secondary"
                                  onClick={() => { setRescheduleAppId(app.id); setRescheduleDate(''); setAvailableSlots([]); }}
                                  style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)', color: 'var(--warning-text)' }}
                                >
                                  Reschedule
                                </Button>
                                <Button variant="danger" onClick={() => initiateCancel(app.id)}>
                                  Cancel
                                </Button>
                              </>
                            )}
                            {!app.visitNote && new Date(app.slotEnd) <= new Date() && (
                              <Button variant="primary" onClick={() => handleOpenNotesModal(app)}>
                                Submit Notes
                              </Button>
                            )}
                            {app.visitNote && (
                              <Badge status="SUCCESS">Notes Submitted</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Reschedule Inline Form */}
                      {isRescheduling && (
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-hover)' }}>
                          <td colSpan="5" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                              <div style={{ width: '250px' }}>
                                <Input 
                                  label="Select New Date"
                                  type="date" 
                                  value={rescheduleDate} 
                                  onChange={handleDateChange}
                                  min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
                                  style={{ marginBottom: 0 }}
                                />
                              </div>
                              
                              {rescheduleDate && (
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Available Slots:</label>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {availableSlots.length > 0 ? availableSlots.map(slot => (
                                      <Button 
                                        key={slot}
                                        onClick={() => initiateReschedule(slot)}
                                        variant="secondary"
                                        style={{ background: 'var(--info-bg)', borderColor: 'var(--info)', color: 'var(--info-text)' }}
                                      >
                                        {slot}
                                      </Button>
                                    )) : (
                                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No slots available</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <Button variant="ghost" onClick={() => setRescheduleAppId(null)} style={{ marginTop: '24px' }}>
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState 
            icon="🩺" 
            title="No appointments scheduled" 
            description="You don't have any upcoming appointments at this time." 
          />
        )}
      </Card>

      {/* Modals */}
      <Modal
        isOpen={confirmRescheduleModal.isOpen}
        onClose={() => setConfirmRescheduleModal({ isOpen: false, slotTime: null })}
        title="Confirm Reschedule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRescheduleModal({ isOpen: false, slotTime: null })}>Cancel</Button>
            <Button variant="primary" onClick={executeReschedule}>Confirm Reschedule</Button>
          </>
        }
      >
        <p>Are you sure you want to reschedule this appointment to <strong>{rescheduleDate}</strong> at <strong>{confirmRescheduleModal.slotTime}</strong>?</p>
      </Modal>

      <Modal
        isOpen={confirmCancelModal.isOpen}
        onClose={() => setConfirmCancelModal({ isOpen: false, appointmentId: null })}
        title="Cancel Appointment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancelModal({ isOpen: false, appointmentId: null })}>Go Back</Button>
            <Button variant="danger" onClick={executeCancel}>Yes, Cancel Appointment</Button>
          </>
        }
      >
        <p>Are you sure you want to cancel this appointment? This action cannot be undone.</p>
      </Modal>

      <Modal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        title="Pre-Visit AI Summary"
        footer={<Button onClick={() => setAiSummaryModalOpen(false)}>Close</Button>}
        maxWidth="600px"
      >
        {activeSymptomForm?.llmStatus === 'FAILED' ? (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '16px', borderRadius: 'var(--border-radius)', marginBottom: '16px' }}>
            <p style={{ color: 'var(--danger-text)', fontWeight: 600, margin: '0 0 8px 0' }}>AI Summary Unavailable</p>
            <p style={{ color: 'var(--danger-text)', margin: 0, fontSize: '0.875rem' }}>The patient submitted symptoms, but the AI summary failed to generate.</p>
          </div>
        ) : activeSymptomForm?.llmStatus === 'PENDING' ? (
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-text)', padding: '16px', background: 'var(--warning-bg)', borderRadius: 'var(--border-radius)' }}>
            <Spinner size="16px" color="var(--warning-text)" /> AI Summary is still generating...
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <strong>Urgency Level:</strong> 
              <Badge 
                status={activeSymptomForm?.aiUrgency} 
                style={{ marginLeft: '8px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Chief Complaint:</strong>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{activeSymptomForm?.aiChiefComplaint}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Suggested Questions:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'var(--text-primary)' }}>
                {(() => {
                  let questions = activeSymptomForm?.aiQuestionsJson;
                  if (typeof questions === 'string') {
                    try { questions = JSON.parse(questions); } catch (e) {}
                  }
                  const questionsArray = Array.isArray(questions) ? questions : [];
                  return questionsArray.map((q, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{q}</li>
                  ));
                })()}
              </ul>
            </div>
          </>
        )}

        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <strong>Raw Symptoms (Patient Input):</strong>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'pre-wrap', padding: '12px', background: 'var(--bg-hover)', borderRadius: 'var(--border-radius)' }}>
            {activeSymptomForm?.rawSymptomsText}
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        title="Post-Visit Notes"
        maxWidth="600px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNotesModalOpen(false)} disabled={isSubmittingNotes}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmitNotes} isLoading={isSubmittingNotes}>Submit Notes</Button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Patient: <strong>{activeAppointmentForNotes?.patient?.name}</strong>
        </p>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.875rem' }}>Clinical Notes (Required)</label>
          <textarea 
            rows="4"
            value={clinicalNotes}
            onChange={e => setClinicalNotes(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Enter clinical observations and notes..."
            disabled={isSubmittingNotes}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.875rem' }}>Prescription (Optional)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input 
              label="Medication Name"
              placeholder="e.g. Amoxicillin" 
              value={prescription.medication}
              onChange={e => setPrescription({ ...prescription, medication: e.target.value })}
              disabled={isSubmittingNotes}
            />
            <Input 
              label="Dosage"
              placeholder="e.g. 500mg" 
              value={prescription.dosage}
              onChange={e => setPrescription({ ...prescription, dosage: e.target.value })}
              disabled={isSubmittingNotes}
            />
            <Input 
              label="Frequency"
              placeholder="e.g. 2x daily" 
              value={prescription.frequency}
              onChange={e => setPrescription({ ...prescription, frequency: e.target.value })}
              disabled={isSubmittingNotes}
            />
            <Input 
              label="Duration"
              placeholder="e.g. 5 days" 
              value={prescription.duration}
              onChange={e => setPrescription({ ...prescription, duration: e.target.value })}
              disabled={isSubmittingNotes}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
