import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://25b35583a421.ngrok-free.app'; 

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [attendance, setAttendance] = useState({});
  const [selectedPayers, setSelectedPayers] = useState({});
  const [isNotifying, setIsNotifying] = useState(false);
  const [newPayerName, setNewPayerName] = useState('');

  // Editing state
  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', count: '', attendanceCount: '' });

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

    if (customPayers.length !== 2) return alert("Select exactly 2 payers");

    setLoading(true);
    const res = await fetch(`${API_URL}/api/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(paymentAmount), attendees, customPayers })
    });
    const data = await res.json();
    setPayers(data);
    setPaymentAmount('');
    initializeSelections(data);
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>☕ Chaii Payment Ledger</h1>

      <div className="card">
        <h2>Confirm Session</h2>
        <div className="payment-card-content">
          <div className="payment-controls">
            <input type="number" placeholder="Amount" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
            <button onClick={handlePayment} className="pay-button" disabled={loading}>Confirm Payment</button>
          </div>
          <div className="attendance-list">
            {payers.map(p => (
              <div key={p.name} className="attendance-item">
                <span>{p.name}</span>
                <input type="checkbox" checked={attendance[p.name]} onChange={() => setAttendance({...attendance, [p.name]: !attendance[p.name]})} />
                <input type="checkbox" checked={selectedPayers[p.name]} onChange={() => setSelectedPayers({...selectedPayers, [p.name]: !selectedPayers[p.name]})} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card management-card">
        <h2>Manage Team</h2>
        <div className="add-payer-row">
          <input value={newPayerName} onChange={e => setNewPayerName(e.target.value)} placeholder="Name" />
          <button onClick={handleAddPayer}>Add Player +</button>
        </div>
      </div>

      <div className="upcoming-list">
        <h3>Payer Stats</h3>
        <ol>
          {payers.map((p, i) => (
            <PayerListItem 
              key={p.name} payer={p} index={i} 
              onRemoveClick={handleRemovePayer}
              onEditClick={(payer) => { setEditingName(payer.name); setEditForm(payer); }}
              isEditing={editingName === p.name}
              // ... other existing edit props
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function PayerListItem({ payer, index, onRemoveClick, onEditClick, isEditing }) {
  return (
    <li className={index < 2 ? 'is-next-to-pay' : ''}>
      <div className="payer-info">
        <strong>{index + 1}. {payer.name}</strong>
        <span className="stats">(Ratio: {payer.ratio.toFixed(2)})</span>
      </div>
      <div className="list-actions">
        <button onClick={() => onEditClick(payer)}>Edit</button>
        <button onClick={() => onRemoveClick(payer.name)} className="delete-button">Remove</button>
      </div>
    </li>
  );
}

export default App;