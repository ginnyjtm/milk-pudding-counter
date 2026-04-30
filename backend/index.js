require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Firestore } = require('@google-cloud/firestore');

const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 3000;

// ============ FIRESTORE CLIENT ============
const getFirestore = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new Firestore({
    projectId: credentials.project_id,
    credentials
  });
};

// ============ HELPER FUNCTIONS ============
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

const getDocId = (store) => `${getTodayDate()}-${store}`;

// Get today's data from Firestore (or return empty structure)
const getTodayData = async (db, store) => {
  const doc = await db.collection('orders').doc(getDocId(store)).get();
  if (!doc.exists) {
    return { date: getTodayDate(), store, orders: [], expectedCash: 0, status: 'open' };
  }
  return doc.data();
};

// Save today's data to Firestore
const saveTodayData = async (db, data, store) => {
  await db.collection('orders').doc(getDocId(store)).set(data);
};

// Create a backup in Firestore
const createBackup = async (db, store) => {
  const data = await getTodayData(db, store);
  const now = new Date();
  const timeOnly = now.toISOString().split('T')[1].replace(/[:.]/g, '-').split('-').slice(0, 3).join('-');
  const backupId = `${getDocId(store)}_${timeOnly}`;
  await db.collection('backups').doc(backupId).set(data);
  console.log(`Backup created: ${backupId}`);
};

// ============ API ENDPOINTS ============

// Get today's order and expected cash summary
app.get('/api/today', async (req, res) => {
  try {
    const store = req.query.store;
    if (!store) return res.status(400).json({ error: 'Missing store parameter' });
    const db = getFirestore();
    const data = await getTodayData(db, store);
    const totalOrders = data.orders.length;
    const totalCash = totalOrders * 25;

    res.json({
      date: data.date,
      store: data.store,
      totalOrders,
      expectedCash: totalCash,
      status: data.status,
      orders: data.orders
    });
  } catch (err) {
    console.error('Error fetching today data:', err.message);
    res.status(500).json({ error: 'Failed to fetch today\'s data' });
  }
});

// Add new order
app.post('/api/orders', async (req, res) => {
  try {
    const store = req.query.store;
    if (!store) return res.status(400).json({ error: 'Missing store parameter' });
    const db = getFirestore();
    const data = await getTodayData(db, store);

    if (data.status === 'closed') {
      return res.status(400).json({ error: 'Today\'s orders are closed' });
    }

    const newOrder = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      note: req.body.note || ''
    };

    data.orders.push(newOrder);
    data.expectedCash = data.orders.length * 25;

    await saveTodayData(db, data, store);

    res.status(201).json({
      order: newOrder,
      totalOrders: data.orders.length,
      expectedCash: data.expectedCash
    });
  } catch (err) {
    console.error('Error adding order:', err.message);
    res.status(500).json({ error: 'Failed to add order' });
  }
});

// Close daily orders and save summary
app.post('/api/today/close', async (req, res) => {
  try {
    const store = req.query.store;
    if (!store) return res.status(400).json({ error: 'Missing store parameter' });
    const db = getFirestore();
    const data = await getTodayData(db, store);

    if (data.status === 'closed') {
      return res.status(400).json({ error: 'Today\'s summary is already closed' });
    }

    await createBackup(db, store);

    data.status = 'closed';
    data.closedAt = new Date().toISOString();
    data.expectedCash = data.orders.length * 25;

    await saveTodayData(db, data, store);

    res.json({
      date: data.date,
      totalOrders: data.orders.length,
      expectedCash: data.expectedCash,
      closedAt: data.closedAt,
      status: data.status
    });
  } catch (err) {
    console.error('Error closing daily summary:', err.message);
    res.status(500).json({ error: 'Failed to close daily summary' });
  }
});

// Get last 7 days summary
app.get('/api/summary', async (req, res) => {
  try {
    const store = req.query.store;
    if (!store) return res.status(400).json({ error: 'Missing store parameter' });
    const db = getFirestore();
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const doc = await db.collection('orders').doc(`${dateStr}-${store}`).get();

      if (doc.exists) {
        const data = doc.data();
        days.push({
          date: dateStr,
          totalOrders: data.orders.length,
          expectedCash: data.orders.length * 25,
          status: data.status
        });
      } else {
        days.push({ date: dateStr, totalOrders: 0, expectedCash: 0, status: 'no data' });
      }
    }

    res.json({ days });
  } catch (err) {
    console.error('Error fetching summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// List backups
app.get('/api/backups', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('backups').orderBy('__name__', 'desc').get();

    const backups = snapshot.docs.map(doc => ({
      filename: doc.id,
      date: doc.id.split('_')[0]
    }));

    res.json({ backups });
  } catch (err) {
    console.error('Error listing backups:', err.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Health check — also reopens today's orders if closed
app.get('/', async (req, res) => {
  try {
    const store = req.query.store;
    if (!store) return res.json({ message: 'Milk Pudding Counter API is running' });
    const db = getFirestore();
    const data = await getTodayData(db, store);

    if (data.status === 'closed') {
      data.status = 'open';
      delete data.closedAt;
      await saveTodayData(db, data, store);
    }

    res.json({ message: 'Milk Pudding Counter API is running', todayStatus: data.status });
  } catch (err) {
    console.error('Error in health check:', err.message);
    res.status(500).json({ error: 'Health check failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
