import requests
from bs4 import BeautifulSoup
import json
import os
import logging
from typing import List, Dict, Any
import random
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class PrimeIntellectScraper:
    def __init__(self, url: str = "https://app.primeintellect.ai/dashboard/create-cluster?image=ubuntu_22_cuda_12&location=Cheapest&security=Cheapest&show_spot=false"):
        self.url = url
        self.gpu_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'simulation', 'gpu_instances.json')
        self.simulated_data = self._generate_simulated_data()
    
    def _generate_simulated_data(self) -> List[Dict[str, Any]]:
        """Generate simulated data as a fallback"""
        gpu_types = ["A100", "A10G", "RTX4090", "V100", "H100", "L40"]
        gpu_list = []
        
        for gpu_type in gpu_types:
            details = {
                "GPU Type": gpu_type,
                "Memory": f"{random.choice([16, 24, 32, 40, 48, 80])} GB",
                "vCPUs": str(random.choice([4, 8, 16, 32])),
                "RAM": f"{random.choice([16, 32, 64, 128])} GB",
                "Disk": f"{random.choice([100, 250, 500, 1000])} GB SSD"
            }
            
            pricing = [
                {"type": "On-Demand", "price": round(random.uniform(0.5, 5.0), 2)},
                {"type": "Spot", "price": round(random.uniform(0.2, 2.0), 2)}
            ]
            
            gpu_data = {
                "details": details,
                "pricing": pricing
            }
            gpu_list.append(gpu_data)
        
        return gpu_list
    
    def scrape_gpu_data(self) -> List[Dict[str, Any]]:
        """Scrape GPU data from Prime Intellect website or return simulated data on failure"""
        try:
            logging.info(f"Attempting to scrape GPU data from {self.url}")
            
            # Send a GET request to the URL
            response = requests.get(self.url, timeout=10)
            if response.status_code != 200:
                logging.warning(f"Failed to fetch data: HTTP {response.status_code}")
                return self.simulated_data
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Initialize a list to hold GPU data
            gpu_list = []
            
            # Find all GPU option cards (assuming a class like 'gpu-option-card')
            gpu_cards = soup.find_all('div', class_='gpu-option-card')
            
            if not gpu_cards:
                logging.warning("No GPU cards found, using simulated data")
                return self.simulated_data
                
            for card in gpu_cards:
                # Extract details into a dictionary
                details = {}
                detail_divs = card.find_all('div', class_='flex items-center space-x-2 text-sm bg-gray-800 rounded-md p-2 w-full')
                for detail_div in detail_divs:
                    label_span = detail_div.find('span', class_='text-gray-200')
                    value_span = detail_div.find('span', class_='font-medium text-white')
                    if label_span and value_span:
                        label = label_span.text.strip().rstrip(':')
                        value = value_span.text.strip()
                        details[label] = value
            
                # Extract pricing options (assuming a class like 'pricing-option')
                pricing_options = card.find_all('div', class_='pricing-option')
                pricing = []
                for option in pricing_options:
                    text = option.text.strip()
                    if '$' in text:
                        type_info, price_str = text.split('$')
                        type_info = type_info.strip()
                        price = float(price_str.strip())
                    else:
                        type_info = text
                        price = None
                    pricing.append({'type': type_info, 'price': price})
            
                # Structure the GPU data
                gpu_data = {
                    'details': details,
                    'pricing': pricing
                }
                gpu_list.append(gpu_data)
            
            # If we found GPU data, save it
            if gpu_list:
                self._save_gpu_data(gpu_list)
                return gpu_list
            else:
                return self.simulated_data
                
        except Exception as e:
            logging.error(f"Error scraping GPU data: {str(e)}")
            return self.simulated_data
    
    def _save_gpu_data(self, gpu_list: List[Dict[str, Any]]) -> None:
        """Save the GPU data to a JSON file"""
        try:
            with open(self.gpu_data_path, 'w') as f:
                json.dump(gpu_list, f, indent=2)
            logging.info(f"Saved GPU data to {self.gpu_data_path}")
        except Exception as e:
            logging.error(f"Error saving GPU data: {str(e)}")
    
    def get_gpu_data(self) -> List[Dict[str, Any]]:
        """Get GPU data from file if exists or scrape it"""
        try:
            if os.path.exists(self.gpu_data_path):
                with open(self.gpu_data_path, 'r') as f:
                    gpu_list = json.load(f)
                logging.info(f"Loaded GPU data from {self.gpu_data_path}")
                return gpu_list
            else:
                return self.scrape_gpu_data()
        except Exception as e:
            logging.error(f"Error getting GPU data: {str(e)}")
            return self.simulated_data

def simulate_llm_outputs() -> Dict[str, Any]:
    """Simulate LLM outputs for a transaction analysis"""
    transaction_types = ["purchase", "transfer", "withdrawal", "deposit", "subscription"]
    transaction_status = ["approved", "flagged", "rejected", "pending_review"]
    risk_levels = ["low", "medium", "high", "critical"]
    
    # Weight distribution to make most transactions normal
    status_weights = [0.85, 0.08, 0.05, 0.02]  
    risk_weights = [0.75, 0.15, 0.07, 0.03]
    
    transaction_type = random.choice(transaction_types)
    status = random.choices(transaction_status, weights=status_weights)[0]
    risk_level = random.choices(risk_levels, weights=risk_weights)[0]
    
    amount = round(random.uniform(10, 10000), 2)
    confidence = round(random.uniform(0.5, 1.0), 2)
    
    templates = [
        f"Transaction {transaction_type} for ${amount} analyzed. Status: {status}. Risk level: {risk_level}. Confidence: {confidence}.",
        f"Detected {transaction_type} transaction with amount ${amount}. Assessment: {status} with {risk_level} risk. Confidence score: {confidence}.",
        f"Analysis complete for ${amount} {transaction_type}. Flagged as {status} with {confidence} confidence. Risk assessment: {risk_level}."
    ]
    
    return {
        "transaction_type": transaction_type,
        "amount": amount,
        "status": status,
        "risk_level": risk_level,
        "confidence": confidence,
        "response": random.choice(templates)
    }

def generate_event_data(timestep: int = 0) -> Dict[str, Any]:
    """Generate event data for SVM classifier with LLM response"""
    event_types = ["resource_usage", "message_sent", "tool_usage", "message_received", "ood_detection"]
    
    # Weight distribution to ensure message_sent appears regularly
    event_weights = [0.2, 0.4, 0.1, 0.2, 0.1]
    
    event_type = random.choices(event_types, weights=event_weights)[0]
    
    if event_type == "resource_usage":
        data = {
            "cpu_percent": random.uniform(0, 100),
            "memory_percent": random.uniform(0, 100)
        }
    elif event_type == "message_sent":
        llm_data = simulate_llm_outputs()
        prompt = f"Analyze transaction: type={llm_data['transaction_type']}, amount=${llm_data['amount']}"
        data = {
            "prompt": prompt,
            "response": llm_data["response"]
        }
    elif event_type == "tool_usage":
        tools = ["transaction_analyzer", "risk_calculator", "pattern_detector", "identity_verifier"]
        tool_name = random.choice(tools)
        params = {
            "threshold": random.uniform(0.1, 0.9),
            "max_results": random.randint(1, 10)
        }
        data = {
            "tool_name": tool_name,
            "params": params
        }
    elif event_type == "message_received":
        messages = [
            "Please analyze this transaction",
            "Is this transaction suspicious?",
            "Check for fraud in recent transactions",
            "Verify this payment"
        ]
        data = {
            "message": random.choice(messages)
        }
    elif event_type == "ood_detection":
        data = {
            "embedding_score": random.uniform(0, 1)
        }
    
    return {
        "timestep": timestep,
        "type": event_type,
        "data": data
    }

def simulation_runner(steps: int = 20, interval: int = 5) -> None:
    """Run a simulation for a specified number of steps with a given interval"""
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'simulation', 'event_stream.jsonl')
    
    logging.info(f"Starting simulation for {steps} steps with {interval}s interval")
    
    with open(output_path, 'w') as f:
        for step in range(steps):
            event = generate_event_data(step)
            f.write(json.dumps(event) + '\n')
            logging.info(f"Generated event for step {step}")
            
            if step < steps - 1:  # Don't sleep after the last step
                time.sleep(interval)
    
    logging.info(f"Simulation complete. Events saved to {output_path}")

if __name__ == "__main__":
    scraper = PrimeIntellectScraper()
    gpu_data = scraper.get_gpu_data()
    print(f"Retrieved {len(gpu_data)} GPU instances")
    
    # Run simulation for 10 steps with 5 second interval
    simulation_runner(10, 5)
