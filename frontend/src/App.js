import React, { useState, useEffect } from 'react';
import './App.css';

// Your Node.js server address
const API_URL = 'http://13.203.214.25:3000/'; 

// --- Component 1: The Main App ---

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for the top "Confirm Payment" card
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Tracks who is present. e.g., { "Vasu": true, "Naman": false }
  const [attendance, setAttendance] = useState({});

  // --- NEW: Tracks who is PAYING. e.g. { "Tapish": true, "Shashank": true } ---
  const [selectedPayers, setSelectedPayers] = useState({});

  const [isNotifying, setIsNotifying] = useState(false);

  // State for inline editing
  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', count: '', attendanceCount: '' });

  // 1. Fetch the initial payer list
  useEffect(() => {
    fetch(`${API_URL}/api/turn`)
      .then(res => res.json())
      .then(data => {
        setPayers(data);
        initializeSelections(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch payers:", err);
        setLoading(false);
      });
  }, []);

  // Helper to reset selections (called on load and after payment)
  const initializeSelections = (data) => {
    // 1. Default Attendance: Everyone is present
    const initialAttendance = {};
    data.forEach(p => {
      initialAttendance[p.name] = true;
    });
    setAttendance(initialAttendance);

    // 2. Default Payers: Top 2 in the list
    const initialPayers = {};
    if (data.length > 0) initialPayers[data[0].name] = true;
    if (data.length > 1) initialPayers[data[1].name] = true;
    setSelectedPayers(initialPayers);
  };

  const handleAttendanceToggle = (name) => {
    setAttendance(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // --- NEW: Handler for toggling Payer checkboxes ---
  const handlePayerToggle = (name) => {
    setSelectedPayers(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // --- LOGIC FOR TOP PAYMENT CARD (UPDATED) ---
  const handlePayment = async () => {
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid, positive amount.');
      return;
    }

    // 1. Get Attendees
    const attendees = Object.keys(attendance).filter(name => attendance[name]);
    if (attendees.length === 0) {
      alert('Please select at least one person as present.');
      return;
    }

    // 2. Get Payers
    const customPayers = Object.keys(selectedPayers).filter(name => selectedPayers[name]);

    // 3. Validation: Exactly 2 payers must be selected
    if (customPayers.length !== 2) {
      alert(`You must select exactly 2 payers. You have selected ${customPayers.length}.`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- UPDATED: Send amount, attendees, AND customPayers ---
        body: JSON.stringify({ 
          amount: amountNum, 
          attendees: attendees,
          customPayers: customPayers 
        })
      });
      if (!response.ok) throw new Error('Failed to confirm payment.');
      
      const updatedPayers = await response.json();
      setPayers(updatedPayers);
      
      // Reset form
      setPaymentAmount('');
      // Re-initialize defaults (Top 2 of the NEW list will be auto-selected)
      initializeSelections(updatedPayers);

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

  // --- LOGIC FOR INLINE EDITING (Unchanged logic) ---
  const handleEditClick = (payer) => {
    setEditingName(payer.name);
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
    const newAttendanceCount = Number(editForm.attendanceCount);

    if (newAmount < 0 || newCount < 0 || newAttendanceCount < 0 || 
        !Number.isInteger(newCount) || !Number.isInteger(newAttendanceCount)) {
      alert('Please enter valid numbers.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      // Re-initialize to ensure checkboxes match new order
      initializeSelections(updatedPayers);
      
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

      {/* --- "Confirm Payment" Card --- */}
      <div className="card">
        <h2>Confirm Session & Payment</h2>
        
        <div className="payment-card-content">
          
          {/* Left Side: Payment Controls */}
          <div className="payment-controls">
            <p>1. Enter Amount.<br/>2. Verify <strong>Payers</strong> (Right col).<br/>3. Verify <strong>Attendance</strong> (Left col).</p>
            
            <input
              type="number"
              className="amount-input"
              placeholder="Total Amount (e.g. 150)"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={loading || isNotifying}
            />
            
            <button
              onClick={handlePayment}
              disabled={loading || isNotifying || payers.length < 2 || !paymentAmount}
              className="pay-button"
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

          {/* Right Side: Attendance & Payer List (UPDATED) */}
          <div className="attendance-list">
            <div className="attendance-header">
              <span>Name</span>
              <span>Present?</span>
              <span>Paying?</span>
            </div>
            <div className="attendance-items">
              {payers.map(p => (
                <div key={p.name} className={`attendance-item ${selectedPayers[p.name] ? 'is-paying-row' : ''}`}>
                  
                  {/* Name */}
                  <span className="att-name">{p.name}</span>

                  {/* Attendance Checkbox */}
                  <input
                    type="checkbox"
                    checked={attendance[p.name] || false} 
                    onChange={() => handleAttendanceToggle(p.name)}
                    disabled={loading || isNotifying}
                    title="Is Present"
                  />

                  {/* Paying Checkbox (NEW) */}
                  <input
                    type="checkbox"
                    checked={selectedPayers[p.name] || false}
                    onChange={() => handlePayerToggle(p.name)}
                    disabled={loading || isNotifying}
                    className="paying-checkbox"
                    title="Is Paying"
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* --- Full Queue Display --- */}
      <div className="upcoming-list">
        <h3>Payer Stats (Sorted by Ratio)</h3>
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
      </div>
    </div>
  );
}

// --- Component 2: The List Item (Same as before) ---

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

// --- Component 3: The Edit Form (Same as before) ---

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
          Count (Paid):
          <input
            type="number"
            name="count"
            value={editForm.count}
            onChange={onFormChange}
            disabled={loading}
          />
        </label>
        <label>
          Attendance:
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