#!/usr/bin/env python3
"""
5470 Core Node - Fully Decentralized P2P Implementation
Similar to Bitcoin Core architecture with true P2P networking
"""

import asyncio
import json
import hashlib
import time
import logging
import socket
import threading
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import pickle

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class Transaction:
    from_address: str
    to_address: str
    amount: int
    timestamp: float
    nonce: int
    signature: str = ""
    tx_hash: str = ""
    
    def __post_init__(self):
        if not self.tx_hash:
            self.tx_hash = self.calculate_hash()
    
    def calculate_hash(self) -> str:
        data = f"{self.from_address}{self.to_address}{self.amount}{self.timestamp}{self.nonce}"
        return hashlib.sha256(data.encode()).hexdigest()

@dataclass
class Block:
    index: int
    transactions: List[Transaction]
    previous_hash: str
    timestamp: float
    nonce: int = 0
    hash: str = ""
    
    def __post_init__(self):
        if not self.hash:
            self.hash = self.calculate_hash()
    
    def calculate_hash(self) -> str:
        tx_data = ''.join([tx.tx_hash for tx in self.transactions])
        data = f"{self.index}{tx_data}{self.previous_hash}{self.timestamp}{self.nonce}"
        return hashlib.sha256(data.encode()).hexdigest()

class P2PProtocol:
    """Bitcoin-like P2P Protocol Implementation"""
    
    MSG_VERSION = "version"
    MSG_VERACK = "verack"
    MSG_GETBLOCKS = "getblocks"
    MSG_BLOCKS = "blocks"
    MSG_INV = "inv"
    MSG_TX = "tx"
    MSG_MEMPOOL = "mempool"
    MSG_PING = "ping"
    MSG_PONG = "pong"
    
    def __init__(self, node):
        self.node = node
    
    def create_message(self, command: str, payload: dict) -> bytes:
        """Create P2P message similar to Bitcoin protocol"""
        msg = {
            "magic": "5470",
            "command": command,
            "payload": payload,
            "timestamp": time.time(),
            "version": "1.0.0"
        }
        return pickle.dumps(msg)
    
    def parse_message(self, data: bytes) -> Optional[dict]:
        """Parse incoming P2P message"""
        try:
            return pickle.loads(data)
        except Exception as e:
            logger.error(f"Failed to parse message: {e}")
            return None

class CoreNode:
    """5470 Core Node - Decentralized Bitcoin-like Implementation"""
    
    def __init__(self, port: int = 5470, data_dir: str = "node_data"):
        self.port = port
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Core components
        self.blockchain: List[Block] = []
        self.mempool: List[Transaction] = []
        self.utxo_set: Dict[str, List[Transaction]] = {}
        self.peers: Set[tuple] = set()  # (ip, port)
        self.connections: Dict[tuple, socket.socket] = {}
        
        # Node state
        self.is_running = False
        self.is_mining = False
        self.wallet_address = self.generate_address()
        
        # P2P Protocol
        self.protocol = P2PProtocol(self)
        
        # Initialize with genesis block
        self.create_genesis_block()
        
        logger.info(f"5470 Core Node initialized on port {port}")
        logger.info(f"Node address: {self.wallet_address}")
        logger.info(f"Data directory: {self.data_dir}")
    
    def generate_address(self) -> str:
        """Generate node wallet address"""
        import secrets
        private_key = secrets.token_hex(32)
        # In real implementation, use proper ECDSA
        address = hashlib.sha256(private_key.encode()).hexdigest()[:40]
        return f"5470{address}"
    
    def create_genesis_block(self):
        """Create genesis block like Bitcoin"""
        if not self.blockchain:
            genesis_tx = Transaction(
                from_address="genesis",
                to_address=self.wallet_address,
                amount=50 * 100000000,  # 50 coins in satoshis
                timestamp=time.time(),
                nonce=0
            )
            
            genesis_block = Block(
                index=0,
                transactions=[genesis_tx],
                previous_hash="0" * 64,
                timestamp=time.time()
            )
            
            self.blockchain.append(genesis_block)
            self.save_blockchain()
            logger.info("Genesis block created")
    
    def start_node(self):
        """Start the decentralized node"""
        self.is_running = True
        
        # Start P2P server
        self.p2p_thread = threading.Thread(target=self.start_p2p_server, daemon=True)
        self.p2p_thread.start()
        
        # Start mining if enabled
        self.mining_thread = threading.Thread(target=self.mining_loop, daemon=True)
        self.mining_thread.start()
        
        # Start peer discovery
        self.discovery_thread = threading.Thread(target=self.discover_peers, daemon=True)
        self.discovery_thread.start()
        
        logger.info("5470 Core Node started successfully")
    
    def start_p2p_server(self):
        """Start P2P listening server"""
        try:
            server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_socket.bind(('0.0.0.0', self.port))
            server_socket.listen(10)
            
            logger.info(f"P2P server listening on port {self.port}")
            
            while self.is_running:
                try:
                    client_socket, address = server_socket.accept()
                    peer_thread = threading.Thread(
                        target=self.handle_peer_connection,
                        args=(client_socket, address),
                        daemon=True
                    )
                    peer_thread.start()
                except Exception as e:
                    if self.is_running:
                        logger.error(f"P2P server error: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to start P2P server: {e}")
    
    def handle_peer_connection(self, client_socket: socket.socket, address: tuple):
        """Handle incoming peer connection"""
        logger.info(f"New peer connected: {address}")
        
        try:
            while self.is_running:
                data = client_socket.recv(4096)
                if not data:
                    break
                
                message = self.protocol.parse_message(data)
                if message:
                    self.process_peer_message(client_socket, message, address)
                    
        except Exception as e:
            logger.error(f"Peer connection error with {address}: {e}")
        finally:
            client_socket.close()
            logger.info(f"Peer disconnected: {address}")
    
    def process_peer_message(self, socket: socket.socket, message: dict, address: tuple):
        """Process incoming P2P messages"""
        command = message.get("command")
        payload = message.get("payload", {})
        
        if command == self.protocol.MSG_VERSION:
            # Send version acknowledgment
            response = self.protocol.create_message(self.protocol.MSG_VERACK, {
                "version": "1.0.0",
                "best_height": len(self.blockchain) - 1
            })
            socket.send(response)
            
        elif command == self.protocol.MSG_GETBLOCKS:
            # Send blockchain data
            start_height = payload.get("start_height", 0)
            blocks_data = []
            for i in range(start_height, min(start_height + 500, len(self.blockchain))):
                blocks_data.append(asdict(self.blockchain[i]))
            
            response = self.protocol.create_message(self.protocol.MSG_BLOCKS, {
                "blocks": blocks_data
            })
            socket.send(response)
            
        elif command == self.protocol.MSG_TX:
            # New transaction received
            tx_data = payload.get("transaction")
            if tx_data:
                tx = Transaction(**tx_data)
                if self.validate_transaction(tx):
                    self.mempool.append(tx)
                    self.broadcast_transaction(tx)
                    
        elif command == self.protocol.MSG_BLOCKS:
            # New blocks received
            blocks_data = payload.get("blocks", [])
            for block_data in blocks_data:
                block = Block(
                    index=block_data["index"],
                    transactions=[Transaction(**tx) for tx in block_data["transactions"]],
                    previous_hash=block_data["previous_hash"],
                    timestamp=block_data["timestamp"],
                    nonce=block_data["nonce"],
                    hash=block_data["hash"]
                )
                if self.validate_block(block):
                    self.add_block(block)
                    
        elif command == self.protocol.MSG_PING:
            # Respond to ping
            response = self.protocol.create_message(self.protocol.MSG_PONG, {})
            socket.send(response)
    
    def discover_peers(self):
        """Discover and connect to peers in the network"""
        # Known seed nodes (in real implementation, these would be hardcoded)
        seed_nodes = [
            ("127.0.0.1", 5471),
            ("127.0.0.1", 5472),
            ("127.0.0.1", 5473),
        ]
        
        while self.is_running:
            for peer_ip, peer_port in seed_nodes:
                if (peer_ip, peer_port) not in self.peers and peer_port != self.port:
                    try:
                        self.connect_to_peer(peer_ip, peer_port)
                    except Exception as e:
                        logger.debug(f"Failed to connect to {peer_ip}:{peer_port}: {e}")
            
            time.sleep(30)  # Try to discover peers every 30 seconds
    
    def connect_to_peer(self, ip: str, port: int):
        """Connect to a peer node"""
        try:
            peer_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            peer_socket.settimeout(10)
            peer_socket.connect((ip, port))
            
            # Send version message
            version_msg = self.protocol.create_message(self.protocol.MSG_VERSION, {
                "version": "1.0.0",
                "best_height": len(self.blockchain) - 1,
                "node_id": self.wallet_address
            })
            peer_socket.send(version_msg)
            
            self.peers.add((ip, port))
            self.connections[(ip, port)] = peer_socket
            
            # Start handling this peer
            peer_thread = threading.Thread(
                target=self.handle_peer_connection,
                args=(peer_socket, (ip, port)),
                daemon=True
            )
            peer_thread.start()
            
            logger.info(f"Connected to peer: {ip}:{port}")
            
        except Exception as e:
            logger.debug(f"Failed to connect to peer {ip}:{port}: {e}")
    
    def mining_loop(self):
        """Mining loop similar to Bitcoin Core"""
        while self.is_running:
            if self.is_mining and self.mempool:
                try:
                    new_block = self.mine_block()
                    if new_block:
                        self.add_block(new_block)
                        self.broadcast_block(new_block)
                        logger.info(f"Mined new block #{new_block.index}")
                except Exception as e:
                    logger.error(f"Mining error: {e}")
            
            time.sleep(1)
    
    def mine_block(self) -> Optional[Block]:
        """Mine a new block"""
        if not self.mempool:
            return None
            
        # Select transactions for block
        selected_txs = self.mempool[:10]  # Max 10 transactions per block
        
        # Add coinbase transaction (mining reward)
        coinbase_tx = Transaction(
            from_address="coinbase",
            to_address=self.wallet_address,
            amount=50 * 100000000,  # 50 coins reward
            timestamp=time.time(),
            nonce=0
        )
        
        transactions = [coinbase_tx] + selected_txs
        
        # Create new block
        new_block = Block(
            index=len(self.blockchain),
            transactions=transactions,
            previous_hash=self.blockchain[-1].hash,
            timestamp=time.time()
        )
        
        # Proof of Work (simple implementation)
        target = "0000"  # 4 leading zeros
        while not new_block.hash.startswith(target):
            new_block.nonce += 1
            new_block.hash = new_block.calculate_hash()
        
        # Remove mined transactions from mempool
        for tx in selected_txs:
            if tx in self.mempool:
                self.mempool.remove(tx)
        
        return new_block
    
    def validate_transaction(self, tx: Transaction) -> bool:
        """Validate transaction"""
        # Basic validation (in real implementation, check signatures, balances, etc.)
        return (
            tx.amount > 0 and
            tx.from_address != tx.to_address and
            len(tx.tx_hash) == 64
        )
    
    def validate_block(self, block: Block) -> bool:
        """Validate block"""
        # Basic validation
        if len(self.blockchain) == 0:
            return block.index == 0
            
        last_block = self.blockchain[-1]
        return (
            block.index == last_block.index + 1 and
            block.previous_hash == last_block.hash and
            block.hash.startswith("0000")  # PoW check
        )
    
    def add_block(self, block: Block):
        """Add validated block to blockchain"""
        if self.validate_block(block):
            self.blockchain.append(block)
            self.save_blockchain()
            self.update_utxo_set(block)
    
    def update_utxo_set(self, block: Block):
        """Update UTXO set with new block"""
        for tx in block.transactions:
            # Add new UTXO
            if tx.to_address not in self.utxo_set:
                self.utxo_set[tx.to_address] = []
            self.utxo_set[tx.to_address].append(tx)
            
            # Remove spent UTXOs (simplified)
            if tx.from_address in self.utxo_set and tx.from_address != "coinbase":
                # In real implementation, track specific UTXOs being spent
                pass
    
    def broadcast_transaction(self, tx: Transaction):
        """Broadcast transaction to peers"""
        message = self.protocol.create_message(self.protocol.MSG_TX, {
            "transaction": asdict(tx)
        })
        
        for peer_socket in self.connections.values():
            try:
                peer_socket.send(message)
            except Exception as e:
                logger.error(f"Failed to broadcast transaction: {e}")
    
    def broadcast_block(self, block: Block):
        """Broadcast new block to peers"""
        message = self.protocol.create_message(self.protocol.MSG_BLOCKS, {
            "blocks": [asdict(block)]
        })
        
        for peer_socket in self.connections.values():
            try:
                peer_socket.send(message)
            except Exception as e:
                logger.error(f"Failed to broadcast block: {e}")
    
    def save_blockchain(self):
        """Save blockchain to disk"""
        blockchain_file = self.data_dir / "blockchain.json"
        with open(blockchain_file, 'w') as f:
            json.dump([asdict(block) for block in self.blockchain], f)
    
    def load_blockchain(self):
        """Load blockchain from disk"""
        blockchain_file = self.data_dir / "blockchain.json"
        if blockchain_file.exists():
            with open(blockchain_file, 'r') as f:
                blocks_data = json.load(f)
                self.blockchain = []
                for block_data in blocks_data:
                    block = Block(
                        index=block_data["index"],
                        transactions=[Transaction(**tx) for tx in block_data["transactions"]],
                        previous_hash=block_data["previous_hash"],
                        timestamp=block_data["timestamp"],
                        nonce=block_data["nonce"],
                        hash=block_data["hash"]
                    )
                    self.blockchain.append(block)
    
    def get_balance(self, address: str) -> int:
        """Get address balance from UTXO set"""
        balance = 0
        for tx in self.utxo_set.get(address, []):
            balance += tx.amount
        return balance
    
    def start_mining(self):
        """Start mining"""
        self.is_mining = True
        logger.info("Mining started")
    
    def stop_mining(self):
        """Stop mining"""
        self.is_mining = False
        logger.info("Mining stopped")
    
    def stop_node(self):
        """Stop the node"""
        self.is_running = False
        self.is_mining = False
        
        # Close all peer connections
        for peer_socket in self.connections.values():
            peer_socket.close()
        
        logger.info("5470 Core Node stopped")
    
    def get_node_info(self) -> dict:
        """Get node information"""
        return {
            "version": "1.0.0",
            "port": self.port,
            "address": self.wallet_address,
            "balance": self.get_balance(self.wallet_address),
            "blockchain_height": len(self.blockchain) - 1,
            "mempool_size": len(self.mempool),
            "peer_count": len(self.peers),
            "is_mining": self.is_mining,
            "data_dir": str(self.data_dir)
        }

if __name__ == "__main__":
    import sys
    
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5470
    node = CoreNode(port=port)
    
    try:
        node.load_blockchain()
        node.start_node()
        node.start_mining()
        
        print(f"5470 Core Node running on port {port}")
        print(f"Node address: {node.wallet_address}")
        print("Press Ctrl+C to stop")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping node...")
        node.stop_node()