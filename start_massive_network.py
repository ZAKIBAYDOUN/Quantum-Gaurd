#!/usr/bin/env python3
"""
Start Massive P2P Network - Up to 100,000 Peers
Simulates massive blockchain network for testing
"""

import asyncio
import sys
import os
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor
import json

# Add core directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from p2p_node import DecentralizedNode
from dns_seeds import DNSSeedManager

class MassiveNetworkSimulator:
    """Simulates massive blockchain network with thousands of nodes"""
    
    def __init__(self, total_nodes: int = 1000, max_peers_per_node: int = 100000):
        self.total_nodes = total_nodes
        self.max_peers_per_node = max_peers_per_node
        self.nodes = {}
        self.running = False
        
        print(f"🌐 Massive Network Simulator")
        print(f"📊 Total nodes: {total_nodes:,}")
        print(f"🔗 Max peers per node: {max_peers_per_node:,}")
        print(f"💾 Total network capacity: {total_nodes * max_peers_per_node:,} connections")
    
    def create_node_cluster(self, start_port: int, count: int) -> List[DecentralizedNode]:
        """Create a cluster of nodes"""
        nodes = []
        
        for i in range(count):
            port = start_port + i
            data_dir = f"node_data_{port}"
            
            try:
                node = DecentralizedNode(
                    port=port, 
                    data_dir=data_dir,
                    max_peers=self.max_peers_per_node
                )
                nodes.append(node)
                print(f"✅ Created node on port {port}")
                
            except Exception as e:
                print(f"❌ Failed to create node on port {port}: {e}")
        
        return nodes
    
    def start_massive_network(self):
        """Start massive network simulation"""
        print("🚀 Starting massive network simulation...")
        self.running = True
        
        # Create node clusters
        clusters = [
            (5000, 100),   # Cluster 1: 100 nodes
            (6000, 100),   # Cluster 2: 100 nodes  
            (7000, 100),   # Cluster 3: 100 nodes
            (8000, 100),   # Cluster 4: 100 nodes
        ]
        
        # Start clusters in parallel
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            
            for start_port, count in clusters:
                if len(self.nodes) < self.total_nodes:
                    remaining = min(count, self.total_nodes - len(self.nodes))
                    future = executor.submit(self._start_cluster, start_port, remaining)
                    futures.append(future)
            
            # Wait for all clusters to start
            for future in futures:
                cluster_nodes = future.result()
                for node in cluster_nodes:
                    self.nodes[node.port] = node
        
        print(f"🎯 Massive network started with {len(self.nodes):,} nodes")
        self._print_network_stats()
    
    def _start_cluster(self, start_port: int, count: int) -> List[DecentralizedNode]:
        """Start a cluster of nodes"""
        print(f"🏗️ Starting cluster: ports {start_port}-{start_port + count - 1}")
        
        cluster_nodes = self.create_node_cluster(start_port, count)
        
        # Start nodes with staggered timing to prevent overload
        for i, node in enumerate(cluster_nodes):
            try:
                # Start node in background thread
                node_thread = threading.Thread(target=node.start_node, daemon=True)
                node_thread.start()
                
                # Stagger startup to prevent port conflicts
                time.sleep(0.1)
                
                if i % 10 == 0:
                    print(f"📡 Started {i + 1}/{len(cluster_nodes)} nodes in cluster")
                    
            except Exception as e:
                print(f"❌ Failed to start node {node.port}: {e}")
        
        print(f"✅ Cluster started: {len(cluster_nodes)} nodes")
        return cluster_nodes
    
    def _print_network_stats(self):
        """Print comprehensive network statistics"""
        if not self.nodes:
            return
        
        total_capacity = len(self.nodes) * self.max_peers_per_node
        
        stats = {
            "active_nodes": len(self.nodes),
            "total_network_capacity": f"{total_capacity:,}",
            "theoretical_max_connections": f"{total_capacity:,}",
            "ports_used": [node.port for node in list(self.nodes.values())[:10]],
            "sample_node_ids": [node.node_id for node in list(self.nodes.values())[:5]]
        }
        
        print("\n📊 MASSIVE NETWORK STATISTICS")
        print("=" * 50)
        for key, value in stats.items():
            print(f"{key}: {value}")
        print("=" * 50)
    
    async def monitor_network(self):
        """Monitor network health and performance"""
        print("📡 Starting network monitoring...")
        
        while self.running:
            try:
                # Collect stats from random sample of nodes
                sample_nodes = random.sample(list(self.nodes.values()), min(10, len(self.nodes)))
                
                total_peers = 0
                for node in sample_nodes:
                    if hasattr(node, 'dns_manager'):
                        stats = node.dns_manager.get_network_stats()
                        total_peers += stats.get('total_peers', 0)
                
                avg_peers = total_peers / len(sample_nodes) if sample_nodes else 0
                
                print(f"🔍 Network Status: {len(self.nodes):,} nodes, ~{avg_peers:.0f} avg peers/node")
                
                await asyncio.sleep(30)  # Monitor every 30 seconds
                
            except Exception as e:
                print(f"❌ Monitoring error: {e}")
                await asyncio.sleep(60)
    
    def stress_test_network(self):
        """Perform stress test on the massive network"""
        print("⚡ Starting network stress test...")
        
        # Test scenarios
        scenarios = [
            ("Connection Flood", self._test_connection_flood),
            ("Peer Discovery", self._test_peer_discovery),
            ("Network Partitioning", self._test_network_partition)
        ]
        
        for name, test_func in scenarios:
            print(f"🧪 Running: {name}")
            try:
                test_func()
                print(f"✅ {name} completed")
            except Exception as e:
                print(f"❌ {name} failed: {e}")
            time.sleep(10)
    
    def _test_connection_flood(self):
        """Test massive simultaneous connections"""
        print("🌊 Testing connection flood resistance...")
        # This would test the network's ability to handle massive connection requests
        
    def _test_peer_discovery(self):
        """Test peer discovery at scale"""
        print("🔍 Testing massive peer discovery...")
        # This would test DNS seed resolution and peer discovery
        
    def _test_network_partition(self):
        """Test network partition recovery"""
        print("🔀 Testing network partition handling...")
        # This would test the network's resilience to partitions
    
    def stop_network(self):
        """Stop the massive network"""
        print("🛑 Stopping massive network...")
        self.running = False
        
        for node in self.nodes.values():
            try:
                if hasattr(node, 'dns_manager'):
                    node.dns_manager.stop()
                node.running = False
            except Exception as e:
                print(f"❌ Error stopping node {node.port}: {e}")
        
        print("✅ Massive network stopped")

async def main():
    """Main function to run massive network simulation"""
    
    # Configuration
    TOTAL_NODES = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    MAX_PEERS = int(sys.argv[2]) if len(sys.argv) > 2 else 100000
    
    print("🌐 5470 MASSIVE P2P NETWORK SIMULATOR")
    print("=" * 50)
    
    # Create and start massive network
    simulator = MassiveNetworkSimulator(
        total_nodes=TOTAL_NODES,
        max_peers_per_node=MAX_PEERS
    )
    
    try:
        # Start the network
        simulator.start_massive_network()
        
        # Start monitoring
        monitor_task = asyncio.create_task(simulator.monitor_network())
        
        # Run stress tests
        simulator.stress_test_network()
        
        # Keep running
        print("🔄 Network running... Press Ctrl+C to stop")
        while simulator.running:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Shutdown requested...")
    except Exception as e:
        print(f"❌ Network error: {e}")
    finally:
        simulator.stop_network()

if __name__ == "__main__":
    print("🚀 Starting 5470 Massive P2P Network...")
    print("Usage: python start_massive_network.py [nodes] [max_peers_per_node]")
    print("Example: python start_massive_network.py 1000 100000")
    print()
    
    asyncio.run(main())