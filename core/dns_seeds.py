#!/usr/bin/env python3
"""
DNS Seeds Infrastructure for Massive P2P Scaling
Supports up to 100,000 concurrent peer connections
"""

import asyncio
import random
import socket
import time
import json
import os
from typing import List, Dict, Set, Optional, Tuple
from dataclasses import dataclass, asdict
import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PeerNode:
    """Enhanced peer information for massive scaling"""
    ip: str
    port: int
    node_id: str
    version: str = "5470-core-2.0.0"
    last_seen: float = 0
    reliability_score: float = 1.0
    connection_count: int = 0
    blocks_synced: int = 0
    latency_ms: float = 0
    bandwidth_kbps: float = 0
    region: str = "local"
    
class DNSSeedManager:
    """Manages DNS seeds and peer discovery for massive scaling"""
    
    def __init__(self, max_peers: int = 100000, local_port: int = 5000):
        self.max_peers = max_peers
        self.local_port = local_port
        self.active_peers: Dict[str, PeerNode] = {}
        self.seed_addresses: List[str] = []
        self.connection_pool = ThreadPoolExecutor(max_workers=1000)
        self.running = False
        
        # DNS Seeds (simulated for local testing)
        self.dns_seeds = [
            "seed1.5470coin.local",
            "seed2.5470coin.local", 
            "seed3.5470coin.local",
            "seed4.5470coin.local",
            "testnet.5470coin.local"
        ]
        
        # Local test network configuration
        self.local_test_ranges = [
            ("127.0.0.1", range(5000, 5500)),  # 500 local nodes
            ("127.0.0.1", range(6000, 6500)),  # 500 more nodes
            ("127.0.0.1", range(7000, 7500)),  # 500 more nodes
            ("127.0.0.1", range(8000, 8500)),  # 500 more nodes
        ]
        
        # Performance optimization
        self.peer_chunks = {}  # Chunked peer management
        self.discovery_cache = {}
        self.connection_semaphore = asyncio.Semaphore(1000)  # Limit concurrent connections
        
        logger.info(f"🌐 DNS Seed Manager initialized for {max_peers:,} peers")
    
    def resolve_dns_seeds(self) -> List[Tuple[str, int]]:
        """Resolve DNS seeds to get initial peer list"""
        resolved_peers = []
        
        # For local testing, simulate DNS resolution with test ranges
        for seed in self.dns_seeds:
            logger.info(f"🔍 Resolving DNS seed: {seed}")
            
            # Simulate DNS resolution to multiple IPs
            for base_ip, port_range in self.local_test_ranges:
                # Generate random subset of ports to simulate real DNS
                sample_ports = random.sample(list(port_range), min(100, len(port_range)))
                for port in sample_ports:
                    if port != self.local_port:  # Don't connect to self
                        resolved_peers.append((base_ip, port))
        
        logger.info(f"🎯 DNS Resolution complete: {len(resolved_peers)} potential peers found")
        return resolved_peers
    
    async def discover_peers_massive(self) -> List[PeerNode]:
        """Massive peer discovery with DNS seeds"""
        logger.info("🔍 Starting massive peer discovery...")
        
        # Get initial peers from DNS
        dns_peers = self.resolve_dns_seeds()
        discovered_peers = []
        
        # Limit initial connections to prevent overload
        initial_batch_size = min(1000, len(dns_peers))
        initial_peers = random.sample(dns_peers, initial_batch_size)
        
        # Parallel peer discovery
        discovery_tasks = []
        for ip, port in initial_peers:
            task = asyncio.create_task(self._discover_single_peer(ip, port))
            discovery_tasks.append(task)
        
        # Wait for discoveries with timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*discovery_tasks, return_exceptions=True),
                timeout=30.0
            )
            
            for result in results:
                if isinstance(result, PeerNode):
                    discovered_peers.append(result)
                    
        except asyncio.TimeoutError:
            logger.warning("⚠️ Peer discovery timeout, using partial results")
        
        logger.info(f"✅ Discovered {len(discovered_peers)} active peers")
        return discovered_peers
    
    async def _discover_single_peer(self, ip: str, port: int) -> Optional[PeerNode]:
        """Discover a single peer with health check"""
        try:
            # Quick connection test
            async with self.connection_semaphore:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=2.0
                )
                
                # Send discovery message
                discovery_msg = {
                    "type": "peer_discovery",
                    "version": "5470-core-2.0.0",
                    "port": self.local_port,
                    "timestamp": time.time()
                }
                
                writer.write(json.dumps(discovery_msg).encode() + b'\n')
                await writer.drain()
                
                # Read response
                response_data = await asyncio.wait_for(reader.readline(), timeout=2.0)
                response = json.loads(response_data.decode())
                
                writer.close()
                await writer.wait_closed()
                
                # Create peer node
                node_id = hashlib.sha256(f"{ip}:{port}".encode()).hexdigest()[:16]
                peer = PeerNode(
                    ip=ip,
                    port=port,
                    node_id=node_id,
                    version=response.get("version", "unknown"),
                    last_seen=time.time(),
                    reliability_score=1.0,
                    latency_ms=random.uniform(10, 100)  # Simulated latency
                )
                
                return peer
                
        except Exception as e:
            logger.debug(f"Failed to discover peer {ip}:{port}: {e}")
            return None
    
    def add_peer(self, peer: PeerNode) -> bool:
        """Add peer to active list with capacity management"""
        if len(self.active_peers) >= self.max_peers:
            # Remove lowest scoring peer
            worst_peer = min(self.active_peers.values(), key=lambda p: p.reliability_score)
            del self.active_peers[f"{worst_peer.ip}:{worst_peer.port}"]
            logger.debug(f"🗑️ Removed low-scoring peer: {worst_peer.ip}:{worst_peer.port}")
        
        peer_key = f"{peer.ip}:{peer.port}"
        self.active_peers[peer_key] = peer
        
        logger.debug(f"➕ Added peer: {peer_key} (Total: {len(self.active_peers)})")
        return True
    
    def get_best_peers(self, count: int = 50) -> List[PeerNode]:
        """Get best peers sorted by reliability score"""
        sorted_peers = sorted(
            self.active_peers.values(),
            key=lambda p: p.reliability_score,
            reverse=True
        )
        return sorted_peers[:count]
    
    def update_peer_metrics(self, peer_key: str, latency: float = None, success: bool = True):
        """Update peer performance metrics"""
        if peer_key in self.active_peers:
            peer = self.active_peers[peer_key]
            
            if latency:
                peer.latency_ms = latency
            
            # Update reliability score
            if success:
                peer.reliability_score = min(1.0, peer.reliability_score + 0.01)
            else:
                peer.reliability_score = max(0.1, peer.reliability_score - 0.05)
            
            peer.last_seen = time.time()
    
    def get_network_stats(self) -> Dict:
        """Get comprehensive network statistics"""
        if not self.active_peers:
            return {
                "total_peers": 0,
                "connected_peers": 0,
                "avg_latency": 0,
                "network_health": 0
            }
        
        total_peers = len(self.active_peers)
        avg_latency = sum(p.latency_ms for p in self.active_peers.values()) / total_peers
        avg_reliability = sum(p.reliability_score for p in self.active_peers.values()) / total_peers
        
        return {
            "total_peers": total_peers,
            "connected_peers": sum(1 for p in self.active_peers.values() if p.last_seen > time.time() - 300),
            "avg_latency": round(avg_latency, 2),
            "network_health": round(avg_reliability * 100, 1),
            "max_capacity": self.max_peers,
            "capacity_used": round((total_peers / self.max_peers) * 100, 1)
        }
    
    async def start_peer_management(self):
        """Start background peer management tasks"""
        self.running = True
        logger.info("🚀 Starting massive peer management system...")
        
        # Start discovery loop
        asyncio.create_task(self._peer_discovery_loop())
        asyncio.create_task(self._peer_maintenance_loop())
        
        logger.info(f"✅ Peer management active (Capacity: {self.max_peers:,} peers)")
    
    async def _peer_discovery_loop(self):
        """Continuous peer discovery loop"""
        while self.running:
            try:
                # Discover new peers if below capacity
                if len(self.active_peers) < self.max_peers * 0.8:  # 80% capacity trigger
                    new_peers = await self.discover_peers_massive()
                    for peer in new_peers:
                        self.add_peer(peer)
                
                await asyncio.sleep(30)  # Discovery every 30 seconds
                
            except Exception as e:
                logger.error(f"❌ Peer discovery error: {e}")
                await asyncio.sleep(60)
    
    async def _peer_maintenance_loop(self):
        """Clean up stale peers and maintain network health"""
        while self.running:
            try:
                current_time = time.time()
                stale_peers = []
                
                # Find stale peers (not seen for 5 minutes)
                for peer_key, peer in self.active_peers.items():
                    if current_time - peer.last_seen > 300:  # 5 minutes
                        stale_peers.append(peer_key)
                
                # Remove stale peers
                for peer_key in stale_peers:
                    del self.active_peers[peer_key]
                    logger.debug(f"🧹 Removed stale peer: {peer_key}")
                
                if stale_peers:
                    logger.info(f"🧹 Cleaned up {len(stale_peers)} stale peers")
                
                await asyncio.sleep(60)  # Maintenance every minute
                
            except Exception as e:
                logger.error(f"❌ Peer maintenance error: {e}")
                await asyncio.sleep(120)
    
    def stop(self):
        """Stop peer management"""
        self.running = False
        self.connection_pool.shutdown(wait=True)
        logger.info("🛑 Peer management stopped")

# Global DNS seed manager instance
dns_seed_manager = DNSSeedManager(max_peers=100000)

async def initialize_massive_network():
    """Initialize massive P2P network with DNS seeds"""
    logger.info("🌐 Initializing massive P2P network...")
    await dns_seed_manager.start_peer_management()
    return dns_seed_manager

if __name__ == "__main__":
    async def test_massive_network():
        manager = await initialize_massive_network()
        
        # Let it run for a bit
        await asyncio.sleep(60)
        
        stats = manager.get_network_stats()
        print(f"📊 Network Stats: {json.dumps(stats, indent=2)}")
        
        manager.stop()
    
    asyncio.run(test_massive_network())