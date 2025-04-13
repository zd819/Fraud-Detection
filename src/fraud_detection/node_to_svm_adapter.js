/**
 * Node-to-SVM Adapter
 * This module converts provider node data to the format expected by the SVM classifier
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Path to the watchdog event stream file
const watchdogFilePath = path.join(__dirname, 'watchdog_event_stream.jsonl');

// Event types supported by the SVM classifier
const EVENT_TYPES = {
    RESOURCE_USAGE: 'resource_usage',
    MESSAGE_SENT: 'message_sent',
    TOOL_USAGE: 'tool_usage',
    MESSAGE_RECEIVED: 'message_received',
    OOD_DETECTION: 'ood_detection'
};

/**
 * Converts node metadata to SVM resource_usage event
 * @param {Object} nodeData The node data object
 * @returns {Object} Formatted SVM event
 */
function createResourceUsageEvent(nodeData) {
    return {
        type: EVENT_TYPES.RESOURCE_USAGE,
        data: {
            cpu_percent: nodeData.data.metadata.cpu_usage,
            memory_percent: nodeData.data.metadata.memory_usage
        }
    };
}

/**
 * Converts node LLM output to SVM message_sent event
 * @param {Object} nodeData The node data object
 * @returns {Object} Formatted SVM event
 */
function createMessageSentEvent(nodeData) {
    const llmOutput = nodeData.data.llm_output;
    if (!llmOutput) return null;

    // Create a prompt based on transaction data
    const prompt = `Analyze transaction: type=${llmOutput.transaction_type}, amount=${llmOutput.amount}`;
    
    return {
        type: EVENT_TYPES.MESSAGE_SENT,
        data: {
            prompt: prompt,
            response: llmOutput.response || ""
        }
    };
}

/**
 * Creates a tool usage event from node data
 * @param {Object} nodeData The node data object
 * @returns {Object} Formatted SVM event
 */
function createToolUsageEvent(nodeData) {
    // Use node type and provider as the tool name to represent different components
    const toolName = `${nodeData.type}_${nodeData.data.metadata.provider.replace(/\s+/g, '_')}`;
    
    return {
        type: EVENT_TYPES.TOOL_USAGE,
        data: {
            tool_name: toolName,
            params: {
                performance_score: nodeData.data.metadata.performance_score,
                transactions_per_second: nodeData.data.metadata.transactions_per_second
            }
        }
    };
}

/**
 * Creates a message received event from node data
 * @param {Object} nodeData The node data object
 * @returns {Object} Formatted SVM event
 */
function createMessageReceivedEvent(nodeData) {
    // Use a simple message format based on node activity
    const message = `Monitoring ${nodeData.data.metadata.provider} ${nodeData.type} node activity`;
    
    return {
        type: EVENT_TYPES.MESSAGE_RECEIVED,
        data: {
            message: message
        }
    };
}

/**
 * Creates an out-of-distribution detection event
 * @param {Object} nodeData The node data object
 * @returns {Object} Formatted SVM event
 */
function createOodDetectionEvent(nodeData) {
    // Calculate a pseudo-embedding score based on performance metrics
    // For real applications, this would use actual embeddings
    const performanceScore = nodeData.data.metadata.performance_score / 100;
    const errorRate = nodeData.data.metadata.error_rate;
    const returns = nodeData.data.performance.returns;
    
    // Combine these metrics into a single "embedding score"
    const embeddingScore = (performanceScore - errorRate + returns) / 3;
    
    return {
        type: EVENT_TYPES.OOD_DETECTION,
        data: {
            embedding_score: embeddingScore
        }
    };
}

/**
 * Converts a provider node data object into multiple SVM events
 * @param {Object} nodeData The node data object
 * @returns {Array} Array of SVM events
 */
function convertNodeDataToSvmEvents(nodeData) {
    if (!nodeData || !nodeData.data || !nodeData.data.metadata) {
        return [];
    }

    const events = [];
    
    // Add resource usage event (CPU, memory)
    events.push(createResourceUsageEvent(nodeData));
    
    // Add message sent event (LLM transaction analysis)
    const messageSentEvent = createMessageSentEvent(nodeData);
    if (messageSentEvent) {
        events.push(messageSentEvent);
    }
    
    // Add tool usage event
    events.push(createToolUsageEvent(nodeData));
    
    // Randomly add message received or OOD detection events
    // This simulates different types of events for the SVM classifier
    if (Math.random() > 0.7) {
        events.push(createMessageReceivedEvent(nodeData));
    }
    
    if (Math.random() > 0.8) {
        events.push(createOodDetectionEvent(nodeData));
    }
    
    return events;
}

/**
 * Writes node data events to the watchdog event stream file
 * @param {Array} nodes Array of node data objects
 * @returns {Promise<number>} Number of events written
 */
async function writeNodesToWatchdogFile(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return 0;
    }
    
    // Convert all nodes to SVM events
    const allEvents = nodes.flatMap(node => convertNodeDataToSvmEvents(node));
    
    try {
        // Create file if it doesn't exist
        if (!fs.existsSync(watchdogFilePath)) {
            fs.writeFileSync(watchdogFilePath, '');
        }
        
        // Write each event as a JSON line
        let eventsWritten = 0;
        const stream = fs.createWriteStream(watchdogFilePath, { flags: 'a' });
        
        for (const event of allEvents) {
            stream.write(JSON.stringify(event) + '\n');
            eventsWritten++;
        }
        
        stream.end();
        
        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(eventsWritten));
            stream.on('error', reject);
        });
    } catch (error) {
        console.error('Error writing to watchdog file:', error);
        throw error;
    }
}

/**
 * Runs the Python SVM classifier against the watchdog event stream
 * @returns {Promise<Object>} Classification results
 */
async function runSvmClassifier() {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'svm_classifier.py')
        ]);
        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`SVM classifier exited with code ${code}: ${stderrData}`));
            } else {
                try {
                    // Try to parse any JSON output, otherwise return logs
                    const lines = stdoutData.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    
                    try {
                        const result = JSON.parse(lastLine);
                        resolve(result);
                    } catch (e) {
                        // If not valid JSON, return the raw output
                        resolve({ 
                            success: true, 
                            logs: stdoutData,
                            anomalies: stdoutData.includes('ANOMALY') ? 
                                stdoutData.match(/Event anomaly status: ANOMALY/g)?.length || 0 : 0
                        });
                    }
                } catch (error) {
                    resolve({ success: true, logs: stdoutData });
                }
            }
        });
    });
}

module.exports = {
    writeNodesToWatchdogFile,
    runSvmClassifier,
    convertNodeDataToSvmEvents
};
