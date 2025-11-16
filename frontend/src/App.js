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

  // State for inline editing
  const [editingName, setEditingName] = useState(null); // Tracks which payer is being edited
  const [editForm, setEditForm] = useState({ amount: '', count: '' });

  // 1. Fetch the initial payer list
  useEffect(() => {
    fetch(`${API_URL}/api/turn`)
      .then(res => res.json())
      .then(data => {
        setPayers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch payers:", err);
        setLoading(false);
      });
  }, []);

  // --- LOGIC FOR TOP PAYMENT CARD ---
  const handlePayment = async () => {
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid, positive amount.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum })
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

  // --- LOGIC FOR INLINE EDITING ---

  const handleEditClick = (payer) => {
    setEditingName(payer.name);
    setEditForm({ amount: payer.amount, count: payer.count });
  };

  const handleCancelClick = () => {
    setEditingName(null);
    setEditForm({ amount: '', count: '' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleSaveClick = async (name) => {
    const newAmount = Number(editForm.amount);
    const newCount = Number(editForm.count);

    if (newAmount < 0 || newCount < 0 || !Number.isInteger(newCount)) {
      alert('Please enter a valid, non-negative amount and a whole number for count.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount: newAmount, count: newCount })
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

      {/* --- "Confirm Payment" Card --- */}
      <div className="card">
        <h2>Confirm Payment for Top 2</h2>
        <p>This will automatically update the stats for the next 2 people in the queue.</p>
        
        <input
          type="number"
          className="amount-input"
          placeholder="Enter total amount (e.g., 150)"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          disabled={loading}
        />
        
        <button
          onClick={handlePayment}
          disabled={loading || payers.length < 2 || !paymentAmount || Number(paymentAmount) <= 0}
        >
          {loading ? "Updating..." : "Confirm Payment & Update Queue"}
        </button>
      </div>

      {/* --- Full Queue Display (NOW MUCH CLEANER!) --- */}
      <div className="upcoming-list">
        <h3>Payer Stats (Sorted by ratio)</h3>
        <ol>
          {payers.map((payer, index) => {
            const isEditing = editingName === payer.name;
            
            return (
              <PayerListItem
                key={payer.name}
                payer={payer}
                index={index}
                isEditing={isEditing}
                loading={loading}
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

// --- Component 2: The List Item ---
// This component decides whether to show the display info or the edit form.

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
              (Paid: {payer.count}x | Total: ₹{payer.amount.toFixed(0)} | Ratio: {payer.ratio.toFixed(2)})
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

// --- Component 3: The Edit Form ---
// This component is just the form itself.

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
          Total Count:
          <input
            type="number"
            name="count"
            value={editForm.count}
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