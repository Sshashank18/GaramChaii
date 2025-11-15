import React, { useState, useEffect } from 'react';
import './App.css';

// Your Node.js server address
const API_URL = 'https://garamchaibackend.vercel.app/';

function App() {
  const [payers, setPayers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch the initial payer list when the app loads
  useEffect(() => {
    fetch(`${API_URL}/api/turn`)
      .then(res => res.json())
      .then(data => setPayers(data))
      .catch(err => console.error("Failed to fetch payers:", err));
  }, []);

  // 2. Handle the "Next Turn" button click
  const handleNextTurn = () => {
    setLoading(true);
    fetch(`${API_URL}/api/next`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setPayers(data); // Update the list with the new order
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to update turn:", err);
        setLoading(false);
      });
  };

  // Get the current and upcoming payers
  const currentPayer = payers.length > 0 ? payers[0] : "Add names to the list!";
  const upcomingPayers = payers.slice(1);

  return (
    <div className="container">
      <header>
        <h1>☕ Chaii Payment Turn</h1>
      </header>
      
      <div className="card">
        <h2>Current Payer:</h2>
        <div className="current-payer">{currentPayer}</div>
        <button 
          onClick={handleNextTurn} 
          disabled={loading || payers.length === 0}
        >
          {loading ? "Updating..." : "Paid! Next Person's Turn"}
        </button>
      </div>

      <div className="upcoming-list">
        <h3>Upcoming Order:</h3>
        <ol>
          {upcomingPayers.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ol>
        {payers.length <= 1 && <p>Add more people to the list!</p>}
      </div>
    </div>
  );
}

export default App;