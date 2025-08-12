#!/usr/bin/env python3
"""
Simple HTTP API wrapper for decentralized P2P nodes
Provides REST endpoints for each node
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import threading
import time
from urllib.parse import urlparse, parse_qs

class NodeAPIHandler(BaseHTTPRequestHandler):
    """HTTP API handler for P2P nodes"""
    
    def __init__(self, node, *args, **kwargs):
        self.node = node
        super().__init__(*args, **kwargs)
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            # Parse URL
            parsed_path = urlparse(self.path)
            path_parts = parsed_path.path.strip('/').split('/')
            
            if len(path_parts) >= 2 and path_parts[0] == 'api':
                method = path_parts[1]
                
                # Read request body
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                
                try:
                    request_data = json.loads(post_data.decode('utf-8'))
                    params = request_data.get('params', [])
                except (json.JSONDecodeError, UnicodeDecodeError):
                    params = []
                
                # Route to appropriate method
                response_data = self.handle_api_method(method, params)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                response_json = json.dumps(response_data)
                self.wfile.write(response_json.encode('utf-8'))
                
            else:
                self.send_error(404, "API endpoint not found")
                
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            parsed_path = urlparse(self.path)
            path_parts = parsed_path.path.strip('/').split('/')
            
            if len(path_parts) >= 2 and path_parts[0] == 'api':
                method = path_parts[1]
                response_data = self.handle_api_method(method, [])
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response_json = json.dumps(response_data)
                self.wfile.write(response_json.encode('utf-8'))
                
            else:
                self.send_error(404, "API endpoint not found")
                
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def handle_api_method(self, method: str, params: list):
        """Handle specific API method calls"""
        
        if method == 'getstats':
            return self.node.get_node_stats()
            
        elif method == 'getinfo':
            stats = self.node.get_node_stats()
            return {
                'version': stats['version'],
                'blocks': stats['blocks'], 
                'difficulty': stats['difficulty'],
                'mining': stats['mining'],
                'balance': stats['balance'],
                'connections': stats['connections']
            }
            
        elif method == 'start_mining':
            address = params[0] if params else self.node.mining_address
            result = self.node.start_mining()
            return result
            
        elif method == 'stop_mining':
            result = self.node.stop_mining()
            return result
            
        elif method == 'getbalance':
            address = params[0] if params else self.node.mining_address
            balance = self.node.blockchain.get_balance(address)
            return {'balance': balance, 'address': address}
            
        elif method == 'sendtransaction':
            # Handle transaction sending
            if len(params) >= 3:
                from_addr, to_addr, amount = params[:3]
                # This would create and broadcast a transaction
                return {
                    'success': True,
                    'message': f'Transaction sent: {amount} from {from_addr} to {to_addr}',
                    'txhash': f'tx_{int(time.time())}'
                }
            else:
                return {'error': 'Invalid parameters for sendtransaction'}
        
        elif method == 'getnewaddress':
            # Generate new address
            import hashlib
            new_address = '0x' + hashlib.sha256(f'{time.time()}'.encode()).hexdigest()[:40]
            return {'address': new_address}
            
        elif method == 'getpeerinfo':
            peers = []
            for peer_id, peer in self.node.peers.items():
                peers.append({
                    'id': peer_id,
                    'addr': f"{peer.address}:{peer.port}",
                    'connected': peer.connected,
                    'last_seen': peer.last_seen
                })
            return {'peers': peers}
        
        else:
            return {'error': f'Unknown method: {method}'}
    
    def log_message(self, format, *args):
        """Suppress default HTTP server logging"""
        return

def start_node_api(node, api_port: int):
    """Start HTTP API server for a node"""
    def handler(*args, **kwargs):
        return NodeAPIHandler(node, *args, **kwargs)
    
    server = HTTPServer(('0.0.0.0', api_port), handler)
    
    def run_server():
        print(f"🌐 Node API server started on port {api_port}")
        try:
            server.serve_forever()
        except Exception as e:
            print(f"❌ API server error on port {api_port}: {e}")
    
    api_thread = threading.Thread(target=run_server)
    api_thread.daemon = True
    api_thread.start()
    
    return server