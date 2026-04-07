const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { get } = require('http');

const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
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
    const backupPath = path.join(BACKUP_DIR, `${getTodayDate()}_${timestamp}.json`);

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
app.post('/api/orders', async (req, res) => {
  try {
    const data = await getTodayData();
    // Check if orders are closed for today
    if (data.status === 'closed') {
      return res.status(400).json({ error: 'Today\'s orders are closed' });
    }
    // Create new order object
    const newOrder = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      note: req.body.note || ''
    };
    // Add new order to today's data
    data.orders.push(newOrder);
    data.expectedCash = data.orders.length * 25;
   // Save updated data to file
    await saveTodayData(data);
  // Create backup after saving
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

//Save Daily Summary
app.post('/api/today/close', async (req, res) => {                                       
  try {                                                                                  
    const data = await getTodayData();                                                   
                                                                                       
    if (data.status === 'closed') {                                                    
      return res.status(400).json({ error: 'Today\'s summary is already closed' });                                                                                        
      }                                                                                    
                                                                                             
    await createBackup();                                                         
                                                                                      
    data.status = 'closed';                                                       
    data.closedAt = new Date().toISOString();                                     
    data.expectedCash = data.orders.length * 25;                                  
                                                                                      
    await saveTodayData(data);                                                    
                                                                                      
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
//Get Last 7 Days Summary
app.get('/api/summary', async (req, res) => {
  try {
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const filePath = path.join(DATA_DIR, `${dateStr}.json`);

      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(raw);
        days.push({
          date: dateStr,
          totalOrders: data.orders.length,
          expectedCash: data.orders.length * 25,
          status: data.status
        });
      } catch (err) {
        if (err.code === 'ENOENT') {
          days.push({ date: dateStr, totalOrders: 0, expectedCash: 0, status: 'no data' });
        } else {
          throw err;
        }
      }
    }

    res.json({ days });
  } catch (err) {
    console.error('Error fetching summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

//List backups
app.get('/api/backups', async (_req, res) => {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => ({
        filename: f,
        date: f.split('_')[0]
      }));

    res.json({ backups });
  } catch (err) {
    console.error('Error listing backups:', err.message);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

//Server Health Check — also reopens today's orders if closed
app.get('/', async (_req, res) => {
  try {
    const data = await getTodayData();

    if (data.status === 'closed') {
      data.status = 'open';
      delete data.closedAt;
      await saveTodayData(data);
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


