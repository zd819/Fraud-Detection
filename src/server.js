const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./database/db');
const { providers, simulateProviderData, calculateInvestmentStrategy, runMultiProviderSimulation } = require('./simulation/provider_data');
const { writeNodesToWatchdogFile, runSvmClassifier, formatNodeStructureForFrontend } = require('./fraud_detection/node_to_svm_adapter');

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
let allNodes = [];
let anomalyResults = null;
let formattedNodeResults = {};
let processedNodeTimeline = []; // Timeline to maintain chronological order

// Function to periodically process node data with SVM classifier
async function processSvmClassification() {
    try {
        if (allNodes.length === 0) return;
        
        // Write all node data to the watchdog file
        const eventsWritten = await writeNodesToWatchdogFile(allNodes);
        console.log(`Wrote ${eventsWritten} events to watchdog event stream`);
        
        // Run the SVM classifier
        const result = await runSvmClassifier();
        anomalyResults = result;
        
        // Format results for frontend consumption
        formattedNodeResults = formatNodeStructureForFrontend(result, allNodes);
        
        // Update the timeline with new results
        Object.entries(formattedNodeResults).forEach(([nodeName, nodeData]) => {
            // Check if node is already in timeline
            const existingIndex = processedNodeTimeline.findIndex(item => Object.keys(item)[0] === nodeName);
            
            if (existingIndex >= 0) {
                // Update existing entry
                processedNodeTimeline[existingIndex] = { [nodeName]: nodeData };
            } else {
                // Add new entry to timeline
                processedNodeTimeline.push({ [nodeName]: nodeData });
            }
        });
        
        // Emit the results to connected clients
        io.emit('anomalyDetection', {
            timestamp: new Date().toISOString(),
            ...result
        });
        
        // Also emit the formatted node structure
        io.emit('nodeStructureUpdate', {
            timestamp: new Date().toISOString(),
            nodeStructure: formattedNodeResults
        });
        
        console.log('SVM classification complete:', 
            result.anomalies !== undefined ? 
            `Found ${result.anomalies} anomalies` : 
            'No anomalies found');
    } catch (error) {
        console.error('Error in SVM classification process:', error);
    }
}

// Start provider simulations
const simulationController = runMultiProviderSimulation(
    Object.keys(providers), 
    0,  // Run continuously
    5000, // 5-second interval
    (nodeData) => {
        // Update our node collection
        const existingIndex = allNodes.findIndex(n => n.id === nodeData.id);
        if (existingIndex >= 0) {
            allNodes[existingIndex] = nodeData;
        } else {
            allNodes.push(nodeData);
        }
        
        // Emit node updates to all connected clients
        io.emit('nodeUpdate', nodeData);
        
        // Run fraud check (basic check - separate from SVM)
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'fraud_detection', 'check_fraud.py'),
            JSON.stringify(nodeData)
        ]);

        pythonProcess.stdout.on('data', async (data) => {
            try {
                const result = JSON.parse(data.toString());
                if (result.status === 'red') {
                    io.emit('fraudDetected', {
                        nodeId: nodeData.id,
                        provider: nodeData.data.metadata.provider,
                        reason: result.reason,
                        impact: result.impact
                    });
                }
            } catch (error) {
                console.error('Error parsing fraud check result:', error);
            }
        });
    }
);

// Store active simulations for API access
Object.keys(providers).forEach(providerId => {
    if (simulationController.simulationData[providerId]) {
        activeSimulations.set(providerId, simulationController.simulationData[providerId]);
    }
});

// Set up periodic SVM classification (every 5 seconds)
const svmInterval = setInterval(processSvmClassification, 5000);

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
    // Return all nodes with their latest data
    res.json(allNodes.map(node => ({
        id: node.id,
        type: node.type,
        ...node.data
    })));
});

// SVM anomaly detection endpoint
app.get('/api/anomalies', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        anomalyResults: anomalyResults || { anomalies: 0, logs: "No anomaly detection results yet" }
    });
});

// Formatted node structure endpoint - returns in chronological order
app.get('/api/node-structure', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        nodesInChronologicalOrder: processedNodeTimeline
    });
});

// GPU nodes by provider endpoint
app.get('/api/provider-gpus', (req, res) => {
    // Group nodes by provider
    const providersWithNodes = {};
    
    // Initialize providers with empty arrays
    Object.keys(providers).forEach(providerId => {
        const formattedId = providerId === 'prime_intellect' ? 'prime intellect' : providerId;
        providersWithNodes[formattedId] = [];
    });
    
    // Add all GPU nodes to their respective providers
    allNodes.forEach(node => {
        if (!node.data || !node.data.metadata) return;
        
        const providerName = node.data.metadata.provider;
        // Convert to lowercase and replace underscores with spaces for the key
        const providerKey = providerName.toLowerCase().replace(/_/g, ' ');
        
        // Only add the node type if it doesn't already exist in the array
        if (providersWithNodes[providerKey] && !providersWithNodes[providerKey].includes(node.type)) {
            providersWithNodes[providerKey].push(node.type);
        }
    });
    
    res.json(providersWithNodes);
});

// Detailed GPU nodes by provider endpoint
app.get('/api/provider-gpus/detailed', (req, res) => {
    // Group nodes by provider with detailed information
    const providersWithDetailedNodes = {};
    
    // Initialize providers with empty objects
    Object.keys(providers).forEach(providerId => {
        const formattedId = providerId === 'prime_intellect' ? 'prime intellect' : providerId;
        providersWithDetailedNodes[formattedId] = {};
    });
    
    // Add all GPU nodes with their details to their respective providers
    allNodes.forEach(node => {
        if (!node.data || !node.data.metadata) return;
        
        const providerName = node.data.metadata.provider;
        // Convert to lowercase and replace underscores with spaces for the key
        const providerKey = providerName.toLowerCase().replace(/_/g, ' ');
        
        if (providersWithDetailedNodes[providerKey]) {
            // Add the node with its rogue status and reason
            providersWithDetailedNodes[providerKey][node.type] = {
                rogue: node.data.metadata.rogue,
                rogueReason: node.data.metadata.rogueReason
            };
        }
    });
    
    res.json(providersWithDetailedNodes);
});

// Manual trigger for SVM processing
app.post('/api/process-svm', async (req, res) => {
    try {
        await processSvmClassification();
        res.json({ 
            success: true, 
            message: 'SVM processing triggered successfully',
            formattedResults: formattedNodeResults
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial node data
    socket.emit('initialNodes', allNodes);
    
    // Send latest anomaly results if available
    if (anomalyResults) {
        socket.emit('anomalyDetection', {
            timestamp: new Date().toISOString(),
            ...anomalyResults
        });
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Clean up on server shutdown
process.on('SIGINT', () => {
    clearInterval(svmInterval);
    simulationController.stop();
    console.log('Simulations stopped, shutting down server...');
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});