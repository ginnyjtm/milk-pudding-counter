import { useState } from 'react'
import './App.css'

function App() {
  const [totalOrders, setTotalOrders] = useState(null)
  const [error, setError] = useState(null)

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
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div id="center">
      <h1>Milk Pudding Counter</h1>
      <button className="counter" onClick={addOrder}>
        + Add Order
      </button>
      {totalOrders !== null && (
        <p>Total orders today: <strong>{totalOrders}</strong></p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

export default App
