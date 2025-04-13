# trade_audit_agents_a2a_protocol.py
import time
import json
import logging
import requests
from typing import Dict, Any
from python_a2a import A2AServer, A2AClient, Message, TextContent, MessageRole, run_server

logging.basicConfig(level=logging.INFO)

# Dummy trade executor
def execute_trade(stock: str, action: str, quantity: int) -> Dict[str, Any]:
    return {
        "status": "success",
        "message": f"{action.upper()} {quantity} shares of {stock}",
        "timestamp": time.time()
    }

# LLM wrapper using Ollama
def call_llm(prompt: str, system: str = "", model: str = "llama3.2:latest") -> str:
    full_prompt = f"<|system|>\n{system}\n<|user|>\n{prompt}\n<|assistant|>"
    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": False
    }
    print('Posting')
    response = requests.post("http://172.30.1.200:11434/api/generate", json=payload)
    print(payload)
    response.raise_for_status()
    return response.json().get("response", "")

TRADER_SYSTEM_PROMPT = (
    "You are a stock trading agent. Your task is to extract the stock symbol, action (buy/sell), "
    "and quantity from a user's natural language input. Respond ONLY with a JSON object like this: \n"
    "{\"stock\": \"AAPL\", \"action\": \"buy\", \"quantity\": 10}"
)

AUDIT_SYSTEM_PROMPT = (
    "You are an auditing agent. You are given a user input and the trading agent's response."
    " Your task is to verify whether the agent performed the correct trade."
    " Respond with a JSON object: {\"audit_result\": \"pass\" or \"fail\", \"reason\": \"...\"}"
)

# Trader Agent (A2A compliant)
class TraderAgent(A2AServer):
    def handle_message(self, message: Message) -> Message:
        user_input = message.content.text
        logging.info("TraderAgent received: %s", user_input)

        parsed_json = call_llm(user_input, system=TRADER_SYSTEM_PROMPT)
        try:
            trade = json.loads(parsed_json)
            result = execute_trade(trade['stock'], trade['action'], int(trade['quantity']))
        except Exception as e:
            result = {"status": "error", "message": str(e)}

        response_text = json.dumps({
            "user_input": user_input,
            "llm_trade_parse": parsed_json,
            "trade_result": result["message"]
        })

        return Message(
            content=TextContent(text=response_text),
            role=MessageRole.AGENT,
            parent_message_id=message.message_id,
            conversation_id=message.conversation_id
        )

# Audit Agent (A2A compliant)
class AuditAgent(A2AServer):
    def handle_message(self, message: Message) -> Message:
        logging.info("AuditAgent received audit request")
        try:
            payload = json.loads(message.content.text)
            user_input = payload['user_input']
            llm_output = payload['llm_trade_parse']
            trade_result = payload['trade_result']

            audit_input = (
                f"User input: {user_input}\n"
                f"Trade parsing: {llm_output}\n"
                f"Trade execution result: {trade_result}"
            )
            audit_response = call_llm(audit_input, system=AUDIT_SYSTEM_PROMPT)
            audit_json = json.loads(audit_response)
        except Exception as e:
            audit_json = {"audit_result": "error", "reason": str(e)}

        return Message(
            content=TextContent(text=json.dumps(audit_json)),
            role=MessageRole.AGENT,
            parent_message_id=message.message_id,
            conversation_id=message.conversation_id
        )

# Manual test using A2A protocol
if __name__ == "__main__":
    from threading import Thread

    def run_trader():
        trader_agent = TraderAgent()
        run_server(trader_agent, host="0.0.0.0", port=5001)

    def run_auditor():
        audit_agent = AuditAgent()
        run_server(audit_agent, host="0.0.0.0", port=5002)

    Thread(target=run_trader, daemon=True).start()
    Thread(target=run_auditor, daemon=True).start()

    import time
    time.sleep(2)  # allow servers to start

    # Send message to TraderAgent
    trader_client = A2AClient("http://127.0.0.1:5001/a2a")
    trade_msg = Message(content=TextContent(text="Buy 30 shares of MSFT"), role=MessageRole.USER)
    trade_response = trader_client.send_message(trade_msg)
    print("Trader Response:", trade_response.content.text)

    # Send message to AuditAgent
    audit_client = A2AClient("http://127.0.0.1:5002/a2a")
    audit_msg = Message(content=TextContent(text=trade_response.content.text), role=MessageRole.AGENT)
    audit_response = audit_client.send_message(audit_msg)
    print("Audit Response:", audit_response.content.text)
