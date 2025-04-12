const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(
            path.join(__dirname, 'fraud_detection.db'),
            (err) => {
                if (err) {
                    console.error('Error connecting to database:', err);
                }
            }
        );
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ id: this.lastID });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    // Provider operations
    async createProvider(name, apiKey) {
        const id = require('uuid').v4();
        await this.run(
            'INSERT INTO providers (id, name, api_key) VALUES (?, ?, ?)',
            [id, name, apiKey]
        );
        return { id };
    }

    async getProvider(id) {
        return this.get('SELECT * FROM providers WHERE id = ?', [id]);
    }

    async getAllProviders() {
        return this.all('SELECT * FROM providers');
    }

    // Node operations
    async createNode(providerId, metadata = {}) {
        const id = require('uuid').v4();
        await this.run(
            'INSERT INTO nodes (id, provider_id, metadata) VALUES (?, ?, ?)',
            [id, providerId, JSON.stringify(metadata)]
        );
        return { id };
    }

    async updateNodeStatus(id, status, isSlashed = false) {
        return this.run(
            'UPDATE nodes SET status = ?, is_slashed = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?',
            [status, isSlashed ? 1 : 0, id]
        );
    }

    async getNode(id) {
        return this.get('SELECT * FROM nodes WHERE id = ?', [id]);
    }

    async getNodesByProvider(providerId) {
        return this.all('SELECT * FROM nodes WHERE provider_id = ?', [providerId]);
    }

    // Fraud record operations
    async createFraudRecord(nodeId, reason, impact, actionTaken, stakeSlashed = 0) {
        const id = require('uuid').v4();
        await this.run(
            'INSERT INTO fraud_records (id, node_id, reason, impact, action_taken, stake_slashed) VALUES (?, ?, ?, ?, ?, ?)',
            [id, nodeId, reason, impact, actionTaken, stakeSlashed]
        );
        return { id };
    }

    async getFraudRecords(nodeId) {
        return this.all('SELECT * FROM fraud_records WHERE node_id = ?', [nodeId]);
    }

    // Stake operations
    async updateStake(nodeId, amount, walletAddress) {
        const id = require('uuid').v4();
        await this.run(
            'INSERT INTO stakes (id, node_id, amount, wallet_address) VALUES (?, ?, ?, ?)',
            [id, nodeId, amount, walletAddress]
        );
        return { id };
    }

    async getStake(nodeId) {
        return this.get('SELECT * FROM stakes WHERE node_id = ? AND status = "active"', [nodeId]);
    }

    async slashStake(nodeId, amount) {
        const stake = await this.getStake(nodeId);
        if (!stake) return null;

        const newAmount = stake.amount - amount;
        await this.run(
            'UPDATE stakes SET amount = ? WHERE id = ?',
            [newAmount, stake.id]
        );
        return { newAmount };
    }
}

module.exports = new Database(); 