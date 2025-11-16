import React, { useState, useEffect } from 'react';
import './App.css';

// Your Node.js server address
const API_URL = 'https://garam-chaii.fly.dev'; // Make sure this is your correct Fly.io URL

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(''); // NEW: State for the payment amount

  // 1. Fetch the initial payer list when the app loads
  useEffect(() => {
    setLoading(true);
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

  // 2. Handle the "Confirm Payment" button click
  const handlePayment = () => {
    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      alert('Please enter a valid, positive amount.');
      return;
    }

    setLoading(true);
    // NEW: Call the /api/pay endpoint with the amount in the body
    fetch(`${API_URL}/api/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: paymentAmount })
    })
      .then(res => res.json())
      .then(data => {
        setPayers(data); // Update the list with the new sorted order
        setAmount('');   // Clear the input field
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to update turn:", err);
        setLoading(false);
      });
  };

  return (
    <div className="container">
      <header>
        <h1>☕ Chaii Payment Turn</h1>
      </header>

      {/* --- NEW: Payment Card --- */}
      <div className="card">
        <h2>Confirm Payment</h2>
        <p>This will confirm payment for the top 2 people in the queue below and update the list.</p>
        
        <input
          type="number"
          className="amount-input"
          placeholder="Enter total amount (e.g., 150)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
        />
        
        <button
          onClick={handlePayment}
          // NEW: Disable logic checks for amount and payer count
          disabled={loading || payers.length < 2 || !amount || Number(amount) <= 0}
        >
          {loading ? "Updating..." : "Confirm Payment & Update Queue"}
        </button>
      </div>

      {/* --- NEW: Full Queue Display --- */}
      <div className="upcoming-list">
        <h3>Payment Queue (Sorted by who pays next)</h3>
        <ol>
          {payers.map((payer, index) => (
            <li
              key={payer.name}
              // NEW: Highlight the next two payers
              className={index === 0 || index === 1 ? 'is-next-to-pay' : ''}
            >
              <span>
                <strong>{index + 1}. {payer.name}</strong>
              </span>
              {/* NEW: Display stats for each person */}
              <span className="stats">
                (Paid: {payer.count}x | Total: ₹{payer.amount.toFixed(0)} | Ratio: {payer.ratio.toFixed(2)})
              </span>
            </li>
          ))}
        </ol>
        {loading && payers.length === 0 && <p>Loading list...</p>}
        {!loading && payers.length < 2 && <p>Add at least 2 payer groups to the list!</p>}
      </div>
    </div>
  );
}

export default App;