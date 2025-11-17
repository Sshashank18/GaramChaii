import React, { useState, useEffect } from 'react';
import './App.css';

// Your Node.js server address
const API_URL = 'https://garam-chaii.fly.dev'; // Make sure this is your correct Fly.io URL

// --- Component 1: The Main App ---

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true); // Single loading state

  // State for the top "Confirm Payment" card
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // --- NEW: State for the attendance checkboxes ---
  // Tracks who is present. e.g., { "Vasu": true, "Naman": false }
  const [attendance, setAttendance] = useState({});

  // State for the notify button
  const [isNotifying, setIsNotifying] = useState(false);

  // State for inline editing
  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', count: '', attendanceCount: '' }); // Added attendanceCount

  // 1. Fetch the initial payer list
  useEffect(() => {
    fetch(`${API_URL}/api/turn`)
      .then(res => res.json())
      .then(data => {
        setPayers(data);

        // --- NEW: Initialize attendance state ---
        // Default everyone to 'present' (checked) for convenience
        const initialAttendance = {};
        data.forEach(p => {
          initialAttendance[p.name] = true;
        });
        setAttendance(initialAttendance);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch payers:", err);
        setLoading(false);
      });
  }, []);

  // --- NEW: Handler for toggling attendance checkboxes ---
  const handleAttendanceToggle = (name) => {
    setAttendance(prev => ({
      ...prev,
      [name]: !prev[name] // Flip the boolean value
    }));
  };

  // --- LOGIC FOR TOP PAYMENT CARD (UPDATED) ---
  const handlePayment = async () => {
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid, positive amount.');
      return;
    }

    // --- NEW: Get the list of attendee names from state ---
    const attendees = Object.keys(attendance).filter(name => attendance[name]);

    if (attendees.length === 0) {
      alert('Please select at least one person as present.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- UPDATED: Send 'amount' and 'attendees' ---
        body: JSON.stringify({ amount: amountNum, attendees: attendees })
      });
      if (!response.ok) throw new Error('Failed to confirm payment.');
      
      const updatedPayers = await response.json();
      setPayers(updatedPayers);
      setPaymentAmount(''); // Clear the input

    } catch (err) {
      console.error("Failed to confirm payment:", err);
      alert("Error: Could not confirm payment.");
    } finally {
      setLoading(false);
    }
  };

  // --- Logic for the "Notify Next Turn" button (Unchanged) ---
  const handleNotify = async () => {
    setIsNotifying(true);
    try {
      const response = await fetch(`${API_URL}/api/notify`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send notification.');
    } catch (err) {
      console.error("Failed to send notification:", err);
      alert("Error: Could not send notification.");
    } finally {
      setIsNotifying(false);
    }
  };

  // --- LOGIC FOR INLINE EDITING (UPDATED) ---

  const handleEditClick = (payer) => {
    setEditingName(payer.name);
    // --- UPDATED: Include attendanceCount in edit form ---
    setEditForm({ 
      amount: payer.amount, 
      count: payer.count, 
      attendanceCount: payer.attendanceCount 
    });
  };

  const handleCancelClick = () => {
    setEditingName(null);
    setEditForm({ amount: '', count: '', attendanceCount: '' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleSaveClick = async (name) => {
    const newAmount = Number(editForm.amount);
    const newCount = Number(editForm.count);
    // --- NEW: Get attendanceCount from form ---
    const newAttendanceCount = Number(editForm.attendanceCount);

    // --- UPDATED: Validation ---
    if (newAmount < 0 || newCount < 0 || newAttendanceCount < 0 || 
        !Number.isInteger(newCount) || !Number.isInteger(newAttendanceCount)) {
      alert('Please enter valid, non-negative numbers. Counts must be whole numbers.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- UPDATED: Send all three fields ---
        body: JSON.stringify({ 
          name, 
          amount: newAmount, 
          count: newCount, 
          attendanceCount: newAttendanceCount 
        })
      });
      if (!response.ok) throw new Error('Failed to save update.');

      const updatedPayers = await response.json();
      setPayers(updatedPayers);
      setEditingName(null);
      
    } catch (err) {
      console.error("Failed to update payer:", err);
      alert("Error: Could not save changes.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container">
      <header>
        <h1>☕ Chaii Payment Ledger</h1>
      </header>

      {/* --- "Confirm Payment" Card (UPDATED LAYOUT) --- */}
      <div className="card">
        <h2>Confirm Session & Payment</h2>
        
        <div className="payment-card-content">
          
          {/* Left Side: Payment */}
          <div className="payment-controls">
            <p>This will update stats for the **Top 2** and record attendance for **all checked** people below.</p>
            
            <input
              type="number"
              className="amount-input"
              placeholder="Enter total amount (e.g., 150)"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={loading || isNotifying}
            />
            
            <button
              onClick={handlePayment}
              disabled={loading || isNotifying || payers.length < 2 || !paymentAmount || Number(paymentAmount) <= 0}
            >
              {loading ? "Updating..." : "Confirm Payment"}
            </button>

            <button
              onClick={handleNotify}
              className="notify-button"
              disabled={loading || isNotifying || payers.length < 2}
            >
              {isNotifying ? "Notifying..." : "Notify Next Turn 🔔"}
            </button>
          </div>

          {/* Right Side: Attendance List */}
          <div className="attendance-list">
            <h3>Who is present?</h3>
            <div className="attendance-items">
              {payers.map(p => (
                <div key={p.name} className="attendance-item">
                  <input
                    type="checkbox"
                    id={`att-${p.name}`}
                    // Use the 'attendance' state to control checked status
                    checked={attendance[p.name] || false} 
                    onChange={() => handleAttendanceToggle(p.name)}
                    disabled={loading || isNotifying}
                  />
                  <label htmlFor={`att-${p.name}`}>{p.name}</label>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* --- Full Queue Display --- */}
      <div className="upcoming-list">
        <h3>Payer Stats (Sorted by ratio: Amount / Attendance)</h3>
        <ol>
          {payers.map((payer, index) => {
            const isEditing = editingName === payer.name;
            
            return (
              <PayerListItem
                key={payer.name}
                payer={payer}
                index={index}
                isEditing={isEditing}
                loading={loading || isNotifying}
                editForm={editForm}
              onEditClick={handleEditClick}
                onCancelClick={handleCancelClick}
                onFormChange={handleFormChange}
                onSaveClick={handleSaveClick}
             />
            );
          })}
        </ol>
        {loading && payers.length === 0 && <p>Loading list...</p>}
        {!loading && payers.length === 0 && <p>No payers found. Check server.</p>}
      </div>
    </div>
  );
}

// --- Component 2: The List Item (UPDATED) ---

function PayerListItem({
  payer,
  index,
  isEditing,
  loading,
  editForm,
  onEditClick,
  onCancelClick,
  onFormChange,
  onSaveClick
}) {
  return (
    <li
      className={`${isEditing ? 'editing-row' : ''} ${
        index === 0 || index === 1 ? 'is-next-to-pay' : ''
      }`}
    >
      {isEditing ? (
        <PayerEditForm
          payer={payer}
          editForm={editForm}
          loading={loading}
          onFormChange={onFormChange}
          onSaveClick={onSaveClick}
          onCancelClick={onCancelClick}
        />
      ) : (
        <>
          <div className="payer-info">
            <span>
              <strong>{index + 1}. {payer.name}</strong>
            </span>
            {/* --- UPDATED: Added attendanceCount --- */}
            <span className="stats">
              (Paid: {payer.count}x | Attended: {payer.attendanceCount}x | Total: ₹{payer.amount.toFixed(0)} | Ratio: {payer.ratio.toFixed(2)})
            </span>
          </div>
          <button onClick={() => onEditClick(payer)} disabled={loading}>
            Edit
          </button>
        </>
      )}
    </li>
  );
}

// --- Component 3: The Edit Form (UPDATED) ---

function PayerEditForm({
  payer,
  editForm,
  loading,
  onFormChange,
  onSaveClick,
  onCancelClick
}) {
  return (
    <form className="edit-form" onSubmit={(e) => { e.preventDefault(); onSaveClick(payer.name); }}>
      <strong>{payer.name}</strong>
      <div className="edit-inputs">
        <label>
           Total Amount:
          <input
            type="number"
            name="amount"
            value={editForm.amount}
            onChange={onFormChange}
            disabled={loading}
          />
        </label>
        <label>
          Total Count (Paid):
          <input
            type="number"
            name="count"
            value={editForm.count}
            onChange={onFormChange}
            disabled={loading}
          />
        </label>
        {/* --- NEW: Input for attendanceCount --- */}
        <label>
          Total Attendance:
          <input
            type="number"
            name="attendanceCount"
            value={editForm.attendanceCount}
            onChange={onFormChange}
            disabled={loading}
         />
        </label>
      </div>
      <div className="edit-buttons">
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancelClick} disabled={loading}>
         Cancel
        </button>
      </div>
    </form>
  );
}

export default App;