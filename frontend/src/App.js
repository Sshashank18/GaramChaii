import React, { useState, useEffect } from 'react';
import './App.css';

// Your Node.js server address
const API_URL = 'https://garam-chaii.fly.dev'; // Make sure this is your correct Fly.io URL

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(true); // True on initial load
  
  // NEW: State for inline editing
  const [editingName, setEditingName] = useState(null); // Stores the name of the payer being edited
  const [editForm, setEditForm] = useState({ amount: '', count: '' }); // Stores the values in the edit inputs

  // 1. Fetch the initial payer list when the app loads
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

  // 2. NEW: Handle clicking the "Edit" button
  const handleEditClick = (payer) => {
    setEditingName(payer.name);
    // Pre-fill the form with the payer's current data
    setEditForm({ amount: payer.amount, count: payer.count });
  };

  // 3. NEW: Handle clicking the "Cancel" button
  const handleCancelClick = () => {
    setEditingName(null);
    setEditForm({ amount: '', count: '' });
  };

  // 4. NEW: Update the form state as the user types
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));
  };

  // 5. NEW: Handle saving the changes for a payer
  const handleSaveClick = async (name) => {
    const newAmount = Number(editForm.amount);
    const newCount = Number(editForm.count);

    // Basic validation
    if (newAmount < 0 || newCount < 0 || !Number.isInteger(newCount)) {
      alert('Please enter a valid, non-negative amount and a whole number for count.');
      return;
    }

    setLoading(true); // Use the main loading state to disable all buttons
    
    try {
      const response = await fetch(`${API_URL}/api/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          amount: newAmount,
          count: newCount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save update.');
      }

      const updatedPayers = await response.json();
      setPayers(updatedPayers); // Set the new sorted list from the server
      setEditingName(null); // Exit edit mode
      
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

      {/* --- THIS CARD IS REMOVED --- */}

      {/* --- NEW: Full Queue Display with Editing --- */}
      <div className="upcoming-list">
        <h3>Payer Stats (Sorted by ratio)</h3>
        <ol>
          {payers.map((payer, index) => {
            const isEditing = editingName === payer.name;
            
            return (
              <li
                key={payer.name}
                // NEW: Highlight the row being edited
                className={isEditing ? 'editing-row' : ''}
              >
                {isEditing ? (
                  // --- RENDER EDIT FORM ---
                  <form className="edit-form" onSubmit={(e) => { e.preventDefault(); handleSaveClick(payer.name); }}>
                    <strong>{payer.name}</strong>
                    <div className="edit-inputs">
                      <label>
                        Total Amount:
                        <input
                          type="number"
                          name="amount"
                          value={editForm.amount}
                          onChange={handleFormChange}
                          disabled={loading}
                        />
                      </label>
                      <label>
                        Total Count:
                        <input
                          type="number"
                          name="count"
                          value={editForm.count}
                          onChange={handleFormChange}
                          disabled={loading}
                        />
                      </label>
                    </div>
                    <div className="edit-buttons">
                      <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" onClick={handleCancelClick} disabled={loading}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  // --- RENDER DISPLAY ROW ---
                  <>
                    <div className="payer-info">
                      <span>
                        <strong>{index + 1}. {payer.name}</strong>
                      </span>
                      <span className="stats">
                        (Paid: {payer.count}x | Total: ₹{payer.amount.toFixed(0)} | Ratio: {payer.ratio.toFixed(2)})
                      </span>
                    </div>
                    <button onClick={() => handleEditClick(payer)} disabled={loading}>
                      Edit
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {loading && payers.length === 0 && <p>Loading list...</p>}
        {!loading && payers.length === 0 && <p>No payers found. Check server.</p>}
      </div>
    </div>
  );
}

export default App;