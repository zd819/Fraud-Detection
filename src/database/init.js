const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const db = new sqlite3.Database(path.join(__dirname, 'fraud_detection.db'), (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to SQLite database');
});

// Create tables
const initDb = async () => {
    const tables = [
        `CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            api_key TEXT UNIQUE,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            provider_id TEXT,
            status TEXT DEFAULT 'active',
            metadata TEXT,
            last_checked DATETIME,
            is_slashed INTEGER DEFAULT 0,
            stake_amount REAL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (provider_id) REFERENCES providers(id)
        )`,

        `CREATE TABLE IF NOT EXISTS fraud_records (
            id TEXT PRIMARY KEY,
            node_id TEXT,
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            impact TEXT,
            action_taken TEXT,
            stake_slashed REAL DEFAULT 0.0,
            FOREIGN KEY (node_id) REFERENCES nodes(id)
        )`,

        `CREATE TABLE IF NOT EXISTS stakes (
            id TEXT PRIMARY KEY,
            node_id TEXT,
            amount REAL DEFAULT 0.0,
            wallet_address TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (node_id) REFERENCES nodes(id)
        )`
    ];

    for (const table of tables) {
        await new Promise((resolve, reject) => {
            db.run(table, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    console.log('Database initialized successfully');
    db.close();
};

initDb().catch(console.error); 