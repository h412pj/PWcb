const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'pwcb.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initializeTables();
      }
    });
  }

  initializeTables() {
    this.db.serialize(() => {
      // Users table (for both admins and players)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'player',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Items table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          item_type TEXT NOT NULL,
          rarity TEXT,
          stats TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Player inventory table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (item_id) REFERENCES items(id)
        )
      `);

      // Transfer history table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_user_id INTEGER NOT NULL,
          to_user_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'completed',
          FOREIGN KEY (from_user_id) REFERENCES users(id),
          FOREIGN KEY (to_user_id) REFERENCES users(id),
          FOREIGN KEY (item_id) REFERENCES items(id)
        )
      `);

      // Create default admin user if not exists
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.run(`
        INSERT OR IGNORE INTO users (id, username, password, role) 
        VALUES (1, 'admin', ?, 'admin')
      `, [hashedPassword]);

      console.log('Database tables initialized');
    });
  }

  // User operations
  createUser(username, password, role = 'player') {
    return new Promise((resolve, reject) => {
      const hashedPassword = bcrypt.hashSync(password, 10);
      this.db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, username, role });
        }
      );
    });
  }

  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT id, username, role, created_at FROM users',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Item operations
  createItem(name, description, itemType, rarity, stats) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO items (name, description, item_type, rarity, stats) VALUES (?, ?, ?, ?, ?)',
        [name, description, itemType, rarity, stats],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, name, description, itemType, rarity, stats });
        }
      );
    });
  }

  getAllItems() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM items ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getItemById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  updateItem(id, name, description, itemType, rarity, stats) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE items SET name = ?, description = ?, item_type = ?, rarity = ?, stats = ? WHERE id = ?',
        [name, description, itemType, rarity, stats, id],
        (err) => {
          if (err) reject(err);
          else resolve({ id, name, description, itemType, rarity, stats });
        }
      );
    });
  }

  deleteItem(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM items WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve({ deleted: true });
      });
    });
  }

  // Inventory operations
  addToInventory(userId, itemId, quantity) {
    return new Promise((resolve, reject) => {
      // Check if item already exists in inventory
      this.db.get(
        'SELECT * FROM inventory WHERE user_id = ? AND item_id = ?',
        [userId, itemId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Update quantity
            this.db.run(
              'UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
              [quantity, userId, itemId],
              (err) => {
                if (err) reject(err);
                else resolve({ updated: true });
              }
            );
          } else {
            // Insert new
            this.db.run(
              'INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)',
              [userId, itemId, quantity],
              function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
              }
            );
          }
        }
      );
    });
  }

  getUserInventory(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT i.*, inv.quantity, inv.obtained_at, inv.id as inventory_id
        FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.user_id = ?
        ORDER BY inv.obtained_at DESC
      `, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Transfer operations
  createTransfer(fromUserId, toUserId, itemId, quantity) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Check if sender has enough items
        this.db.get(
          'SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?',
          [fromUserId, itemId],
          (err, row) => {
            if (err || !row || row.quantity < quantity) {
              this.db.run('ROLLBACK');
              reject(new Error('Insufficient items'));
              return;
            }

            // Reduce from sender
            this.db.run(
              'UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?',
              [quantity, fromUserId, itemId],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                // Add to receiver
                this.addToInventory(toUserId, itemId, quantity)
                  .then(() => {
                    // Record transfer
                    this.db.run(
                      'INSERT INTO transfers (from_user_id, to_user_id, item_id, quantity) VALUES (?, ?, ?, ?)',
                      [fromUserId, toUserId, itemId, quantity],
                      function(err) {
                        if (err) {
                          this.db.run('ROLLBACK');
                          reject(err);
                        } else {
                          this.db.run('COMMIT');
                          resolve({ id: this.lastID });
                        }
                      }
                    );
                  })
                  .catch(err => {
                    this.db.run('ROLLBACK');
                    reject(err);
                  });
              }
            );
          }
        );
      });
    });
  }

  getAllTransfers() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT t.*, 
               u1.username as from_username,
               u2.username as to_username,
               i.name as item_name
        FROM transfers t
        JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        JOIN items i ON t.item_id = i.id
        ORDER BY t.transfer_date DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getUserTransfers(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT t.*, 
               u1.username as from_username,
               u2.username as to_username,
               i.name as item_name
        FROM transfers t
        JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        JOIN items i ON t.item_id = i.id
        WHERE t.from_user_id = ? OR t.to_user_id = ?
        ORDER BY t.transfer_date DESC
      `, [userId, userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Statistics
  getStatistics() {
    return new Promise((resolve, reject) => {
      const stats = {};
      
      this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalUsers = row.count;

        this.db.get('SELECT COUNT(*) as count FROM items', (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          stats.totalItems = row.count;

          this.db.get('SELECT COUNT(*) as count FROM transfers', (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            stats.totalTransfers = row.count;

            this.db.get('SELECT SUM(quantity) as count FROM inventory', (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              stats.totalInventoryItems = row.count || 0;
              resolve(stats);
            });
          });
        });
      });
    });
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = new Database();
