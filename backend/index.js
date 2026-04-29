const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 3000;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

// ============ GOOGLE DRIVE CLIENT ============
const getAuthClient = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
};

const getDriveClient = async () => {
  const auth = getAuthClient();
  return google.drive({ version: 'v3', auth });
};

// ============ HELPER FUNCTIONS ============
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Find a file by name in a Drive folder, returns fileId or null
const findFile = async (drive, filename, folderId) => {
  const res = await drive.files.list({
    q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  return res.data.files.length > 0 ? res.data.files[0].id : null;
};

// Read a file's content from Drive by fileId
const readFile = async (drive, fileId) => {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );
  return res.data;
};

// Create a new file in Drive
const createFile = async (drive, filename, content, folderId) => {
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'application/json'
    },
    media: {
      mimeType: 'application/json',
      body: content
    },
    fields: 'id'
  });
  return res.data.id;
};

// Update an existing file in Drive
const updateFile = async (drive, fileId, content) => {
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/json',
      body: content
    }
  });
};

// Get today's data from Drive (or return empty structure)
const getTodayData = async (drive) => {
  const filename = `${getTodayDate()}.json`;
  const fileId = await findFile(drive, filename, FOLDER_ID);
  if (!fileId) {
    return { date: getTodayDate(), orders: [], expectedCash: 0, status: 'open' };
  }
  const raw = await readFile(drive, fileId);
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

// Save today's data to Drive (create or update)
const saveTodayData = async (drive, data) => {
  const filename = `${getTodayDate()}.json`;
  const content = JSON.stringify(data, null, 2);
  const fileId = await findFile(drive, filename, FOLDER_ID);
  if (fileId) {
    await updateFile(drive, fileId, content);
  } else {
    await createFile(drive, filename, content, FOLDER_ID);
  }
};

// Create a backup copy in the backup folder
const createBackup = async (drive) => {
  const filename = `${getTodayDate()}.json`;
  const fileId = await findFile(drive, filename, FOLDER_ID);
  if (!fileId) return;

  const now = new Date();
  const timeOnly = now.toISOString().split('T')[1].replace(/[:.]/g, '-').split('-').slice(0, 3).join('-');
  const backupFilename = `${getTodayDate()}_${timeOnly}.json`;

  const raw = await readFile(drive, fileId);
  await createFile(drive, backupFilename, typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2), BACKUP_FOLDER_ID);
  console.log(`Backup created: ${backupFilename}`);
};

// ============ API ENDPOINTS ============

// Get today's order and expected cash summary
app.get('/api/today', async (req, res) => {
  try {
    const drive = await getDriveClient();
    const data = await getTodayData(drive);
    const totalOrders = data.orders.length;
    const totalCash = totalOrders * 25;

    res.json({
      date: data.date,
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
    const drive = await getDriveClient();
    const data = await getTodayData(drive);

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

    await saveTodayData(drive, data);

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
    const drive = await getDriveClient();
    const data = await getTodayData(drive);

    if (data.status === 'closed') {
      return res.status(400).json({ error: 'Today\'s summary is already closed' });
    }

    await createBackup(drive);

    data.status = 'closed';
    data.closedAt = new Date().toISOString();
    data.expectedCash = data.orders.length * 25;

    await saveTodayData(drive, data);

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
    const drive = await getDriveClient();
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const filename = `${dateStr}.json`;
      const fileId = await findFile(drive, filename, FOLDER_ID);

      if (fileId) {
        const raw = await readFile(drive, fileId);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
    const drive = await getDriveClient();
    const result = await drive.files.list({
      q: `'${BACKUP_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name desc',
      spaces: 'drive'
    });

    const backups = result.data.files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        filename: f.name,
        date: f.name.split('_')[0]
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
    const drive = await getDriveClient();
    const data = await getTodayData(drive);

    if (data.status === 'closed') {
      data.status = 'open';
      delete data.closedAt;
      await saveTodayData(drive, data);
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
