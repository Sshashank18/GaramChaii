import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://29a2c4aefbea.ngrok-free.app'; 

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [attendance, setAttendance] = useState({});
  const [selectedPayers, setSelectedPayers] = useState({});
  const [newPayerName, setNewPayerName] = useState('');

  // Editing state
  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState({ amount: 0, count: 0, attendanceCount: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/turn`)
      .then(res => res.json())
      .then(data => {
        setPayers(data);
        initializeSelections(data);
        setLoading(false);
      });
  }, []);

  const initializeSelections = (data) => {
    const initialAtt = {};
    data.forEach(p => initialAtt[p.name] = true);
    setAttendance(initialAtt);

    const initialPay = {};
    if (data.length > 0) initialPay[data[0].name] = true;
    if (data.length > 1) initialPay[data[1].name] = true;
    setSelectedPayers(initialPay);
  };

  // --- EDIT LOGIC ---
  const handleEditClick = (p) => {
    setEditingName(p.name);
    setEditForm({ 
      amount: p.amount, 
      count: p.count, 
      attendanceCount: p.attendanceCount 
    });
  };

  const handleSaveEdit = async (name) => {
    // Get list of names currently checked in the attendance column
    const currentAttendees = Object.keys(attendance).filter(n => attendance[n]);

    setLoading(true);
    try {
        const res = await fetch(`${API_URL}/api/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                ...editForm,
                attendees: currentAttendees,
                updateOthers: true // This tells the server to +1 to everyone checked
            })
        });
        
        if (!res.ok) throw new Error("Update failed");
        
        const data = await res.json();
        setPayers(data);
        setEditingName(null);
        alert("Payer updated and attendance incremented for selected team members!");
    } catch (err) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
};

  const handleAddPayer = async () => {
    if (!newPayerName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/payers/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPayerName })
      });
      const data = await res.json();
      if (res.ok) {
        setPayers(data);
        setNewPayerName('');
      } else alert(data.error);
    } finally { setLoading(false); }
  };

  const handleRemovePayer = async (name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    setLoading(true);
    const res = await fetch(`${API_URL}/api/payers/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    setPayers(data);
    setLoading(false);
  };

  const handlePayment = async () => {
    const attendees = Object.keys(attendance).filter(n => attendance[n]);
    const customPayers = Object.keys(selectedPayers).filter(n => selectedPayers[n]);

    if (!paymentAmount || Number(paymentAmount) <= 0) return alert("Enter a valid amount");
    if (customPayers.length !== 2) return alert("Select exactly 2 payers");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(paymentAmount), attendees, customPayers })
      });
      const data = await res.json();
      setPayers(data);
      setPaymentAmount('');
      initializeSelections(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="main-header">
        <h1>☕ Chaii Ledger</h1>
        <p>Track attendance and automate the tea rotation.</p>
      </header>

      {/* --- SESSION CARD --- */}
      <div className="card session-card">
        <div className="card-header">
          <h2><span className="icon">📝</span> Confirm Today's Session</h2>
        </div>
        
        <div className="payment-grid">
          <div className="input-section">
            <label>Total Bill Amount</label>
            <div className="amount-input-wrapper">
              <span className="currency-label">₹</span>
              <input 
                type="number" 
                placeholder="0.00" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
              />
            </div>
            <button onClick={handlePayment} className="pay-button" disabled={loading || !paymentAmount}>
              {loading ? "Processing..." : "Confirm & Update Stats"}
            </button>
            <p className="helper-text">Splits ₹{(Number(paymentAmount)/2).toFixed(2)} to 2 selected payers.</p>
          </div>

          <div className="selection-section">
            <div className="table-header">
              <span className="col-name">Name</span>
              <span className="col-check">Present</span>
              <span className="col-check">Paying</span>
            </div>
            <div className="table-body">
              {payers.map(p => (
                <div key={p.name} className={`table-row ${selectedPayers[p.name] ? 'active-payer' : ''}`}>
                  <span className="name-cell">{p.name}</span>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={attendance[p.name] || false} 
                      onChange={() => setAttendance({...attendance, [p.name]: !attendance[p.name]})} 
                    />
                    <span className="checkmark"></span>
                  </label>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={selectedPayers[p.name] || false} 
                      onChange={() => setSelectedPayers({...selectedPayers, [p.name]: !selectedPayers[p.name]})} 
                    />
                    <span className="checkmark payer-check"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MANAGEMENT CARD --- */}
      <div className="card manage-card">
        <h2><span className="icon">👥</span> Team Management</h2>
        <div className="add-payer-row">
          <input 
            value={newPayerName} 
            onChange={e => setNewPayerName(e.target.value)} 
            placeholder="Add new teammate name..." 
          />
          <button onClick={handleAddPayer} className="add-btn">Add +</button>
        </div>
      </div>

      {/* --- STATS LIST --- */}
      <div className="stats-container">
        <h3><span className="icon">📊</span> Payer Rankings</h3>
        <div className="stats-list">
          {payers.map((p, i) => {
            const isEditing = editingName === p.name;
            return (
              <div key={p.name} className={`stats-item ${i < 2 ? 'next-up' : ''} ${isEditing ? 'editing-item' : ''}`}>
                <div className="rank">#{i + 1}</div>
                
                {isEditing ? (
                  <div className="edit-grid">
                    <div className="edit-field">
                      <label>Total ₹</label>
                      <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} />
                    </div>
                    <div className="edit-field">
                      <label>Paid (x)</label>
                      <input type="number" value={editForm.count} onChange={e => setEditForm({...editForm, count: Number(e.target.value)})} />
                    </div>
                    <div className="edit-field">
                      <label>Attended (x)</label>
                      <input type="number" value={editForm.attendanceCount} onChange={e => setEditForm({...editForm, attendanceCount: Number(e.target.value)})} />
                    </div>
                    <div className="edit-actions">
                      <button className="save-btn" onClick={() => handleSaveEdit(p.name)}>Save</button>
                      <button className="cancel-btn" onClick={() => setEditingName(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-details">
                      <span className="p-name">{p.name} {i < 2 && <span className="badge">Next Turn</span>}</span>
                      <span className="p-sub">Ratio: <strong>{p.ratio.toFixed(2)}</strong> | Paid: {p.count}x | Total: ₹{p.amount} | Attended: {p.attendanceCount}x</span>
                    </div>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => handleEditClick(p)}>✏️</button>
                      <button className="btn-icon delete" onClick={() => handleRemovePayer(p.name)}>🗑️</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;