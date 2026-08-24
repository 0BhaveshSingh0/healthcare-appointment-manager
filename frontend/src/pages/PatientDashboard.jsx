import React, { useState, useEffect } from 'react';
import { getDoctors, getAvailableSlots, bookAppointment, getPatientAppointments, submitSymptoms, cancelAppointment, connectGoogleCalendar, checkCalendarStatus } from '../api/patientApi';
import { getErrorMessage } from '../utils/error-handler';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

export default function PatientDashboard() {
  const { showToast } = useToast();
  
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [specialisation, setSpecialisation] = useState('');
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [dateStr, setDateStr] = useState('');
  const [slots, setSlots] = useState([]);
  
  const [view, setView] = useState('APPOINTMENTS'); // Default to APPOINTMENTS for better UX
  
  const [symptomModalOpen, setSymptomModalOpen] = useState(false);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [symptomsText, setSymptomsText] = useState('');
  const [isSubmittingSymptoms, setIsSubmittingSymptoms] = useState(false);

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [activeVisitNote, setActiveVisitNote] = useState(null);

  const [hasCalendar, setHasCalendar] = useState(null);
  const [isFetchingAppointments, setIsFetchingAppointments] = useState(true);

  // New state for confirm modals
  const [confirmBookModal, setConfirmBookModal] = useState({ isOpen: false, slotTime: null });
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
      const data = await getPatientAppointments();
      setAppointments(data.appointments);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsFetchingAppointments(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const data = await getDoctors(specialisation);
      setDoctors(data.doctors);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleSelectDoctor = (doc) => {
    setSelectedDoctor(doc);
    setView('BOOKING');
    setDateStr('');
    setSlots([]);
  };

  const fetchSlots = async (date) => {
    try {
      const data = await getAvailableSlots(selectedDoctor.id, date);
      setSlots(data.slots);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    setDateStr(d);
    if (d) {
      fetchSlots(d);
    }
  };

  const initiateBooking = (slotTime) => {
    if (hasCalendar === false) {
      showToast('Please connect your Google Calendar before making an appointment.', 'warning');
      return;
    }
    setConfirmBookModal({ isOpen: true, slotTime });
  };

  const executeBook = async () => {
    const slotTime = confirmBookModal.slotTime;
    setConfirmBookModal({ isOpen: false, slotTime: null });
    try {
      await bookAppointment(selectedDoctor.id, dateStr, slotTime);
      showToast('Appointment booked successfully!', 'success');
      setView('APPOINTMENTS');
      fetchAppointments();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      if (dateStr) fetchSlots(dateStr);
    }
  };

  const handleOpenSymptomModal = (appId) => {
    setActiveAppointmentId(appId);
    setSymptomsText('');
    setSymptomModalOpen(true);
  };

  const handleSubmitSymptoms = async (e) => {
    e.preventDefault();
    if (!symptomsText.trim()) return showToast("Symptoms cannot be empty", "warning");
    setIsSubmittingSymptoms(true);
    try {
      await submitSymptoms(activeAppointmentId, symptomsText);
      showToast('Symptoms submitted successfully!', 'success');
      setSymptomModalOpen(false);
      fetchAppointments();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsSubmittingSymptoms(false);
    }
  };

  const handleOpenNotesModal = (visitNote) => {
    setActiveVisitNote(visitNote);
    setNotesModalOpen(true);
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

  useEffect(() => {
    if (view === 'APPOINTMENTS') {
      fetchAppointments();
    }
  }, [view]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
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
                <h3 style={{ color: 'var(--success-text)', margin: '0 0 8px 0' }}>
                  Google Calendar Connected
                </h3>
                <p style={{ margin: 0, color: 'var(--success-text)', opacity: 0.9 }}>Your appointments can now be synchronized with your Google Calendar.</p>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--danger-text)', margin: '0 0 8px 0' }}>
                  Google Calendar Not Connected
                </h3>
                <p style={{ margin: 0, color: 'var(--danger-text)', opacity: 0.9 }}>Connect your Google Calendar to receive reminders about your appointments.</p>
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
      
      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <Button 
          variant={view === 'APPOINTMENTS' ? 'primary' : 'ghost'} 
          onClick={() => setView('APPOINTMENTS')}
        >
          My Appointments
        </Button>
        <Button 
          variant={view === 'SEARCH' || view === 'BOOKING' ? 'primary' : 'ghost'} 
          onClick={() => { setView('SEARCH'); setSelectedDoctor(null); }}
        >
          Book New Appointment
        </Button>
      </div>

      {view === 'SEARCH' && (
        <Card>
          <h3 style={{ marginBottom: '24px' }}>Search Doctors</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div style={{ flex: 1 }}>
              <Input 
                label="Specialisation" 
                placeholder="e.g., Cardiology" 
                value={specialisation} 
                onChange={e => setSpecialisation(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div>
            {doctors.map(doc => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0' }}>Dr. {doc.name}</h4>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{doc.doctorProfile?.specialisation || 'General'}</span>
                </div>
                <Button onClick={() => handleSelectDoctor(doc)} variant="secondary">View Slots</Button>
              </div>
            ))}
            {doctors.length === 0 && (
              <EmptyState 
                title="Find a Doctor" 
                description="Search by specialisation to see available doctors and book an appointment." 
              />
            )}
          </div>
        </Card>
      )}

      {view === 'BOOKING' && selectedDoctor && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0' }}>Book Appointment</h3>
              <p style={{ margin: 0 }}>Dr. {selectedDoctor.name} &bull; {selectedDoctor.doctorProfile?.specialisation || 'General'}</p>
            </div>
            <Button variant="ghost" onClick={() => setView('SEARCH')}>&larr; Back to Search</Button>
          </div>
          
          <div style={{ marginBottom: '24px', maxWidth: '300px' }}>
            <Input 
              label="Select Date"
              type="date" 
              value={dateStr} 
              onChange={handleDateChange}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {dateStr && (
            <div>
              <h4 style={{ marginBottom: '16px', fontWeight: 500 }}>Available Slots for {new Date(dateStr).toLocaleDateString('en-GB')}</h4>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {slots.length > 0 ? slots.map(slot => (
                  <Button 
                    key={slot}
                    onClick={() => initiateBooking(slot)}
                    variant="secondary"
                    style={{ background: 'var(--info-bg)', borderColor: 'var(--info)', color: 'var(--info-text)' }}
                  >
                    {slot}
                  </Button>
                )) : (
                  <p style={{ fontSize: '0.875rem' }}>No slots available on this date. Please try another date.</p>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {view === 'APPOINTMENTS' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>My Appointments</h3>
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
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Doctor</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pre-Visit</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(app => {
                    const d = new Date(app.slotStart);
                    return (
                      <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 500 }}>{d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                            {d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {app.rescheduledByDoctor && (
                            <div style={{ marginTop: '4px' }}><Badge status="WARNING">Rescheduled</Badge></div>
                          )}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 500 }}>Dr. {app.doctor.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{app.doctor.doctorProfile?.specialisation}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Badge status={app.status} />
                        </td>
                        <td style={{ padding: '16px' }}>
                          {app.symptomForm ? (
                            <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>✓ Submitted</span>
                          ) : (
                            app.status === 'SCHEDULED' && (
                              <Button variant="ghost" onClick={() => handleOpenSymptomModal(app.id)} style={{ color: 'var(--warning)', padding: '4px 8px' }}>
                                + Add Symptoms
                              </Button>
                            )
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {app.visitNote && (
                              <Button variant="secondary" onClick={() => handleOpenNotesModal(app.visitNote)}>
                                View Notes
                              </Button>
                            )}
                            {app.status === 'SCHEDULED' && (
                              <Button variant="danger" onClick={() => initiateCancel(app.id)}>
                                Cancel
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState 
              title="No upcoming appointments" 
              description="You don't have any appointments scheduled yet." 
              action={<Button onClick={() => { setView('SEARCH'); setSelectedDoctor(null); }}>Book Appointment</Button>}
            />
          )}
        </Card>
      )}

      {/* Modals */}
      <Modal
        isOpen={confirmBookModal.isOpen}
        onClose={() => setConfirmBookModal({ isOpen: false, slotTime: null })}
        title="Confirm Appointment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmBookModal({ isOpen: false, slotTime: null })}>Cancel</Button>
            <Button variant="primary" onClick={executeBook}>Confirm Booking</Button>
          </>
        }
      >
        <p>Are you sure you want to book an appointment with <strong>Dr. {selectedDoctor?.name}</strong> on <strong>{dateStr}</strong> at <strong>{confirmBookModal.slotTime}</strong>?</p>
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
        isOpen={symptomModalOpen}
        onClose={() => setSymptomModalOpen(false)}
        title="Submit Symptoms"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSymptomModalOpen(false)} disabled={isSubmittingSymptoms}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmitSymptoms} isLoading={isSubmittingSymptoms}>Submit to AI</Button>
          </>
        }
      >
        <p style={{ marginBottom: '16px', fontSize: '0.875rem' }}>Please describe your symptoms. Our AI will summarize this for the doctor.</p>
        <textarea
          value={symptomsText}
          onChange={(e) => setSymptomsText(e.target.value)}
          placeholder="E.g., I have had a severe headache for 3 days..."
          style={{ width: '100%', minHeight: '120px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', fontFamily: 'inherit', resize: 'vertical' }}
          disabled={isSubmittingSymptoms}
        />
      </Modal>

      <Modal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        title="Post-Visit Summary"
        footer={<Button onClick={() => setNotesModalOpen(false)}>Close</Button>}
        maxWidth="600px"
      >
        {activeVisitNote?.llmStatus === 'FAILED' ? (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '16px', borderRadius: 'var(--border-radius)', marginBottom: '16px' }}>
            <p style={{ color: 'var(--danger-text)', fontWeight: 600, margin: '0 0 8px 0' }}>AI Summary Unavailable</p>
            <p style={{ color: 'var(--danger-text)', margin: 0, fontSize: '0.875rem' }}>The doctor submitted notes, but the AI summary generation failed. Please consult the clinic if you have questions.</p>
          </div>
        ) : activeVisitNote?.llmStatus === 'PENDING' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-text)', padding: '16px', background: 'var(--warning-bg)', borderRadius: 'var(--border-radius)' }}>
            <Spinner size="16px" color="var(--warning-text)" /> AI Summary is still generating...
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--border-radius)' }}>
            {activeVisitNote?.aiPatientSummary}
          </div>
        )}
      </Modal>
    </div>
  );
}
