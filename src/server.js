const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const db = require('./database/db');
const { providers, simulateProviderData, calculateInvestmentStrategy } = require('./simulation/provider_data');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active simulations
const activeSimulations = new Map();

// Start provider simulations
Object.keys(providers).forEach(providerId => {
    const simulation = simulateProviderData(providerId, (nodeData) => {
        // Emit node updates to all connected clients
        io.emit('nodeUpdate', nodeData);
        
        // Run fraud check
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'fraud_detection', 'check_fraud.py'),
            JSON.stringify(nodeData)
        ]);

        pythonProcess.stdout.on('data', async (data) => {
            const result = JSON.parse(data.toString());
            if (result.status === 'red') {
                io.emit('fraudDetected', {
                    nodeId: nodeData.id,
                    provider: nodeData.data.metadata.provider,
                    reason: result.reason,
                    impact: result.impact
                });
            }
        });
    });
    
    activeSimulations.set(providerId, simulation);
});

// Provider Routes
app.get('/api/providers', async (req, res) => {
    try {
        const providerData = Object.entries(providers).map(([id, data]) => ({
            id,
            ...data,
            nodeCount: activeSimulations.get(id)?.nodes.length || 0
        }));
        res.json(providerData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Investment Routes
app.post('/api/invest/direct', async (req, res) => {
    try {
        const { providerId, amount, userId } = req.body;
        const provider = providers[providerId];

        if (!provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        if (amount < provider.minInvestment) {
            return res.status(400).json({ 
                error: `Minimum investment for ${provider.name} is ${provider.minInvestment}`
            });
        }

        // In a real system, you would process the investment here
        // For now, we'll just simulate it
        const investment = {
            id: Math.random().toString(36).substr(2, 9),
            userId,
            providerId,
            provider: provider.name,
            amount,
            timestamp: new Date().toISOString(),
            expectedReturn: provider.baseReturns * amount,
            riskFactor: provider.riskFactor
        };

        res.json(investment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/invest/strategy', async (req, res) => {
    try {
        const { amount, riskPreference, userId } = req.body;

        if (amount < 1000) {
            return res.status(400).json({ error: 'Minimum total investment is 1000' });
        }

        if (riskPreference < 0 || riskPreference > 1) {
            return res.status(400).json({ error: 'Risk preference must be between 0 and 1' });
        }

        const strategy = calculateInvestmentStrategy(amount, riskPreference);

        // Validate minimum investments
        const invalidAllocations = strategy.filter(
            allocation => allocation.amount < providers[allocation.providerId].minInvestment
        );

        if (invalidAllocations.length > 0) {
            return res.status(400).json({
                error: 'Amount too low for optimal allocation',
                minimumRequired: Math.max(
                    ...Object.values(providers).map(p => p.minInvestment)
                ) * strategy.length
            });
        }

        // In a real system, you would process the investments here
        const investments = strategy.map(allocation => ({
            id: Math.random().toString(36).substr(2, 9),
            userId,
            ...allocation,
            timestamp: new Date().toISOString()
        }));

        res.json({
            strategy: investments,
            totalAmount: amount,
            expectedReturn: investments.reduce((sum, inv) => sum + inv.expectedReturn, 0),
            averageRisk: investments.reduce((sum, inv) => sum + inv.risk, 0) / investments.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Node data endpoint
app.get('/api/nodes/live', (req, res) => {
    const allNodes = Array.from(activeSimulations.values())
        .flatMap(sim => sim.nodes)
        .map(node => ({
            id: node.id,
            type: node.type,
            ...node.data
        }));
    res.json(allNodes);
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial node data
    const allNodes = Array.from(activeSimulations.values())
        .flatMap(sim => sim.nodes);
    socket.emit('initialNodes', allNodes);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 