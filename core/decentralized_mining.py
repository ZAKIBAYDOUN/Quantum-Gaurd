#!/usr/bin/env python3
"""
Truly Decentralized Mining System - No Single Point of Failure
Each mining instance operates independently with P2P consensus
"""

import hashlib
import json
import time
import threading
import os
import random
from blockchain import RealBlockchain, Block, Transaction

class DecentralizedMiner:
    """Independent mining node with P2P consensus"""
    
    def __init__(self, miner_id: str = None, data_dir: str = "decentralized_data"):
        self.miner_id = miner_id or hashlib.sha256(f"{time.time()}{random.random()}".encode()).hexdigest()[:16]
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        
        # Initialize independent blockchain
        self.blockchain = RealBlockchain(os.path.join(data_dir, f"chain_{self.miner_id}"))
        
        # Mining state
        self.mining = False
        self.mining_address = "0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18"
        self.mining_thread = None
        
        # P2P consensus (file-based for true decentralization)
        self.consensus_dir = os.path.join(data_dir, "consensus")
        os.makedirs(self.consensus_dir, exist_ok=True)
        
        print(f"🌐 Decentralized Miner {self.miner_id} initialized")
        print(f"💾 Data: {self.data_dir}")
        print(f"🔗 Consensus: {self.consensus_dir}")
    
    def start_mining(self) -> dict:
        """Start decentralized mining"""
        if self.mining:
            return {"status": "Already mining", "miner_id": self.miner_id}
        
        self.mining = True
        self.mining_thread = threading.Thread(target=self._mining_loop)
        self.mining_thread.daemon = True
        self.mining_thread.start()
        
        # Announce mining to network
        self._announce_mining_start()
        
        print(f"⛏️ Miner {self.miner_id} started mining")
        return {
            "status": "Mining started",
            "miner_id": self.miner_id,
            "address": self.mining_address,
            "decentralized": True
        }
    
    def stop_mining(self) -> dict:
        """Stop decentralized mining"""
        self.mining = False
        self._announce_mining_stop()
        
        print(f"🛑 Miner {self.miner_id} stopped mining")
        return {
            "status": "Mining stopped",
            "miner_id": self.miner_id,
            "decentralized": True
        }
    
    def get_stats(self) -> dict:
        """Get miner statistics"""
        network_miners = self._get_network_miners()
        recent_blocks = self._get_recent_network_blocks()
        
        return {
            "version": "5470-decentralized-1.0.0",
            "miner_id": self.miner_id,
            "blocks": len(self.blockchain.blocks),
            "difficulty": self.blockchain.difficulty,
            "mining": self.mining,
            "balance": self.blockchain.get_balance(self.mining_address),
            "connections": len(network_miners),
            "network_miners": len(network_miners),
            "network_blocks": len(recent_blocks),
            "mempool_size": 0,
            "decentralized": True,
            "consensus_method": "proof_of_work",
            "autonomous": True
        }
    
    def _mining_loop(self):
        """Main mining loop - truly decentralized"""
        while self.mining:
            try:
                # Check network consensus before mining
                network_height = self._get_network_height()
                local_height = len(self.blockchain.blocks)
                
                # Sync with network if behind
                if network_height > local_height:
                    self._sync_with_network()
                
                # Mine new block
                new_block = self.blockchain.create_block(
                    transactions=[],  # Start with empty blocks
                    mining_address=self.mining_address
                )
                
                # Perform Proof of Work
                if self._mine_block_decentralized(new_block):
                    # Announce new block to network
                    self._announce_new_block(new_block)
                    print(f"🎉 Block {new_block.index} mined by {self.miner_id}!")
                
                time.sleep(1)  # Prevent excessive CPU usage
                
            except Exception as e:
                print(f"❌ Mining error in {self.miner_id}: {e}")
                time.sleep(5)
    
    def _mine_block_decentralized(self, block: Block) -> bool:
        """Mine block with decentralized proof of work"""
        target = "0" * self.blockchain.difficulty
        start_time = time.time()
        
        while self.mining and (time.time() - start_time) < 30:  # 30 second timeout
            block.nonce = random.randint(0, 1000000)
            block_string = f"{block.index}{block.timestamp}{block.previous_hash}{block.nonce}"
            block_hash = hashlib.sha256(block_string.encode()).hexdigest()
            
            if block_hash.startswith(target):
                block.hash = block_hash
                
                # Add to local blockchain
                if self.blockchain.add_block(block):
                    return True
            
            # Check if another miner found this block first
            if self._block_exists_in_network(block.index):
                print(f"📊 Block {block.index} already mined by another node")
                return False
        
        return False
    
    def _announce_mining_start(self):
        """Announce mining start to network"""
        announcement = {
            "type": "mining_start",
            "miner_id": self.miner_id,
            "timestamp": time.time(),
            "address": self.mining_address
        }
        
        announcement_file = os.path.join(self.consensus_dir, f"mining_{self.miner_id}.json")
        with open(announcement_file, 'w') as f:
            json.dump(announcement, f)
    
    def _announce_mining_stop(self):
        """Announce mining stop to network"""
        announcement_file = os.path.join(self.consensus_dir, f"mining_{self.miner_id}.json")
        if os.path.exists(announcement_file):
            os.remove(announcement_file)
    
    def _announce_new_block(self, block: Block):
        """Announce new block to network"""
        block_data = {
            "type": "new_block",
            "miner_id": self.miner_id,
            "timestamp": time.time(),
            "block": {
                "index": block.index,
                "timestamp": block.timestamp,
                "previous_hash": block.previous_hash,
                "nonce": block.nonce,
                "hash": block.hash,
                "transactions": []
            }
        }
        
        block_file = os.path.join(self.consensus_dir, f"block_{block.index}_{self.miner_id}.json")
        with open(block_file, 'w') as f:
            json.dump(block_data, f)
    
    def _get_network_miners(self) -> list:
        """Get active miners in network"""
        miners = []
        current_time = time.time()
        
        for filename in os.listdir(self.consensus_dir):
            if filename.startswith("mining_") and filename.endswith(".json"):
                try:
                    with open(os.path.join(self.consensus_dir, filename), 'r') as f:
                        data = json.load(f)
                    
                    # Consider miner active if announcement is recent (< 60 seconds)
                    if current_time - data.get("timestamp", 0) < 60:
                        miners.append(data)
                        
                except Exception:
                    continue
        
        return miners
    
    def _get_network_height(self) -> int:
        """Get highest block height in network"""
        max_height = 0
        
        for filename in os.listdir(self.consensus_dir):
            if filename.startswith("block_") and filename.endswith(".json"):
                try:
                    parts = filename.replace("block_", "").replace(".json", "").split("_")
                    if len(parts) >= 2:
                        height = int(parts[0])
                        max_height = max(max_height, height)
                except Exception:
                    continue
        
        return max_height
    
    def _get_recent_network_blocks(self) -> list:
        """Get recent blocks from network"""
        blocks = []
        
        for filename in os.listdir(self.consensus_dir):
            if filename.startswith("block_") and filename.endswith(".json"):
                try:
                    with open(os.path.join(self.consensus_dir, filename), 'r') as f:
                        data = json.load(f)
                    blocks.append(data)
                except Exception:
                    continue
        
        # Sort by block index
        blocks.sort(key=lambda x: x.get("block", {}).get("index", 0))
        return blocks
    
    def _block_exists_in_network(self, block_index: int) -> bool:
        """Check if block already exists in network"""
        for filename in os.listdir(self.consensus_dir):
            if filename.startswith(f"block_{block_index}_") and filename.endswith(".json"):
                return True
        return False
    
    def _sync_with_network(self):
        """Sync local blockchain with network consensus"""
        network_blocks = self._get_recent_network_blocks()
        local_height = len(self.blockchain.blocks)
        
        for block_data in network_blocks:
            block_info = block_data.get("block", {})
            block_index = block_info.get("index", 0)
            
            # Add blocks we don't have
            if block_index >= local_height:
                try:
                    # Reconstruct block
                    block = Block(
                        index=block_info["index"],
                        timestamp=block_info["timestamp"],
                        transactions=[],  # Empty for now
                        previous_hash=block_info["previous_hash"],
                        nonce=block_info.get("nonce", 0),
                        hash=block_info.get("hash", "")
                    )
                    
                    # Validate and add
                    if self.blockchain.add_block(block):
                        print(f"📥 Synced block {block.index} from network")
                        
                except Exception as e:
                    print(f"⚠️ Failed to sync block {block_index}: {e}")

# Global decentralized miner instance
decentralized_miner = None

def get_decentralized_miner():
    """Get or create global decentralized miner"""
    global decentralized_miner
    if decentralized_miner is None:
        decentralized_miner = DecentralizedMiner()
    return decentralized_miner

def start_decentralized_mining():
    """Start decentralized mining"""
    miner = get_decentralized_miner()
    return miner.start_mining()

def stop_decentralized_mining():
    """Stop decentralized mining"""
    miner = get_decentralized_miner()
    return miner.stop_mining()

def get_decentralized_stats():
    """Get decentralized mining stats"""
    miner = get_decentralized_miner()
    return miner.get_stats()

if __name__ == "__main__":
    # Test decentralized mining
    miner = DecentralizedMiner()
    
    print("🚀 Starting decentralized mining test...")
    miner.start_mining()
    
    try:
        time.sleep(30)  # Mine for 30 seconds
    except KeyboardInterrupt:
        pass
    finally:
        miner.stop_mining()
        print("✅ Decentralized mining test complete")