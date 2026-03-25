const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { get } = require('http');

const app = express();

// ============ MIDDLEWARE ============
app.use
app.use(express.json());

// ============ CONFIGURATION ============
//Port
const PORT = 3000;

//Directories - create in project root
const DATA_DIR = path.join(__dirname,'..', 'data');
const LOGS_DIR = path.join(__dirname,'..', 'logs');
const BACKUP_DIR = path.join(__dirname, '..', 'backup');

//=========== INITIALIZATION ============

// Ensure directories exist
async function initializeDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(' Directories initialized');
    console.log(` Data: ${DATA_DIR}`);
    console.log(` Logs: ${LOGS_DIR}`);
    console.log(` Backups: ${BACKUP_DIR}`);
  } catch (err) {
    console.error('Error initializing directories:', err.message);
  }
}

initializeDirectories();

//=========== HELPER FUNCTIONS ============
//Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
 return new Date().toISOString().split('T')[0];
};

//Get path for today's order file
const getTodayOrderFilePath = () => {
  return path.join(DATA_DIR, `${getTodayDate()}.json`);
};

// Read today's data (or return empty array if file doesn't exist)
const getTodayData = async () => {
  try {
    const data = await fs.readFile(getTodayOrderFilePath(), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { date: getTodayDate(), orders: [], expectedCash: 0, status: 'open' };
    }
    throw err; // re-throw real errors
  }
};

// Save today's data to file
const saveTodayData = async (data) => {
  try {
    const filepath = getTodayOrderFilePath();
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Data saved to ${filepath}`);
  } catch (err) {
    console.error('Error saving data:', err.message);
    throw err;
  }
};

//Create backup of today's file
const createBackup = async () => {
  try {
    const filepath = getTodayOrderFilePath();

    // Check if file exists before backing up
    try {
      await fs.access(filepath);
    } catch (err) {
      //File doesn't exist, nothing to back up
      return;
    }

    //Create timestamped backup filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupPath = path.join(BACKUP_DIR, '${getTodayDate()}_${timestamp}.json');

    const data = await fs.readFile(filepath, 'utf8');
    await fs.writeFile(backupPath, data, 'utf8');
    console.log(`Backup created: ${path.basename(backupPath)}`);
  } catch (err) {
    console.error('Error creating backup:', err.message);
    //Don't throw error here - we want to continue even if backup fails
  }
};

//=========== API ENDPOINTS ============
//Get Today's order and expected cash summary
app.get('/api/today', async (req, res) => {
  try {
    const data = await getTodayData();
    const totalOders = data.orders.length;
    const totalCash = totalOders * 25;
    // Assuming each order is 25 baht

    res.json({
      date: data.date,
      totalOrders: totalOders,
      expectedCash: totalCash,
      status: data.status,
      orders: data.orders
    });
  } catch (err) {
    
  }
});

//Add new order

//Save Daily Summary

//Get Last 7 Days Summary

//List backups

//Server Health Check


app.get('/', (req, res) => {
  res.json({ message: 'Milk Pudding Counter API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


