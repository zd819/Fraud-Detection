import sys
import json
import random
from datetime import datetime

def check_fraud(node_data):
    """
    Basic fraud detection logic. This is a placeholder that can be replaced
    with more sophisticated detection algorithms.
    
    Currently it:
    1. Checks for suspicious activity patterns
    2. Validates node metadata
    3. Returns detection results
    """
    metadata = node_data.get('metadata', {})
    
    # Example checks (replace with actual fraud detection logic)
    suspicious_patterns = [
        metadata.get('cpu_usage', 0) > 95,  # Unusually high CPU usage
        metadata.get('network_requests', 0) > 1000,  # High number of requests
        metadata.get('error_rate', 0) > 0.5,  # High error rate
    ]
    
    # If any suspicious patterns are detected
    if any(suspicious_patterns):
        impact_levels = ['LOW', 'MEDIUM', 'HIGH']
        return {
            'status': 'red',
            'reason': 'Suspicious activity detected in node behavior',
            'impact': random.choice(impact_levels),
            'timestamp': datetime.now().isoformat()
        }
    
    return {
        'status': 'green',
        'timestamp': datetime.now().isoformat()
    }

if __name__ == '__main__':
    # Read input from Node.js
    node_data = json.loads(sys.argv[1])
    
    # Run fraud detection
    result = check_fraud(node_data)
    
    # Return result to Node.js
    print(json.dumps(result)) 