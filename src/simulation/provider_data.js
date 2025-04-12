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
        }
    };
}

// Simulate provider data stream
function simulateProviderData(providerId, callback, interval = 5000) {
    const provider = providers[providerId];
    if (!provider) return null;

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

    // Update data periodically
    const intervalId = setInterval(() => {
        nodes.forEach(node => {
            node.data = generateNodeData(provider, node.type);
            callback(node);
        });
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

module.exports = {
    providers,
    simulateProviderData,
    calculateInvestmentStrategy
}; 