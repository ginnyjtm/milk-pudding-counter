import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [totalOrders, setTotalOrders] = useState(0)
  const [expectedCash, setExpectedCash] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3000/api/today')
      .then(res => res.json())
      .then(data => {
        setTotalOrders(data.totalOrders)
        setExpectedCash(data.expectedCash)
      })
      .catch(() => setError('Failed to load today\'s data'))
  }, [])

  const addOrder = async () => {
    try {
      setError(null)
      const res = await fetch('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTotalOrders(data.totalOrders)
      setExpectedCash(data.expectedCash)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div id="header">
        <span id="title">Milk Pudding Counter</span>
        <div id="store-actions">
          <button className="open-store">Open Store</button>
          <button className="close-store">Close Store</button>
        </div>
      </div>
      <div id="center">
        <button className="counter" onClick={addOrder}>
          + Add Order
        </button>
        <div id="summary">
          <div className="summary-item">
            <span className="summary-value">{totalOrders}</span>
            <span className="summary-label">Orders Today</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-value">฿{expectedCash}</span>
            <span className="summary-label">Expected Cash</span>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  )
}

export default App
