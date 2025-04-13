const providers = {
    'nvidia': {
        name: 'Nvidia',
        baseReturns: 0.15, // 15% base return
        riskFactor: 0.3,   // 30% volatility
        nodeTypes: ['GPU', 'TPU', 'CPU'],
        minInvestment: 1000
    },
    'robinhood': {
        name: 'Robinhood',
        baseReturns: 0.12,
        riskFactor: 0.2,
        nodeTypes: ['Trading', 'Analysis'],
        minInvestment: 500
    },
    'coinbase': {
        name: 'Coinbase',
        baseReturns: 0.18,
        riskFactor: 0.4,
        nodeTypes: ['Mining', 'Staking', 'Trading'],
        minInvestment: 2000
    },
    'prime_intellect': {
        name: 'Prime Intellect',
        baseReturns: 0.25,
        riskFactor: 0.5,
        nodeTypes: ['AI', 'ML', 'Compute'],
        minInvestment: 5000
    },
    'stake': {
        name: 'Stake.com',
        baseReturns: 0.20,
        riskFactor: 0.35,
        nodeTypes: ['Gaming', 'Betting'],
        minInvestment: 1500
    }
};

// Generate random node data
function generateNodeData(provider, nodeType) {
    const now = new Date();
    return {
        timestamp: now.toISOString(),
        metadata: {
            cpu_usage: Math.random() * 100,
            memory_usage: Math.random() * 100,
            network_requests: Math.floor(Math.random() * 2000),
            error_rate: Math.random() * 0.1,
            transactions_per_second: Math.floor(Math.random() * 1000),
            node_type: nodeType,
            provider: provider.name,
            performance_score: Math.random() * 100,
            uptime: Math.random() * 100,
            last_maintenance: new Date(now - Math.random() * 86400000).toISOString()
        },
        performance: {
            returns: provider.baseReturns * (1 + (Math.random() - 0.5) * provider.riskFactor),
            risk_score: Math.random() * provider.riskFactor * 100,
            efficiency: Math.random() * 100
        },
        llm_output: simulateLlmOutput() // Add LLM output simulation
    };
}

// Simulate LLM transaction output
function simulateLlmOutput() {
    const transactionTypes = ["purchase", "transfer", "withdrawal", "deposit", "subscription"];
    const transactionStatus = ["approved", "flagged", "rejected", "pending_review"];
    const riskLevels = ["low", "medium", "high", "critical"];
    
    // Weight distribution to make most transactions normal
    const getWeightedRandom = (items, weights) => {
        const cumulativeWeights = [];
        let sum = 0;
        
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            cumulativeWeights[i] = sum;
        }
        
        const random = Math.random() * sum;
        for (let i = 0; i < cumulativeWeights.length; i++) {
            if (random < cumulativeWeights[i]) {
                return items[i];
            }
        }
        return items[0];
    };
    
    const statusWeights = [0.85, 0.08, 0.05, 0.02];
    const riskWeights = [0.75, 0.15, 0.07, 0.03];
    
    const transactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
    const status = getWeightedRandom(transactionStatus, statusWeights);
    const riskLevel = getWeightedRandom(riskLevels, riskWeights);
    
    const amount = parseFloat((Math.random() * 10000).toFixed(2));
    const confidence = parseFloat((Math.random() * 0.5 + 0.5).toFixed(2));
    
    const templates = [
        `Transaction ${transactionType} for $${amount} analyzed. Status: ${status}. Risk level: ${riskLevel}. Confidence: ${confidence}.`,
        `Detected ${transactionType} transaction with amount $${amount}. Assessment: ${status} with ${riskLevel} risk. Confidence score: ${confidence}.`,
        `Analysis complete for $${amount} ${transactionType}. Flagged as ${status} with ${confidence} confidence. Risk assessment: ${riskLevel}.`
    ];
    
    return {
        transaction_type: transactionType,
        amount: amount,
        status: status,
        risk_level: riskLevel,
        confidence: confidence,
        response: templates[Math.floor(Math.random() * templates.length)]
    };
}

// Simulate provider data stream
function simulateProviderData(providerId, callback, interval = 5000, maxSteps = 0) {
    const provider = providers[providerId];
    if (!provider) return null;

    // Special handling for Prime Intellect provider
    if (providerId === 'prime_intellect') {
        try {
            // Try to use the Prime Intellect Bridge
            const primeIntellectBridge = require('./prime_intellect_bridge');
            return primeIntellectBridge.simulatePrimeIntellectData(callback, interval, maxSteps);
        } catch (error) {
            console.error('Error using Prime Intellect Bridge:', error);
            // Fall back to standard simulation if bridge fails
        }
    }

    // Generate initial data for each node type
    const nodeCount = Math.floor(Math.random() * 5) + 3; // 3-7 nodes per type
    const nodes = [];

    provider.nodeTypes.forEach(nodeType => {
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                id: `${providerId}_${nodeType}_${i}`,
                type: nodeType,
                data: generateNodeData(provider, nodeType)
            });
        }
    });

    let stepCount = 0;

    // Update data periodically
    const intervalId = setInterval(() => {
        nodes.forEach(node => {
            node.data = generateNodeData(provider, node.type);
            callback(node);
        });

        stepCount++;
        
        // Stop after specified number of steps if not unlimited
        if (maxSteps > 0 && stepCount >= maxSteps) {
            clearInterval(intervalId);
        }
    }, interval);

    return {
        nodes,
        stop: () => clearInterval(intervalId)
    };
}

// Calculate optimal investment distribution based on user preferences
function calculateInvestmentStrategy(amount, riskPreference) {
    // riskPreference: 0 (conservative) to 1 (aggressive)
    const strategies = {
        conservative: {
            nvidia: 0.3,
            robinhood: 0.3,
            coinbase: 0.2,
            prime_intellect: 0.1,
            stake: 0.1
        },
        balanced: {
            nvidia: 0.25,
            robinhood: 0.2,
            coinbase: 0.25,
            prime_intellect: 0.15,
            stake: 0.15
        },
        aggressive: {
            nvidia: 0.15,
            robinhood: 0.15,
            coinbase: 0.3,
            prime_intellect: 0.25,
            stake: 0.15
        }
    };

    let strategy;
    if (riskPreference < 0.33) {
        strategy = strategies.conservative;
    } else if (riskPreference < 0.66) {
        strategy = strategies.balanced;
    } else {
        strategy = strategies.aggressive;
    }

    return Object.entries(strategy).map(([providerId, allocation]) => ({
        providerId,
        provider: providers[providerId].name,
        amount: amount * allocation,
        expectedReturn: providers[providerId].baseReturns,
        risk: providers[providerId].riskFactor
    }));
}

// Run simulation for multiple providers with a specified number of steps
function runMultiProviderSimulation(providerIds = Object.keys(providers), steps = 20, interval = 5000, callback) {
    const simulationData = {};
    const allNodes = [];
    
    providerIds.forEach(providerId => {
        const simulation = simulateProviderData(providerId, (node) => {
            // Add the node to the callback if provided
            if (callback) callback(node);
            
            // Update the node in our internal tracking
            const existingNodeIndex = allNodes.findIndex(n => n.id === node.id);
            if (existingNodeIndex >= 0) {
                allNodes[existingNodeIndex] = node;
            } else {
                allNodes.push(node);
            }
        }, interval, steps);
        
        if (simulation) {
            simulationData[providerId] = simulation;
        }
    });
    
    return {
        simulationData,
        allNodes,
        stop: () => {
            Object.values(simulationData).forEach(simulation => {
                if (simulation && typeof simulation.stop === 'function') {
                    simulation.stop();
                }
            });
        }
    };
}

module.exports = {
    providers,
    simulateProviderData,
    calculateInvestmentStrategy,
    runMultiProviderSimulation,
    simulateLlmOutput
}; 