#!/usr/bin/env python3
"""
Real Blockchain JSON-RPC Server for 5470 Network
Provides Bitcoin Core-style RPC interface with real blockchain functionality
"""

import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from typing import Dict, Any, List, Optional
import sys
import os

# Add core directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from blockchain import RealBlockchain, Transaction

class RealBlockchainRPCServer:
    """JSON-RPC server with real blockchain functionality"""
    
    def __init__(self, port: int = 5470):
        self.port = port
        self.blockchain = RealBlockchain("blockchain_data")
        self.server = None
        self.server_thread = None
        self.running = False
        
        # Generate a default mining address if needed
        self.default_mining_address = "0x742d35Cc6635C0532925a3b8D2c23a12D2c53f15"
    
    def start(self):
        """Start the RPC server"""
        if self.running:
            return
        
        self.running = True
        handler = lambda *args: RPCRequestHandler(self.blockchain, *args)
        self.server = HTTPServer(('0.0.0.0', self.port), handler)
        
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()
        
        print(f"🚀 Real Blockchain RPC Server started on port {self.port}")
        print(f"📡 Blockchain has {len(self.blockchain.chain)} blocks")
    
    def stop(self):
        """Stop the RPC server"""
        if not self.running:
            return
            
        self.running = False
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        
        if self.server_thread:
            self.server_thread.join(timeout=5)
        
        # Stop mining
        self.blockchain.stop_mining()
        print("🛑 Real Blockchain RPC Server stopped")

class RPCRequestHandler(BaseHTTPRequestHandler):
    """Handle JSON-RPC requests for real blockchain"""
    
    def __init__(self, blockchain: RealBlockchain, *args, **kwargs):
        self.blockchain = blockchain
        super().__init__(*args, **kwargs)
    
    def log_message(self, format, *args):
        """Suppress default HTTP logging"""
        pass
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle JSON-RPC POST requests"""
        try:
            # Read request data
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            # Parse JSON-RPC request
            try:
                request = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_error_response(-32700, "Parse error")
                return
            
            method = request.get('method')
            params = request.get('params', [])
            request_id = request.get('id', 1)
            
            # Process RPC method
            try:
                result = self.process_rpc_method(method, params)
                self.send_success_response(result, request_id)
            except Exception as e:
                self.send_error_response(-32603, str(e), request_id)
                
        except Exception as e:
            self.send_error_response(-32603, f"Internal error: {e}")
    
    def do_GET(self):
        """Handle GET requests for basic endpoints"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = json.dumps({"status": "ok", "blocks": len(self.blockchain.chain)})
            self.wfile.write(response.encode())
        else:
            self.send_error(404)
    
    def process_rpc_method(self, method: str, params: List) -> Any:
        """Process individual RPC methods"""
        
        if method == 'getinfo':
            return {
                "version": "5470-real-1.0.0",
                "blocks": len(self.blockchain.chain),
                "difficulty": self.blockchain.difficulty,
                "mining": self.blockchain.mining_active,
                "balance": sum(self.blockchain.balances.values()),
                "connections": len(self.blockchain.peers)
            }
        
        elif method == 'getblockcount':
            return len(self.blockchain.chain) - 1
        
        elif method == 'getbestblockhash':
            return self.blockchain.get_latest_block().hash if self.blockchain.chain else ""
        
        elif method == 'getblock':
            if not params or len(params) < 1:
                raise Exception("Missing block hash parameter")
            
            block_hash = params[0]
            for block in self.blockchain.chain:
                if block.hash == block_hash:
                    return {
                        "hash": block.hash,
                        "index": block.index,
                        "timestamp": block.timestamp,
                        "previous_hash": block.previous_hash,
                        "nonce": block.nonce,
                        "difficulty": block.difficulty,
                        "merkle_root": block.merkle_root,
                        "transactions": [
                            {
                                "hash": tx.tx_hash,
                                "from": tx.from_address,
                                "to": tx.to_address,
                                "amount": tx.amount,
                                "timestamp": tx.timestamp
                            } for tx in block.transactions
                        ]
                    }
            raise Exception(f"Block not found: {block_hash}")
        
        elif method == 'startmining':
            mining_address = params[0] if params else "0x742d35Cc6635C0532925a3b8D2c23a12D2c53f15"
            if not self.blockchain.mining_active:
                self.blockchain.start_mining(mining_address)
                return {"status": "Mining started", "address": mining_address}
            return {"status": "Already mining"}
        
        elif method == 'stopmining':
            if self.blockchain.mining_active:
                self.blockchain.stop_mining()
                return {"status": "Mining stopped"}
            return {"status": "Not mining"}
        
        elif method == 'getbalance':
            address = params[0] if params else None
            if address:
                return self.blockchain.get_balance(address)
            else:
                return sum(self.blockchain.balances.values())
        
        elif method == 'sendtoaddress':
            if len(params) < 3:
                raise Exception("Missing parameters: from_address, to_address, amount")
            
            from_addr, to_addr, amount = params[0], params[1], float(params[2])
            
            tx = Transaction(
                from_address=from_addr,
                to_address=to_addr,
                amount=amount,
                timestamp=time.time()
            )
            
            if self.blockchain.add_transaction(tx):
                return {"txid": tx.tx_hash, "status": "Transaction added to pool"}
            else:
                raise Exception("Transaction failed - insufficient balance or invalid")
        
        elif method == 'getmempoolinfo':
            return {
                "size": len(self.blockchain.pending_transactions),
                "transactions": [
                    {
                        "hash": tx.tx_hash,
                        "from": tx.from_address,
                        "to": tx.to_address,
                        "amount": tx.amount
                    } for tx in self.blockchain.pending_transactions
                ]
            }
        
        elif method == 'generate':
            # Mine a specified number of blocks
            blocks_to_mine = params[0] if params else 1
            mining_address = params[1] if len(params) > 1 else "0x742d35Cc6635C0532925a3b8D2c23a12D2c53f15"
            
            mined_blocks = []
            for i in range(blocks_to_mine):
                new_block = self.blockchain.mine_pending_transactions(mining_address)
                mined_blocks.append(new_block.hash)
            
            return {"blocks_mined": len(mined_blocks), "hashes": mined_blocks}
        
        elif method == 'getstats':
            return self.blockchain.get_blockchain_stats()
        
        elif method == 'validatechain':
            return {"valid": self.blockchain.is_chain_valid()}
        
        else:
            raise Exception(f"Unknown method: {method}")
    
    def send_success_response(self, result: Any, request_id: int = 1):
        """Send successful JSON-RPC response"""
        response = {
            "jsonrpc": "2.0",
            "result": result,
            "id": request_id
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response_data = json.dumps(response, default=str)
        self.wfile.write(response_data.encode())
    
    def send_error_response(self, code: int, message: str, request_id: int = 1):
        """Send error JSON-RPC response"""
        response = {
            "jsonrpc": "2.0",
            "error": {
                "code": code,
                "message": message
            },
            "id": request_id
        }
        
        self.send_response(200)  # HTTP 200 even for RPC errors
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response_data = json.dumps(response)
        self.wfile.write(response_data.encode())

# Global RPC server instance
rpc_server = None

def start_real_blockchain_rpc():
    """Start the real blockchain RPC server"""
    global rpc_server
    if rpc_server is None:
        rpc_server = RealBlockchainRPCServer(5470)
        rpc_server.start()
    return rpc_server

def stop_real_blockchain_rpc():
    """Stop the real blockchain RPC server"""
    global rpc_server
    if rpc_server:
        rpc_server.stop()
        rpc_server = None

if __name__ == "__main__":
    import signal
    
    # Start the RPC server
    server = start_real_blockchain_rpc()
    
    def signal_handler(sig, frame):
        print("\n🛑 Shutting down RPC server...")
        stop_real_blockchain_rpc()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("✅ Real Blockchain RPC server running. Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_real_blockchain_rpc()