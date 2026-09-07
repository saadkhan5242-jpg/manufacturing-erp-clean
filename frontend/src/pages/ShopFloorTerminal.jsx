import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient.js';

function ShopFloorTerminal() {
  const [employeeId, setEmployeeId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [activeLog, setActiveLog] = useState(null);
  const [parts, setParts] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeField, setActiveField] = useState('employeeId'); // For dynamic keypad focus

  // MODULE 6: Supervisor PIN-pad authorization overlay state
  const [pinOverlay, setPinOverlay] = useState(null); // { message, reason, retry }
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);

  const requestSupervisorOverride = (guardData, retry) => {
    setPinInput('');
    setPinError('');
    setPinOverlay({
      message: guardData.error,
      reason: guardData.reason,
      variancePercent: guardData.variancePercent,
      retry
    });
  };

  const handlePinPad = (val) => {
    setPinError('');
    if (val === 'CLEAR') { setPinInput(''); return; }
    if (val === 'ENTER') { submitSupervisorPin(); return; }
    if (val === 'CANCEL') { setPinOverlay(null); setPinInput(''); return; }
    setPinInput((prev) => (prev.length < 4 ? prev + val : prev));
  };

  const submitSupervisorPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError('Passkey must be exactly 4 digits.');
      return;
    }
    setPinVerifying(true);
    try {
      const data = await apiClient.post('/api/shopfloor/verify-pin', { pin: pinInput });
      if (!data.verified) throw new Error('Passkey rejected by quality control.');

      const { retry } = pinOverlay;
      const verifiedPin = pinInput;
      setPinOverlay(null);
      setPinInput('');
      await retry(verifiedPin); // Re-dispatch the locked write with the supervisor credential
    } catch (err) {
      setPinError(err.message);
      setPinInput('');
    } finally {
      setPinVerifying(false);
    }
  };

  useEffect(() => {
    let interval = null;
    if (activeLog) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeLog]);

  const formatTime = (totalSeconds) => {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const handleKeypadPress = (val) => {
    if (activeLog && activeField !== 'parts') return;
    
    let currentStr = '';
    if (activeField === 'employeeId') currentStr = employeeId;
    if (activeField === 'workOrderId') currentStr = workOrderId;
    if (activeField === 'operationId') currentStr = operationId;
    if (activeField === 'parts') currentStr = String(parts);

    if (val === 'CLEAR') {
      currentStr = '';
    } else {
      currentStr += val;
    }

    if (activeField === 'employeeId') setEmployeeId(currentStr);
    if (activeField === 'workOrderId') setWorkOrderId(currentStr);
    if (activeField === 'operationId') setOperationId(currentStr);
    if (activeField === 'parts') setParts(Number(currentStr) || 0);
  };

  const handleClockIn = async (status, supervisorPin = null) => {
    if (!employeeId || !workOrderId || !operationId) {
      setMessage({ text: 'GSS Validation Error: Employee ID, Work Order, and Operation ID are required.', type: 'error' });
      return;
    }
    setMessage({ text: '', type: '' });
    try {
      const data = await apiClient.post('/api/shopfloor/clock-in', {
          employeeId,
          workOrderId: Number(workOrderId),
          routerOperationId: Number(operationId),
          jobStatus: status
        }, { headers: supervisorPin ? { 'x-supervisor-pin': supervisorPin } : {} });

      // MODULE 6: sequence-skip lock -> demand supervisor PIN before commit
      setActiveLog(data.logId);
      setActiveField('parts'); // Focus keypad to counts
      setMessage({ text: `GSS Alert: Employee ${employeeId} successfully clocked into ${status} status!`, type: 'success' });
    } catch (err) {
      if (err.status === 403 && err.details?.supervisorRequired) {
        requestSupervisorOverride(err.details, (pin) => handleClockIn(status, pin));
        return;
      }
      setMessage({ text: `GSS Guard Rejection: ${err.message}`, type: 'error' });
    }
  };

  const handleClockOut = async (supervisorPin = null) => {
    setMessage({ text: '', type: '' });
    try {
      await apiClient.post('/api/shopfloor/clock-out', { logId: activeLog, partsProduced: Number(parts), finalStatus: 'COMPLETED' }, { headers: supervisorPin ? { 'x-supervisor-pin': supervisorPin } : {} });

      // MODULE 6: major labor variance lock -> demand supervisor PIN before commit
      setActiveLog(null);
      setParts(0);
      setElapsedSeconds(0);
      setActiveField('employeeId');
      setMessage({ text: `GSS Summary: Job Dispatched. Actual runtime logged and variance ledger synchronized!`, type: 'success' });
    } catch (err) {
      if (err.status === 403 && err.details?.supervisorRequired) {
        requestSupervisorOverride(err.details, (pin) => handleClockOut(pin));
        return;
      }
      setMessage({ text: `GSS Dispatch Rejection: ${err.message}`, type: 'error' });
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'monospace', color: '#cbd5e0', backgroundColor: '#121824', minHeight: '85vh', borderRadius: '12px' }}>
      <header style={{ borderBottom: '2px solid #2f855a', paddingBottom: '12px', marginBottom: '24px' }}>
        <h2 style={{ color: '#48bb78', margin: 0, fontSize: '24px' }}>🖥️ GSS Shop Floor Data Collection (SFDC) Terminal</h2>
        <p style={{ color: '#a0aec0', margin: '4px 0 0 0', fontSize: '13px' }}>Live Touch-Screen Labor Tracking & Operational Variance Analyzer</p>
      </header>

      {message.text && (
        <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold', color: '#fff', backgroundColor: message.type === 'success' ? '#2f855a' : '#9b2c2c' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* Left Side: Entry Input Form */}
        <div style={{ backgroundColor: '#1a202c', padding: '24px', borderRadius: '8px', border: '1px solid #2d3748' }}>
          {!activeLog ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div onClick={() => setActiveField('employeeId')} style={{ padding: '12px', borderRadius: '6px', backgroundColor: activeField === 'employeeId' ? '#2a4365' : '#2d3748', border: activeField === 'employeeId' ? '2px solid #3182ce' : '1px solid #4a5568', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: '#a0aec0', display: 'block' }}>EMPLOYEE BADGE ID</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{employeeId || '----'}</span>
              </div>
              <div onClick={() => setActiveField('workOrderId')} style={{ padding: '12px', borderRadius: '6px', backgroundColor: activeField === 'workOrderId' ? '#2a4365' : '#2d3748', border: activeField === 'workOrderId' ? '2px solid #3182ce' : '1px solid #4a5568', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: '#a0aec0', display: 'block' }}>TARGET WORK ORDER ID</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{workOrderId || '----'}</span>
              </div>
              <div onClick={() => setActiveField('operationId')} style={{ padding: '12px', borderRadius: '6px', backgroundColor: activeField === 'operationId' ? '#2a4365' : '#2d3748', border: activeField === 'operationId' ? '2px solid #3182ce' : '1px solid #4a5568', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: '#a0aec0', display: 'block' }}>ROUTER OPERATION STEP SEQUENCE ID</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{operationId || '----'}</span>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <button type="button" onClick={() => handleClockIn('SETUP')} style={{ flex: 1, padding: '16px', backgroundColor: '#d69e2e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>🟡 START SETUP</button>
                <button type="button" onClick={() => handleClockIn('RUNNING')} style={{ flex: 1, padding: '16px', backgroundColor: '#2f855a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>🟢 START PRODUCTION RUN</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ backgroundColor: '#2d3748', padding: '20px', borderRadius: '6px', borderLeft: '6px solid #d69e2e', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#d69e2e' }}>⚠️ GSS Tracker Recording Labor Live</h3>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>WO Reference: {workOrderId} | Seq Operation: {operationId}</p>
                <div style={{ fontSize: '40px', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff', margin: '10px 0' }}>{formatTime(elapsedSeconds)}</div>
              </div>

              <div onClick={() => setActiveField('parts')} style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#2d3748', border: '2px solid #38a169', textAlign: 'left', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: '#a0aec0', display: 'block' }}>GOOD PIECES PRODUCED COUNT</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{parts}</span>
              </div>

              <button type="button" onClick={() => handleClockOut()} style={{ width: '100%', padding: '16px', backgroundColor: '#9b2c2c', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>🛑 DISPATCH & POST TO LEDGER</button>
            </div>
          )}
        </div>

        {/* Right Side: GSS Touchscreen Numeric Keypad Frame */}
        <div style={{ backgroundColor: '#1a202c', padding: '20px', borderRadius: '8px', border: '1px solid #2d3748', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
            <button key={num} type="button" onClick={() => handleKeypadPress(String(num))} style={{ padding: '20px', backgroundColor: '#2d3748', color: '#fff', border: '1px solid #4a5568', borderRadius: '6px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}>{num}</button>
          ))}
          <button type="button" onClick={() => handleKeypadPress('CLEAR')} style={{ gridColumn: 'span 2', padding: '20px', backgroundColor: '#4a5568', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>CLEAR ENTRY</button>
        </div>
      </div>

      {/* MODULE 6: Full-screen Supervisor PIN-pad Authorization Overlay */}
      {pinOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(6,10,18,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '380px', backgroundColor: '#1a202c', borderRadius: '12px', border: '2px solid #d69e2e', padding: '28px', boxShadow: '0 0 60px rgba(214,158,46,0.35)' }}>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '34px' }}>🔐</div>
              <h3 style={{ margin: '8px 0 4px', color: '#d69e2e' }}>SUPERVISOR OVERRIDE REQUIRED</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#a0aec0' }}>
                {pinOverlay.reason === 'SEQUENCE_SKIP' ? 'Sequence sorting bypass intercepted by quality control.' : 'Major labor hour variance intercepted by quality control.'}
                {pinOverlay.variancePercent ? ` Variance: ${pinOverlay.variancePercent}%` : ''}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#718096' }}>{pinOverlay.message}</p>
            </div>

            <div style={{ backgroundColor: '#0d131f', borderRadius: '8px', border: '1px solid #4a5568', padding: '14px', textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: '#718096', display: 'block', marginBottom: '6px' }}>QUALITY MANAGER MASTER PASSKEY</span>
              <span style={{ fontSize: '28px', letterSpacing: '14px', fontFamily: 'monospace', color: '#fff' }}>
                {'●'.repeat(pinInput.length)}{'○'.repeat(4 - pinInput.length)}
              </span>
            </div>

            {pinError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', fontWeight: 'bold', color: '#fff', backgroundColor: '#9b2c2c', textAlign: 'center' }}>
                {pinError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button key={num} type="button" disabled={pinVerifying} onClick={() => handlePinPad(String(num))} style={{ padding: '16px', backgroundColor: '#2d3748', color: '#fff', border: '1px solid #4a5568', borderRadius: '6px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>{num}</button>
              ))}
              <button type="button" disabled={pinVerifying} onClick={() => handlePinPad('CANCEL')} style={{ padding: '16px', backgroundColor: '#742a2a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
              <button type="button" disabled={pinVerifying} onClick={() => handlePinPad('0')} style={{ padding: '16px', backgroundColor: '#2d3748', color: '#fff', border: '1px solid #4a5568', borderRadius: '6px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>0</button>
              <button type="button" disabled={pinVerifying} onClick={() => handlePinPad('ENTER')} style={{ padding: '16px', backgroundColor: '#2f855a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>{pinVerifying ? '…' : 'ENTER'}</button>
              <button type="button" disabled={pinVerifying} onClick={() => handlePinPad('CLEAR')} style={{ gridColumn: 'span 3', padding: '12px', backgroundColor: '#4a5568', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>CLEAR PASSKEY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopFloorTerminal;
