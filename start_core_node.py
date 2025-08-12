#!/usr/bin/env python3
"""
5470 Core Node Launcher
Starts a fully decentralized Bitcoin-like node
"""

import sys
import time
import signal
import threading
from core.node import CoreNode
from core.rpc_server import RPCServer

def main():
    # Parse command line arguments
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5470
    rpc_port = int(sys.argv[2]) if len(sys.argv) > 2 else 8332
    
    print("🚀 Starting 5470 Core Node...")
    print(f"📡 P2P Port: {port}")
    print(f"🔧 RPC Port: {rpc_port}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    # Create and start node
    node = CoreNode(port=port, data_dir=f"node_data_{port}")
    rpc_server = RPCServer(node, port=rpc_port)
    
    try:
        # Load existing blockchain
        node.load_blockchain()
        
        # Start core services
        node.start_node()
        rpc_server.start()
        
        # Auto-start mining
        node.start_mining()
        
        print(f"✅ 5470 Core Node started successfully!")
        print(f"🏠 Node Address: {node.wallet_address}")
        print(f"⛏️  Mining: Active")
        print(f"🌐 P2P Network: Listening on port {port}")
        print(f"🔌 RPC Interface: http://127.0.0.1:{rpc_port}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📋 Available RPC Commands:")
        print("   • getinfo - Node information")
        print("   • getbalance - Wallet balance")
        print("   • sendtoaddress <addr> <amount> - Send coins")
        print("   • getmininginfo - Mining status")
        print("   • generate <blocks> - Mine blocks")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("Press Ctrl+C to stop the node")
        print()
        
        # Status updates
        def status_updater():
            while node.is_running:
                time.sleep(30)
                if node.is_running:
                    info = node.get_node_info()
                    print(f"📊 Status: Height={info['blockchain_height']}, "
                          f"Peers={info['peer_count']}, "
                          f"Mempool={info['mempool_size']}, "
                          f"Balance={info['balance']/100000000:.2f}")
        
        status_thread = threading.Thread(target=status_updater, daemon=True)
        status_thread.start()
        
        # Handle shutdown gracefully
        def signal_handler(sig, frame):
            print("\n🛑 Shutting down 5470 Core Node...")
            node.stop_node()
            rpc_server.stop()
            print("✅ Node stopped successfully")
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Keep running
        while node.is_running:
            time.sleep(1)
            
    except Exception as e:
        print(f"❌ Error starting node: {e}")
        node.stop_node()
        rpc_server.stop()
        sys.exit(1)

if __name__ == "__main__":
    main()