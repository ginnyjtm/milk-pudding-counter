import { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function App() {
  const [totalOrders, setTotalOrders] = useState(0)
  const [expectedCash, setExpectedCash] = useState(0)
  const [status, setStatus] = useState('closed')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/today`)
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
      const res = await fetch(`${API_URL}/api/orders`, {
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

  const openStore = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus(data.todayStatus)
      const todayRes = await fetch(`${API_URL}/api/today`)
      const todayData = await todayRes.json()
      setTotalOrders(todayData.totalOrders)
      setExpectedCash(todayData.expectedCash)
    } catch (err) {
      setError(err.message)
    }
  }

  const closeStore = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/api/today/close`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus(data.status)
    } catch (err) {
      setError(err.message)
    }
  }

  const isClosed = status === 'closed'

  return (
    <>
      <div id="header">
        <span id="title">เต้าหู้นมสด</span>
        <div id="store-actions">
          <button className="open-store" onClick={openStore} disabled={!isClosed}>เปิดร้าน</button>
          <button className="close-store" onClick={closeStore} disabled={isClosed}>ปิดร้าน</button>
        </div>
      </div>
      <div id="center">
        <button className="counter" onClick={addOrder} disabled={isClosed}>
          + เพิ่มออร์เดอร์
        </button>
        <div id="summary">
          <div className="summary-item">
            <span className="summary-value">{totalOrders}</span>
            <span className="summary-label">ขายไปทั้งหมด(ถุง)</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-value">฿{expectedCash}</span>
            <span className="summary-label">เงินที่คาดหวัง (บาท)</span>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  )
}

export default App
