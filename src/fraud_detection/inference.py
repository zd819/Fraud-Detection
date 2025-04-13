import os
import time
import json
import logging
import threading
import requests
import joblib
from typing import Any, Dict, List, Callable, Optional
from sklearn.neighbors import LocalOutlierFactor
from sentence_transformers import SentenceTransformer

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class LLMWatchdogWrapper:
    def __init__(self, 
                 event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
                 model_name: str = "llama3.2:latest",
                 ood_threshold: float = -1.5,
                 resource_ip: Optional[str] = None,
                 embedding_file: str = "embeddings.pkl",
                 log_file: str = "watchdog_event_stream.jsonl"):
        self.event_callback = event_callback or (lambda x: None)
        self.model_name = model_name
        self.ood_threshold = ood_threshold
        self.embedding_file = embedding_file
        self.log_file = log_file
        self.resource_ip = resource_ip

        # Group events related to one prompt
        self.current_prompt_events: List[Dict[str, Any]] = []

        # Initialize the embedding model
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

        # Load or initialize embeddings
        if os.path.exists(self.embedding_file):
            logging.info(f"Loading embeddings from {self.embedding_file}")
            self.embeddings = joblib.load(self.embedding_file)
        else:
            self.embeddings = []

        self._start_resource_monitoring()
        logging.info("LLM Watchdog for Ollama initialized")

    def _save_embeddings(self):
        joblib.dump(self.embeddings, self.embedding_file)

    def _log_grouped_events(self):
        if not self.current_prompt_events:
            return
        with open(self.log_file, "a") as f:
            json.dump(self.current_prompt_events, f)
            f.write("\n")
        self.current_prompt_events = []

    def _start_resource_monitoring(self):
        def monitor():
            while True:
                try:
                    resp = requests.get(f"http://{self.resource_ip}/resource-usage")
                    if resp.status_code == 200:
                        usage = resp.json()
                    else:
                        usage = {"error": "Failed to fetch from remote", "status_code": resp.status_code}
                except Exception as e:
                    usage = {"error": f"Exception contacting remote: {str(e)}"}

                event = {'type': 'resource_usage', 'data': usage}
                self.event_callback(event)
                # Resource usage is not tied to prompt session, log immediately
                with open(self.log_file, "a") as f:
                    json.dump([event], f)
                    f.write("\n")

                time.sleep(5)

        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()

    def generate(self, prompt: str) -> str:
        self.current_prompt_events = []  # Reset per prompt

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False
        }
        response = requests.post("http://172.30.1.200:11434/api/generate", json=payload)
        response.raise_for_status()
        result = response.json()
        output_text = result.get("response", "")

        # message_sent
        message_event = {
            'type': 'message_sent',
            'data': {
                'prompt': prompt,
                'response': output_text,
                'timestamp': time.time()
            }
        }
        self.event_callback(message_event)
        self.current_prompt_events.append(message_event)

        embedding = self.embedding_model.encode(output_text).tolist()
        self.embeddings.append(embedding)
        self._save_embeddings()

        if len(self.embeddings) > 50:
            embeddings_window = self.embeddings[-50:]
            lof = LocalOutlierFactor(n_neighbors=20)
            preds = lof.fit_predict(embeddings_window)
            score = lof.negative_outlier_factor_[-1]

            ood_event = {
                'type': 'ood_detection',
                'data': {
                    'embedding_score': score,
                    'text': output_text,
                    'timestamp': time.time()
                }
            }
            self.event_callback(ood_event)
            self.current_prompt_events.append(ood_event)

        # Dump all events related to this prompt
        self._log_grouped_events()

        return output_text

    def receive_message(self, message: str):
        # This is the entry to a new prompt session
        self.current_prompt_events = []

    def log_tool_usage(self, tool_name: str, params: Dict[str, Any]):
        event = {
            'type': 'tool_usage',
            'data': {
                'tool_name': tool_name,
                'params': params,
                'timestamp': time.time()
            }
        }
        self.event_callback(event)
        self.current_prompt_events.append(event)

# Example event callback
def example_event_handler(event: Dict[str, Any]):
    print(json.dumps(event, indent=2))

# Usage
if __name__ == "__main__":
    wrapper = LLMWatchdogWrapper(
        event_callback=example_event_handler,
        resource_ip='172.30.1.200:8000'
    )

    with open('normal_trading_prompts.json') as f:
        prompts = json.load(f)['normal_trading_prompts']

    for prompt in prompts:
        wrapper.receive_message("")
        prompt = "I am a stock trading agent. My task is to extract the stock symbol, action (buy/sell), "\
            "and quantity from a user's natural language input. I respond ONLY with a JSON object like this: \n"\
            "{\"stock\": \"AAPL\", \"action\": \"buy\", \"quantity\": 10} \n\n\n" + prompt
        result = wrapper.generate(prompt)
        print("Generated output:", result)
