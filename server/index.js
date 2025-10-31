const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pwcb-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = await db.createUser(username, password, 'player');
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User routes
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserByUsername(req.user.username);
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Item routes
app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const items = await db.getAllItems();
    res.json(items);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/items/:id', authenticateToken, async (req, res) => {
  try {
    const item = await db.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, itemType, rarity, stats } = req.body;
    
    if (!name || !itemType) {
      return res.status(400).json({ error: 'Name and item type are required' });
    }

    const item = await db.createItem(name, description, itemType, rarity, JSON.stringify(stats));
    res.status(201).json(item);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, itemType, rarity, stats } = req.body;
    
    if (!name || !itemType) {
      return res.status(400).json({ error: 'Name and item type are required' });
    }

    const item = await db.updateItem(
      req.params.id,
      name,
      description,
      itemType,
      rarity,
      JSON.stringify(stats)
    );
    res.json(item);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.deleteItem(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Inventory routes
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await db.getUserInventory(req.user.id);
    res.json(inventory);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/inventory', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, itemId, quantity } = req.body;
    
    if (!userId || !itemId || !quantity) {
      return res.status(400).json({ error: 'User ID, item ID, and quantity are required' });
    }

    await db.addToInventory(userId, itemId, quantity);
    res.status(201).json({ message: 'Item added to inventory' });
  } catch (error) {
    console.error('Add to inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Transfer routes
app.get('/api/transfers', authenticateToken, async (req, res) => {
  try {
    let transfers;
    if (req.user.role === 'admin') {
      transfers = await db.getAllTransfers();
    } else {
      transfers = await db.getUserTransfers(req.user.id);
    }
    res.json(transfers);
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const { toUsername, itemId, quantity } = req.body;
    
    if (!toUsername || !itemId || !quantity) {
      return res.status(400).json({ error: 'Recipient username, item ID, and quantity are required' });
    }

    const toUser = await db.getUserByUsername(toUsername);
    if (!toUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    if (toUser.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    await db.createTransfer(req.user.id, toUser.id, itemId, quantity);
    res.status(201).json({ message: 'Transfer completed successfully' });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Statistics route (admin only)
app.get('/api/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await db.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`PWcb server running on port ${PORT}`);
  console.log(`Default admin credentials: username=admin, password=admin123`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});
