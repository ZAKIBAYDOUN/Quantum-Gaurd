#!/usr/bin/env python3
"""
Decentralized P2P Node Implementation for 5470 Blockchain
Bitcoin Core-style independent node with true consensus
"""

import asyncio
import json
import time
import hashlib
import socket
import threading
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, asdict
import random
import os
from blockchain import RealBlockchain, Block, Transaction
from dns_seeds import DNSSeedManager, PeerNode, initialize_massive_network

@dataclass
class PeerInfo:
    """Information about a peer node"""
    address: str
    port: int
    version: str = "5470-core-1.0.0"
    last_seen: float = 0
    blocks: int = 0
    connected: bool = False

class DecentralizedNode:
    """Fully decentralized P2P node like Bitcoin Core"""
    
    def __init__(self, port: int = 5000, data_dir: str = "node_data", max_peers: int = 100000):
        self.port = port
        self.data_dir = data_dir
        self.node_id = hashlib.sha256(f"{port}{time.time()}".encode()).hexdigest()[:16]
        self.max_peers = max_peers
        
        # Initialize blockchain
        self.blockchain = RealBlockchain(os.path.join(data_dir, "blockchain"))
        
        # P2P networking with massive scaling
        self.peers: Dict[str, PeerInfo] = {}
        self.connections: Dict[str, socket.socket] = {}
        self.server_socket = None
        self.running = False
        
        # DNS Seed Manager for massive P2P
        self.dns_manager = DNSSeedManager(max_peers=max_peers, local_port=port)
        
        # Mining
        self.mining = False
        self.mining_address = "0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18"
        self.mining_thread = None
        
        # Consensus
        self.mempool: List[Transaction] = []
        self.sync_in_progress = False
        
        os.makedirs(data_dir, exist_ok=True)
        self.load_peers()
    
    async def _initialize_massive_p2p(self):
        """Initialize massive P2P network with DNS seeds"""
        print("🌐 Initializing massive P2P network...")
        await self.dns_manager.start_peer_management()
        print(f"✅ Massive P2P network initialized (Capacity: {self.max_peers:,})")
    
    def start_node(self):
        """Start the decentralized node with massive P2P capacity"""
        print(f"🚀 Starting decentralized 5470 node on port {self.port}")
        print(f"📄 Node ID: {self.node_id}")
        print(f"💾 Data directory: {self.data_dir}")
        print(f"🌐 Max peers: {self.max_peers:,}")
        
        self.running = True
        
        # Start P2P server
        self.server_thread = threading.Thread(target=self.start_p2p_server)
        self.server_thread.daemon = True
        self.server_thread.start()
        
        # Initialize massive P2P network
        asyncio.run(self._initialize_massive_p2p())
        
        # Start periodic tasks
        self.start_periodic_tasks()
        
        print(f"✅ Decentralized node {self.node_id} is running!")
        print(f"🌐 P2P Server: {self.get_node_address()}")
        print(f"📊 Blockchain height: {len(self.blockchain.blocks)}")
    
    def start_p2p_server(self):
        """Start P2P listening server"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind(('0.0.0.0', self.port))
            self.server_socket.listen(10)
            
            print(f"🌐 P2P server listening on port {self.port}")
            
            while self.running:
                try:
                    client_socket, address = self.server_socket.accept()
                    peer_thread = threading.Thread(
                        target=self.handle_peer_connection, 
                        args=(client_socket, address)
                    )
                    peer_thread.daemon = True
                    peer_thread.start()
                    
                except Exception as e:
                    if self.running:  # Only log if we're still running
                        print(f"⚠️ P2P server error: {e}")
                        
        except Exception as e:
            print(f"❌ Failed to start P2P server: {e}")
    
    def handle_peer_connection(self, client_socket: socket.socket, address):
        """Handle incoming peer connection"""
        peer_id = f"{address[0]}:{address[1]}"
        print(f"🤝 New peer connected: {peer_id}")
        
        try:
            # Add to connections
            self.connections[peer_id] = client_socket
            
            # Update peer info
            if peer_id not in self.peers:
                self.peers[peer_id] = PeerInfo(
                    address=address[0],
                    port=address[1],
                    last_seen=time.time(),
                    connected=True
                )
            else:
                self.peers[peer_id].connected = True
                self.peers[peer_id].last_seen = time.time()
            
            # Handle messages
            while self.running:
                try:
                    data = client_socket.recv(4096).decode('utf-8')
                    if not data:
                        break
                        
                    message = json.loads(data)
                    self.handle_peer_message(peer_id, message)
                    
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    print(f"⚠️ Peer message error from {peer_id}: {e}")
                    break
                    
        except Exception as e:
            print(f"❌ Peer connection error with {peer_id}: {e}")
        finally:
            # Clean up connection
            try:
                client_socket.close()
            except:
                pass
            
            if peer_id in self.connections:
                del self.connections[peer_id]
            
            if peer_id in self.peers:
                self.peers[peer_id].connected = False
            
            print(f"👋 Peer disconnected: {peer_id}")
    
    def handle_peer_message(self, peer_id: str, message: Dict):
        """Handle message from peer"""
        msg_type = message.get('type')
        
        if msg_type == 'ping':
            self.send_to_peer(peer_id, {'type': 'pong', 'timestamp': time.time()})
            
        elif msg_type == 'get_blocks':
            start_height = message.get('start_height', 0)
            blocks_data = []
            
            for i, block in enumerate(self.blockchain.blocks[start_height:start_height + 10]):
                blocks_data.append(asdict(block))
            
            self.send_to_peer(peer_id, {
                'type': 'blocks',
                'blocks': blocks_data,
                'height': len(self.blockchain.blocks)
            })
            
        elif msg_type == 'blocks':
            self.process_received_blocks(message.get('blocks', []))
            
        elif msg_type == 'new_block':
            self.process_new_block(message.get('block'))
            
        elif msg_type == 'transaction':
            self.process_received_transaction(message.get('transaction'))
            
        elif msg_type == 'get_peers':
            peer_list = [
                {'address': peer.address, 'port': peer.port} 
                for peer in self.peers.values() 
                if peer.connected
            ]
            self.send_to_peer(peer_id, {'type': 'peers', 'peers': peer_list})
    
    def send_to_peer(self, peer_id: str, message: Dict):
        """Send message to specific peer"""
        if peer_id in self.connections:
            try:
                data = json.dumps(message).encode('utf-8')
                self.connections[peer_id].send(data)
                return True
            except Exception as e:
                print(f"❌ Failed to send to {peer_id}: {e}")
                return False
        return False
    
    def broadcast_to_peers(self, message: Dict):
        """Broadcast message to all connected peers"""
        sent_count = 0
        for peer_id in list(self.connections.keys()):
            if self.send_to_peer(peer_id, message):
                sent_count += 1
        return sent_count
    
    def connect_to_peers(self):
        """Connect to known peers"""
        default_peers = [
            ("127.0.0.1", 5001),
            ("127.0.0.1", 5002),
            ("127.0.0.1", 5003),
        ]
        
        for address, port in default_peers:
            if port != self.port:  # Don't connect to ourselves
                self.connect_to_peer(address, port)
    
    def connect_to_peer(self, address: str, port: int):
        """Connect to a specific peer"""
        peer_id = f"{address}:{port}"
        
        if peer_id in self.connections:
            return  # Already connected
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5.0)  # 5 second timeout
            sock.connect((address, port))
            
            self.connections[peer_id] = sock
            self.peers[peer_id] = PeerInfo(
                address=address,
                port=port,
                last_seen=time.time(),
                connected=True
            )
            
            print(f"🔗 Connected to peer: {peer_id}")
            
            # Start handling this connection
            peer_thread = threading.Thread(
                target=self.handle_outgoing_peer, 
                args=(sock, peer_id)
            )
            peer_thread.daemon = True
            peer_thread.start()
            
            # Send initial sync request
            self.send_to_peer(peer_id, {
                'type': 'get_blocks',
                'start_height': len(self.blockchain.blocks)
            })
            
        except Exception as e:
            print(f"❌ Failed to connect to {peer_id}: {e}")
    
    def handle_outgoing_peer(self, sock: socket.socket, peer_id: str):
        """Handle outgoing peer connection"""
        try:
            while self.running:
                try:
                    data = sock.recv(4096).decode('utf-8')
                    if not data:
                        break
                        
                    message = json.loads(data)
                    self.handle_peer_message(peer_id, message)
                    
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    print(f"⚠️ Outgoing peer error with {peer_id}: {e}")
                    break
                    
        except Exception as e:
            print(f"❌ Outgoing peer connection error with {peer_id}: {e}")
        finally:
            try:
                sock.close()
            except:
                pass
            
            if peer_id in self.connections:
                del self.connections[peer_id]
            
            if peer_id in self.peers:
                self.peers[peer_id].connected = False
    
    def start_mining(self) -> Dict:
        """Start mining blocks"""
        if self.mining:
            return {"status": "Already mining"}
        
        self.mining = True
        self.mining_thread = threading.Thread(target=self.mining_loop)
        self.mining_thread.daemon = True
        self.mining_thread.start()
        
        print(f"⛏️ Started mining to address: {self.mining_address}")
        return {
            "status": "Mining started",
            "address": self.mining_address,
            "node_id": self.node_id
        }
    
    def stop_mining(self) -> Dict:
        """Stop mining"""
        self.mining = False
        print("🛑 Mining stopped")
        return {"status": "Mining stopped"}
    
    def mining_loop(self):
        """Main mining loop"""
        while self.mining and self.running:
            try:
                # Create new block
                new_block = self.blockchain.create_block(
                    transactions=self.mempool[:10],  # Max 10 transactions per block
                    mining_address=self.mining_address
                )
                
                # Mine the block
                if self.blockchain.mine_block(new_block):
                    print(f"🎉 Block {new_block.index} mined by node {self.node_id}!")
                    
                    # Clear processed transactions from mempool
                    for tx in new_block.transactions:
                        if tx in self.mempool:
                            self.mempool.remove(tx)
                    
                    # Broadcast new block to peers
                    self.broadcast_to_peers({
                        'type': 'new_block',
                        'block': asdict(new_block),
                        'node_id': self.node_id
                    })
                    
                time.sleep(1)  # Small delay between mining attempts
                
            except Exception as e:
                print(f"❌ Mining error: {e}")
                time.sleep(5)
    
    def process_new_block(self, block_data: Dict):
        """Process new block received from peer"""
        try:
            # Reconstruct block object
            transactions = [Transaction(**tx) for tx in block_data.get('transactions', [])]
            block = Block(
                index=block_data['index'],
                timestamp=block_data['timestamp'],
                transactions=transactions,
                previous_hash=block_data['previous_hash'],
                nonce=block_data.get('nonce', 0),
                hash=block_data.get('hash', '')
            )
            
            # Validate and add block
            if self.blockchain.add_block(block):
                print(f"✅ Accepted new block {block.index} from peer")
                
                # Remove transactions from mempool
                for tx in transactions:
                    if tx in self.mempool:
                        self.mempool.remove(tx)
                        
                return True
            else:
                print(f"❌ Rejected invalid block {block.index}")
                return False
                
        except Exception as e:
            print(f"❌ Error processing new block: {e}")
            return False
    
    def process_received_blocks(self, blocks_data: List[Dict]):
        """Process blocks received from peer during sync"""
        for block_data in blocks_data:
            self.process_new_block(block_data)
    
    def process_received_transaction(self, tx_data: Dict):
        """Process transaction received from peer"""
        try:
            transaction = Transaction(**tx_data)
            
            # Validate transaction
            if self.blockchain.validate_transaction(transaction):
                if transaction not in self.mempool:
                    self.mempool.append(transaction)
                    print(f"📥 Added transaction to mempool: {transaction.tx_hash[:16]}...")
                    
                    # Broadcast to other peers
                    self.broadcast_to_peers({
                        'type': 'transaction',
                        'transaction': asdict(transaction)
                    })
                return True
            else:
                print(f"❌ Invalid transaction rejected")
                return False
                
        except Exception as e:
            print(f"❌ Error processing transaction: {e}")
            return False
    
    def start_periodic_tasks(self):
        """Start periodic maintenance tasks"""
        def periodic_worker():
            while self.running:
                try:
                    # Ping peers every 30 seconds
                    self.broadcast_to_peers({'type': 'ping', 'timestamp': time.time()})
                    
                    # Clean up dead connections
                    self.cleanup_dead_peers()
                    
                    # Try to connect to more peers
                    if len(self.get_connected_peers()) < 3:
                        self.discover_peers()
                    
                    time.sleep(30)
                    
                except Exception as e:
                    print(f"⚠️ Periodic task error: {e}")
                    time.sleep(10)
        
        periodic_thread = threading.Thread(target=periodic_worker)
        periodic_thread.daemon = True
        periodic_thread.start()
    
    def cleanup_dead_peers(self):
        """Remove dead peer connections"""
        current_time = time.time()
        dead_peers = []
        
        for peer_id, peer in self.peers.items():
            if current_time - peer.last_seen > 120:  # 2 minutes timeout
                dead_peers.append(peer_id)
        
        for peer_id in dead_peers:
            if peer_id in self.connections:
                try:
                    self.connections[peer_id].close()
                except:
                    pass
                del self.connections[peer_id]
            
            if peer_id in self.peers:
                self.peers[peer_id].connected = False
    
    def discover_peers(self):
        """Discover new peers from existing connections"""
        for peer_id in self.connections:
            self.send_to_peer(peer_id, {'type': 'get_peers'})
    
    def get_connected_peers(self) -> List[str]:
        """Get list of connected peer IDs"""
        return [pid for pid, peer in self.peers.items() if peer.connected]
    
    def get_node_stats(self) -> Dict:
        """Get node statistics"""
        return {
            "node_id": self.node_id,
            "version": "5470-core-1.0.0",
            "port": self.port,
            "blocks": len(self.blockchain.blocks),
            "balance": self.blockchain.get_balance(self.mining_address),
            "difficulty": self.blockchain.difficulty,
            "mining": self.mining,
            "connections": len(self.get_connected_peers()),
            "mempool_size": len(self.mempool),
            "peers": {
                pid: {"connected": peer.connected, "last_seen": peer.last_seen} 
                for pid, peer in self.peers.items()
            }
        }
    
    def get_node_address(self) -> str:
        """Get node network address"""
        return f"127.0.0.1:{self.port}"
    
    def save_peers(self):
        """Save peers to disk"""
        peers_file = os.path.join(self.data_dir, "peers.json")
        try:
            with open(peers_file, 'w') as f:
                json.dump({pid: asdict(peer) for pid, peer in self.peers.items()}, f)
        except Exception as e:
            print(f"❌ Error saving peers: {e}")
    
    def load_peers(self):
        """Load peers from disk"""
        peers_file = os.path.join(self.data_dir, "peers.json")
        try:
            if os.path.exists(peers_file):
                with open(peers_file, 'r') as f:
                    peers_data = json.load(f)
                
                for pid, peer_data in peers_data.items():
                    self.peers[pid] = PeerInfo(**peer_data)
                    self.peers[pid].connected = False  # Start as disconnected
                
                print(f"📂 Loaded {len(self.peers)} known peers")
        except Exception as e:
            print(f"❌ Error loading peers: {e}")
    
    def shutdown(self):
        """Shutdown the node"""
        print(f"🛑 Shutting down node {self.node_id}")
        
        self.running = False
        self.mining = False
        
        # Close all connections
        for sock in self.connections.values():
            try:
                sock.close()
            except:
                pass
        
        # Close server socket
        if self.server_socket:
            try:
                self.server_socket.close()
            except:
                pass
        
        # Save peers
        self.save_peers()
        
        print("✅ Node shutdown complete")

if __name__ == "__main__":
    import sys
    from node_api import start_node_api
    
    # Get port from command line or use default
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    api_port = port + 1000  # API on port 6000, 6001, 6002
    
    # Create and start decentralized node
    node = DecentralizedNode(port=port, data_dir=f"node_data_{port}")
    
    try:
        node.start_node()
        
        # Start HTTP API server
        api_server = start_node_api(node, api_port)
        
        print(f"🌐 HTTP API available at: http://localhost:{api_port}")
        print(f"📊 Example: curl http://localhost:{api_port}/api/getstats")
        
        # Keep running
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Received shutdown signal")
    finally:
        node.shutdown()