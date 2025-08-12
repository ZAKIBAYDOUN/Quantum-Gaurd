#!/usr/bin/env python3
"""
Start Decentralized 5470 Blockchain Network
Launches multiple independent nodes that form a P2P network
"""

import subprocess
import time
import os
import signal
import sys

def start_node(port: int):
    """Start a single node"""
    print(f"🚀 Starting node on port {port}")
    
    process = subprocess.Popen([
        sys.executable, "core/p2p_node.py", str(port)
    ], cwd=os.getcwd())
    
    return process

def main():
    """Start decentralized network"""
    print("🌐 Starting 5470 Decentralized Blockchain Network")
    print("=" * 50)
    
    # Start multiple nodes for true decentralization
    nodes = []
    ports = [5000, 5001, 5002]
    
    try:
        for port in ports:
            node_process = start_node(port)
            nodes.append(node_process)
            time.sleep(2)  # Give each node time to start
        
        print(f"\n✅ Started {len(nodes)} decentralized nodes")
        print("🔗 Network is forming P2P connections...")
        print("⛏️ Mining can be started on any node")
        print("\nPress Ctrl+C to stop all nodes")
        
        # Wait for user to stop
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Stopping decentralized network...")
        
        # Stop all nodes
        for process in nodes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        
        print("✅ All nodes stopped")

if __name__ == "__main__":
    main()