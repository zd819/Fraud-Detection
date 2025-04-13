const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { providers } = require('./provider_data');

// Path to the Python script and JSON output
const scriptPath = path.join(__dirname, '..', 'fraud_detection', 'prime_intellect_scraper.py');
const gpuDataPath = path.join(__dirname, 'gpu_instances.json');

/**
 * Run the Prime Intellect scraper Python script
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function runPrimeIntellectScraper() {
  return new Promise((resolve) => {
    console.log('Running Prime Intellect scraper...');
    const python = spawn('python', [scriptPath]);
    
    python.stdout.on('data', (data) => {
      console.log(`Prime Intellect scraper: ${data.toString()}`);
    });
    
    python.stderr.on('data', (data) => {
      console.error(`Prime Intellect scraper error: ${data.toString()}`);
    });
    
    python.on('close', (code) => {
      console.log(`Prime Intellect scraper exited with code ${code}`);
      resolve(code === 0);
    });
  });
}

/**
 * Load GPU data from the JSON file
 * @returns {Array} Array of GPU data or null if file doesn't exist
 */
function loadGpuData() {
  try {
    if (fs.existsSync(gpuDataPath)) {
      const data = fs.readFileSync(gpuDataPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading GPU data:', error);
  }
  return null;
}

/**
 * Convert Prime Intellect GPU data to node format
 * @param {Array} gpuData Array of GPU data from the scraper
 * @returns {Array} Array of nodes in the expected format
 */
function convertGpuDataToNodes(gpuData) {
  if (!gpuData || !Array.isArray(gpuData)) {
    return [];
  }
  
  const nodes = [];
  const provider = providers['prime_intellect'];
  
  gpuData.forEach((gpu, index) => {
    const gpuType = gpu.details['GPU Type'] || `GPU-${index}`;
    const memory = gpu.details['Memory'] || 'Unknown';
    const vcpus = gpu.details['vCPUs'] || 'Unknown';
    const pricing = gpu.pricing || [];
    
    // Calculate a price if available, otherwise use simulated data
    let price = 0;
    if (pricing.length > 0 && pricing[0].price) {
      price = pricing[0].price;
    } else {
      price = provider.baseReturns * (1 + (Math.random() - 0.5) * provider.riskFactor);
    }
    
    nodes.push({
      id: `prime_intellect_${gpuType.replace(/\s+/g, '_')}_${index}`,
      type: gpuType,
      data: {
        timestamp: new Date().toISOString(),
        metadata: {
          cpu_usage: Math.random() * 100,
          memory_usage: Math.random() * 100,
          network_requests: Math.floor(Math.random() * 2000),
          error_rate: Math.random() * 0.1,
          transactions_per_second: Math.floor(Math.random() * 1000),
          node_type: gpuType,
          provider: 'Prime Intellect',
          performance_score: Math.random() * 100,
          uptime: Math.random() * 100,
          memory: memory,
          vcpus: vcpus,
          last_maintenance: new Date(Date.now() - Math.random() * 86400000).toISOString()
        },
        performance: {
          returns: price,
          risk_score: Math.random() * provider.riskFactor * 100,
          efficiency: Math.random() * 100
        },
        // Add LLM output simulation
        llm_output: simulateLlmOutput()
      }
    });
  });
  
  return nodes;
}

/**
 * Simulate LLM output for node data
 * @returns {Object} Simulated LLM output
 */
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

/**
 * Update node data with real-time metrics and LLM output
 * @param {Array} nodes Array of nodes to update
 * @returns {Array} Updated nodes
 */
function updateNodeData(nodes) {
  return nodes.map(node => {
    // Update dynamic metrics
    node.data.timestamp = new Date().toISOString();
    node.data.metadata.cpu_usage = Math.random() * 100;
    node.data.metadata.memory_usage = Math.random() * 100;
    node.data.metadata.network_requests = Math.floor(Math.random() * 2000);
    node.data.metadata.error_rate = Math.random() * 0.1;
    node.data.metadata.transactions_per_second = Math.floor(Math.random() * 1000);
    node.data.metadata.performance_score = Math.random() * 100;
    
    // Update performance metrics
    const provider = providers['prime_intellect'];
    node.data.performance.returns = provider.baseReturns * (1 + (Math.random() - 0.5) * provider.riskFactor);
    node.data.performance.risk_score = Math.random() * provider.riskFactor * 100;
    node.data.performance.efficiency = Math.random() * 100;
    
    // Update LLM output
    node.data.llm_output = simulateLlmOutput();
    
    return node;
  });
}

/**
 * Get Prime Intellect nodes using real data if available or simulated data if not
 * @returns {Promise<Array>} Array of Prime Intellect nodes
 */
async function getPrimeIntellectNodes() {
  // Try to run the scraper (but don't wait if it takes too long)
  const scraperPromise = runPrimeIntellectScraper();
  
  // Set a timeout to continue even if scraper is slow
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => resolve(false), 10000); // 10 second timeout
  });
  
  // Wait for either the scraper to finish or the timeout
  await Promise.race([scraperPromise, timeoutPromise]);
  
  // Load GPU data from file (which might have been updated by the scraper)
  const gpuData = loadGpuData();
  
  // Convert GPU data to nodes or use simulated data if no GPU data
  if (gpuData) {
    return convertGpuDataToNodes(gpuData);
  } else {
    // Generate simulated nodes
    const provider = providers['prime_intellect'];
    const nodeCount = Math.floor(Math.random() * 5) + 3; // 3-7 nodes per type
    const nodes = [];
    
    provider.nodeTypes.forEach(nodeType => {
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `prime_intellect_${nodeType}_${i}`,
          type: nodeType,
          data: {
            timestamp: new Date().toISOString(),
            metadata: {
              cpu_usage: Math.random() * 100,
              memory_usage: Math.random() * 100,
              network_requests: Math.floor(Math.random() * 2000),
              error_rate: Math.random() * 0.1,
              transactions_per_second: Math.floor(Math.random() * 1000),
              node_type: nodeType,
              provider: 'Prime Intellect',
              performance_score: Math.random() * 100,
              uptime: Math.random() * 100,
              last_maintenance: new Date(Date.now() - Math.random() * 86400000).toISOString()
            },
            performance: {
              returns: provider.baseReturns * (1 + (Math.random() - 0.5) * provider.riskFactor),
              risk_score: Math.random() * provider.riskFactor * 100,
              efficiency: Math.random() * 100
            },
            llm_output: simulateLlmOutput()
          }
        });
      }
    });
    
    return nodes;
  }
}

/**
 * Simulate Prime Intellect provider data stream
 * @param {Function} callback Callback function to receive node updates
 * @param {number} interval Interval between updates in milliseconds
 * @param {number} steps Number of update steps to simulate (0 for unlimited)
 * @returns {Object} Control object with stop function
 */
async function simulatePrimeIntellectData(callback, interval = 5000, steps = 0) {
  // Get initial nodes
  let nodes = await getPrimeIntellectNodes();
  
  // Send initial data
  nodes.forEach(node => {
    callback(node);
  });
  
  let stepCount = 0;
  
  // Update data periodically
  const intervalId = setInterval(async () => {
    // Update all nodes with new dynamic data
    nodes = updateNodeData(nodes);
    
    // Send updates
    nodes.forEach(node => {
      callback(node);
    });
    
    stepCount++;
    
    // Stop after specified number of steps if not unlimited
    if (steps > 0 && stepCount >= steps) {
      clearInterval(intervalId);
    }
  }, interval);
  
  return {
    nodes,
    stop: () => clearInterval(intervalId)
  };
}

module.exports = {
  getPrimeIntellectNodes,
  simulatePrimeIntellectData,
  simulateLlmOutput
};
