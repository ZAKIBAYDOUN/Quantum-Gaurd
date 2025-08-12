#!/usr/bin/env python3
"""
5470 Seed Node Server - Runs on VPS with public IP
Handles incoming P2P connections and peer discovery
"""

import asyncio
import websockets
import json
import socket
import threading
import time
from typing import Set, Dict, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SeedNodeServer:
    def __init__(self, host='0.0.0.0', port=5470, p2p_port=8333):
        self.host = host
        self.port = port
        self.p2p_port = p2p_port
        self.connected_peers: Set[websockets.WebSocketServerProtocol] = set()
        self.peer_info: Dict[str, Dict] = {}
        self.node_id = f"seed_{socket.gethostname()}_{int(time.time())}"
        self.public_ip = self.get_public_ip()
        
        # Network stats
        self.start_time = time.time()
        self.total_connections = 0
        self.messages_relayed = 0
        
    def get_public_ip(self) -> str:
        """Get public IP of the server"""
        try:
            import requests
            response = requests.get('https://api.ipify.org?format=json', timeout=5)
            return response.json()['ip']
        except:
            return socket.gethostbyname(socket.gethostname())
    
    async def register_peer(self, websocket, path):
        """Register new peer connection"""
        peer_ip = websocket.remote_address[0]
        peer_port = websocket.remote_address[1]
        peer_id = f"{peer_ip}:{peer_port}"
        
        logger.info(f"🔗 New peer connecting: {peer_id}")
        
        self.connected_peers.add(websocket)
        self.peer_info[peer_id] = {
            "ip": peer_ip,
            "port": peer_port,
            "connected_at": time.time(),
            "last_seen": time.time(),
            "messages": 0,
            "version": "unknown"
        }
        
        self.total_connections += 1
        
        try:
            # Send welcome message
            welcome_msg = {
                "type": "welcome",
                "node_id": self.node_id,
                "public_ip": self.public_ip,
                "peer_count": len(self.connected_peers),
                "uptime": int(time.time() - self.start_time)
            }
            await websocket.send(json.dumps(welcome_msg))
            
            # Send current peer list
            peer_list = {
                "type": "peer_list", 
                "peers": [
                    {
                        "ip": info["ip"],
                        "port": info["port"], 
                        "last_seen": info["last_seen"]
                    }
                    for info in self.peer_info.values()
                ]
            }
            await websocket.send(json.dumps(peer_list))
            
            # Handle messages from this peer
            async for message in websocket:
                await self.handle_peer_message(websocket, peer_id, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Peer disconnected: {peer_id}")
        except Exception as e:
            logger.error(f"❌ Error handling peer {peer_id}: {e}")
        finally:
            # Clean up when peer disconnects
            self.connected_peers.discard(websocket)
            if peer_id in self.peer_info:
                del self.peer_info[peer_id]
    
    async def handle_peer_message(self, websocket, peer_id: str, message: str):
        """Handle incoming message from peer"""
        try:
            data = json.loads(message)
            msg_type = data.get("type", "unknown")
            
            # Update peer stats
            if peer_id in self.peer_info:
                self.peer_info[peer_id]["last_seen"] = time.time()
                self.peer_info[peer_id]["messages"] += 1
            
            logger.info(f"📨 Received {msg_type} from {peer_id}")
            
            if msg_type == "ping":
                # Respond to ping
                pong = {"type": "pong", "timestamp": time.time()}
                await websocket.send(json.dumps(pong))
                
            elif msg_type == "peer_request":
                # Send updated peer list
                await self.send_peer_list(websocket)
                
            elif msg_type == "announce":
                # Peer is announcing itself
                if peer_id in self.peer_info:
                    self.peer_info[peer_id]["version"] = data.get("version", "unknown")
                    self.peer_info[peer_id]["node_type"] = data.get("node_type", "peer")
                
            elif msg_type == "block_announce":
                # Relay block announcement to other peers
                await self.relay_to_peers(data, exclude=websocket)
                self.messages_relayed += 1
                
            elif msg_type == "transaction":
                # Relay transaction to other peers
                await self.relay_to_peers(data, exclude=websocket)
                self.messages_relayed += 1
                
        except json.JSONDecodeError:
            logger.warning(f"⚠️  Invalid JSON from {peer_id}: {message[:100]}")
        except Exception as e:
            logger.error(f"❌ Error processing message from {peer_id}: {e}")
    
    async def send_peer_list(self, websocket):
        """Send current peer list to requesting peer"""
        peer_list = {
            "type": "peer_list",
            "peers": [
                {
                    "ip": info["ip"],
                    "port": self.port,  # Assume same port
                    "last_seen": info["last_seen"],
                    "version": info.get("version", "unknown")
                }
                for info in self.peer_info.values()
            ],
            "seed_info": {
                "public_ip": self.public_ip,
                "uptime": int(time.time() - self.start_time),
                "total_connections": self.total_connections,
                "messages_relayed": self.messages_relayed
            }
        }
        await websocket.send(json.dumps(peer_list))
    
    async def relay_to_peers(self, message: Dict, exclude=None):
        """Relay message to all connected peers except sender"""
        if not self.connected_peers:
            return
            
        message_str = json.dumps(message)
        dead_peers = set()
        
        for peer in self.connected_peers.copy():
            if peer != exclude:
                try:
                    await peer.send(message_str)
                except websockets.exceptions.ConnectionClosed:
                    dead_peers.add(peer)
                except Exception as e:
                    logger.warning(f"⚠️  Error relaying to peer: {e}")
                    dead_peers.add(peer)
        
        # Clean up dead connections
        for peer in dead_peers:
            self.connected_peers.discard(peer)
    
    def start_http_server(self):
        """Start HTTP server for monitoring and peer info"""
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import urllib.parse
        
        class SeedNodeHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/peers' or self.path == '/getpeerinfo':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    peer_info = {
                        "total_peers": len(server.connected_peers),
                        "peers": [
                            {
                                "addr": f"{info['ip']}:{info['port']}",
                                "connected_time": int(time.time() - info['connected_at']),
                                "last_seen": int(time.time() - info['last_seen']),
                                "version": info.get('version', 'unknown'),
                                "messages": info.get('messages', 0)
                            }
                            for info in server.peer_info.values()
                        ],
                        "seed_stats": {
                            "public_ip": server.public_ip,
                            "uptime": int(time.time() - server.start_time),
                            "total_connections": server.total_connections,
                            "messages_relayed": server.messages_relayed
                        }
                    }
                    
                    self.wfile.write(json.dumps(peer_info, indent=2).encode())
                    
                elif self.path == '/status':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    status = {
                        "node_id": server.node_id,
                        "public_ip": server.public_ip,
                        "port": server.port,
                        "uptime": int(time.time() - server.start_time),
                        "connected_peers": len(server.connected_peers),
                        "status": "online"
                    }
                    
                    self.wfile.write(json.dumps(status, indent=2).encode())
                    
                else:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"Endpoint not found")
            
            def log_message(self, format, *args):
                pass  # Suppress HTTP logs
        
        server = self
        http_server = HTTPServer(('0.0.0.0', 8080), SeedNodeHandler)
        
        def run_http():
            logger.info(f"📊 HTTP monitoring server started on port 8080")
            logger.info(f"🔍 Check peers: http://{self.public_ip}:8080/peers")
            http_server.serve_forever()
        
        http_thread = threading.Thread(target=run_http)
        http_thread.daemon = True
        http_thread.start()
    
    async def periodic_cleanup(self):
        """Periodically clean up stale connections"""
        while True:
            await asyncio.sleep(60)  # Run every minute
            
            current_time = time.time()
            stale_peers = []
            
            for peer_id, info in self.peer_info.items():
                if current_time - info["last_seen"] > 300:  # 5 minutes
                    stale_peers.append(peer_id)
            
            for peer_id in stale_peers:
                logger.info(f"🧹 Cleaning up stale peer: {peer_id}")
                del self.peer_info[peer_id]
    
    async def start_server(self):
        """Start the seed node server"""
        logger.info(f"🌱 Starting 5470 Seed Node Server")
        logger.info(f"🌐 Public IP: {self.public_ip}")
        logger.info(f"🔌 WebSocket Port: {self.port}")
        logger.info(f"📊 HTTP Monitor: 8080")
        
        # Start HTTP monitoring server
        self.start_http_server()
        
        # Start periodic cleanup
        asyncio.create_task(self.periodic_cleanup())
        
        # Start WebSocket server
        server = await websockets.serve(
            self.register_peer, 
            self.host, 
            self.port,
            ping_interval=30,
            ping_timeout=10
        )
        
        logger.info(f"✅ Seed node server started on {self.host}:{self.port}")
        logger.info("🔍 Test connectivity:")
        logger.info(f"   curl http://{self.public_ip}:8080/peers")
        logger.info(f"   curl http://{self.public_ip}:8080/status")
        
        await server.wait_closed()

def main():
    server = SeedNodeServer()
    
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Seed node server stopped")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()