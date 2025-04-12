import json
import numpy as np
import logging
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

    def process_event(self, event: Dict[str, Any]):
        features = self.extract_features(event)
        if not features:
            return

        self.feature_log.append(features)

        if not self.trained and len(self.feature_log) >= 100:
            self.train_model()

        if self.trained:
            features_scaled = self.scaler.transform([features])
            prediction = self.model.predict(features_scaled)
            is_anomaly = prediction[0] == -1
            logging.info(f"Event anomaly status: {'ANOMALY' if is_anomaly else 'NORMAL'} | Features: {features}")

    def train_model(self):
        logging.info("Training SVM anomaly detector...")
        X = np.array(self.feature_log)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.trained = True
        logging.info("Model trained with %d samples", len(self.feature_log))

# Example test runner
if __name__ == "__main__":
    detector = CentralAnomalyDetector()

    with open("watchdog_event_stream.jsonl", "r") as f:
        for line in f:
            event = json.loads(line.strip())
            detector.process_event(event)
