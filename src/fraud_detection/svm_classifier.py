import json
import numpy as np
import logging
import os
import sys
from typing import List, Dict, Any
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class CentralAnomalyDetector:
    def __init__(self, nu: float = 0.05, kernel: str = 'rbf', gamma: str = 'scale'):
        self.scaler = StandardScaler()
        self.model = OneClassSVM(nu=nu, kernel=kernel, gamma=gamma)
        self.trained = False
        self.feature_log: List[List[float]] = []
        self.anomaly_count = 0
        self.total_processed = 0

    def extract_features(self, event: Dict[str, Any]) -> List[float]:
        etype = event['type']
        data = event['data']

        if etype == 'resource_usage':
            return [data['cpu_percent'], data['memory_percent']]

        elif etype == 'message_sent':
            prompt_len = len(data['prompt'])
            response_len = len(data['response'])
            return [prompt_len, response_len, prompt_len / max(response_len, 1)]

        elif etype == 'tool_usage':
            tool_name = data['tool_name']
            tool_score = sum(ord(c) for c in tool_name) % 100  # crude numeric encoding
            return [tool_score, len(data.get('params', {}))]

        elif etype == 'message_received':
            return [len(data['message'])]

        elif etype == 'ood_detection':
            return [data['embedding_score']]

        else:
            return []

    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        features = self.extract_features(event)
        if not features:
            return {"processed": False, "reason": "No features extracted"}

        self.feature_log.append(features)
        self.total_processed += 1

        if not self.trained and len(self.feature_log) >= 50:  # Lower threshold for faster training
            self.train_model()

        result = {
            "processed": True,
            "event_type": event['type'],
            "features": features,
            "is_anomaly": False
        }

        if self.trained:
            features_scaled = self.scaler.transform([features])
            prediction = self.model.predict(features_scaled)
            is_anomaly = prediction[0] == -1
            
            if is_anomaly:
                self.anomaly_count += 1
                
            result["is_anomaly"] = is_anomaly
            result["anomaly_status"] = 'ANOMALY' if is_anomaly else 'NORMAL'
            
            logging.info(f"Event anomaly status: {result['anomaly_status']} | Features: {features}")
        
        return result

    def train_model(self):
        if len(self.feature_log) < 10:  # Need at least some data to train
            logging.warning("Not enough data to train the model")
            return False
            
        logging.info("Training SVM anomaly detector...")
        X = np.array(self.feature_log)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.trained = True
        logging.info("Model trained with %d samples", len(self.feature_log))
        return True
        
    def get_stats(self) -> Dict[str, Any]:
        return {
            "trained": self.trained,
            "total_events_processed": self.total_processed,
            "anomalies_detected": self.anomaly_count,
            "training_samples": len(self.feature_log)
        }

def process_watchdog_stream(file_path: str = "watchdog_event_stream.jsonl") -> Dict[str, Any]:
    """Process the entire watchdog event stream file and return statistics"""
    try:
        detector = CentralAnomalyDetector()
        results = []
        
        # Check if file exists and is not empty
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return {
                "success": False,
                "error": f"File {file_path} does not exist or is empty",
                "anomalies": 0
            }
            
        with open(file_path, "r") as f:
            for line in f:
                if not line.strip():
                    continue
                    
                try:
                    event = json.loads(line.strip())
                    result = detector.process_event(event)
                    results.append(result)
                except json.JSONDecodeError:
                    logging.error(f"Invalid JSON in line: {line}")
                except Exception as e:
                    logging.error(f"Error processing event: {str(e)}")
        
        # Count anomalies
        anomalies = sum(1 for r in results if r.get('is_anomaly', False))
        
        stats = detector.get_stats()
        
        return {
            "success": True,
            "stats": stats,
            "anomalies": anomalies,
            "total_processed": len(results),
            "model_trained": detector.trained
        }
    except Exception as e:
        logging.error(f"Error processing watchdog stream: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "anomalies": 0
        }

# Example test runner
if __name__ == "__main__":
    # Default path - can be overridden by command line argument
    stream_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "watchdog_event_stream.jsonl")
    
    # Check for command line argument
    if len(sys.argv) > 1:
        stream_path = sys.argv[1]
    
    result = process_watchdog_stream(stream_path)
    print(json.dumps(result))
