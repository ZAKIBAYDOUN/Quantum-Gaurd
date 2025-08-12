#!/usr/bin/env python3
"""
Start the real 5470 blockchain with ECDSA, Merkle trees, PoW, and Halo2 ZK-proofs
"""

import sys
import time
import subprocess
import threading
from blockchain import Blockchain5470
from wallet import MultiCurrencyWallet

def start_blockchain_node():
    """Start the blockchain node"""
    print("🚀 Starting 5470 Blockchain Node...")
    print("✅ Real ECDSA/secp256k1 signatures")
    print("✅ Formal block headers with Merkle root")
    print("✅ Fork-choice by accumulated work")
    print("✅ Persistent storage (LevelDB-style)")
    print("✅ Authentic Halo2 ZK-proofs")
    
    # Initialize blockchain
    blockchain = Blockchain5470()
    
    # Start P2P network
    blockchain.start_p2p_network()
    
    # Create wallet and connect to blockchain
    wallet = MultiCurrencyWallet("5470_main_wallet")
    wallet.connect_blockchain(blockchain)
    
    # Generate mining address if needed
    mining_addr = wallet.get_primary_address('5470')
    if not mining_addr:
        mining_addr = wallet.generate_address('5470')
    
    print(f"⛏️ Mining to address: {mining_addr.address}")
    
    # Start mining
    blockchain.start_mining(mining_addr.address)
    
    # Keep the node running
    try:
        while True:
            stats = blockchain.get_network_stats()
            print(f"📊 [Real Blockchain] Height: {stats['best_height']}, Work: {stats['best_work']}, "
                  f"Peers: {stats['peer_count']}, Mempool: {stats['mempool_size']}")
            
            # Update wallet balances
            wallet.update_balances()
            
            time.sleep(30)
            
    except KeyboardInterrupt:
        print("\n🛑 Blockchain node stopped")

if __name__ == "__main__":
    start_blockchain_node()