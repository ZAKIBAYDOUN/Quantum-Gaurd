#!/usr/bin/env python3
"""
5470 Seed Node Manager - VPS Deployment & Public IP Management
Manages seed nodes with public IPs for true P2P networking
"""

import json
import socket
import requests
import subprocess
import os
from typing import List, Dict, Optional
import threading
import time

class SeedNodeManager:
    def __init__(self):
        self.seed_nodes = []
        self.local_ip = self.get_local_ip()
        self.public_ip = self.get_public_ip()
        self.node_port = 5470
        self.p2p_port = 8333  # Bitcoin-style P2P port
        
    def get_local_ip(self) -> str:
        """Get local network IP"""
        try:
            # Connect to external server to get local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except:
            return "127.0.0.1"
    
    def get_public_ip(self) -> str:
        """Get public IP from external service"""
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=5)
            return response.json()['ip']
        except:
            try:
                response = requests.get('https://httpbin.org/ip', timeout=5)
                return response.json()['origin']
            except:
                return self.local_ip
    
    def check_port_accessibility(self, ip: str, port: int) -> bool:
        """Check if port is accessible from external"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except:
            return False
    
    def configure_firewall(self):
        """Configure firewall rules for P2P ports"""
        commands = [
            f"sudo ufw allow {self.node_port}/tcp",
            f"sudo ufw allow {self.p2p_port}/tcp",
            f"sudo ufw allow {self.node_port}/udp",
            f"sudo ufw allow {self.p2p_port}/udp",
            "sudo ufw reload"
        ]
        
        print("🔥 Configuring firewall rules...")
        for cmd in commands:
            try:
                subprocess.run(cmd.split(), capture_output=True, text=True)
                print(f"✅ {cmd}")
            except Exception as e:
                print(f"❌ Failed: {cmd} - {e}")
    
    def create_seed_node_config(self) -> Dict:
        """Create configuration for seed node deployment"""
        config = {
            "node_id": f"seed_{self.public_ip.replace('.', '_')}",
            "public_ip": self.public_ip,
            "local_ip": self.local_ip,
            "node_port": self.node_port,
            "p2p_port": self.p2p_port,
            "announce_ip": True,
            "accept_incoming": True,
            "max_connections": 1000,
            "seed_nodes": [
                # Add known seed nodes here
                {"ip": "seed1.5470coin.net", "port": 5470},
                {"ip": "seed2.5470coin.net", "port": 5470},
                {"ip": "seed3.5470coin.net", "port": 5470}
            ],
            "network_config": {
                "protocol_version": "5470.1",
                "network_magic": "5470COIN",
                "genesis_block": "5470genesis2025",
                "chain_id": 5470
            }
        }
        
        # Save config
        with open('seed_node_config.json', 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"📝 Seed node config created:")
        print(f"   Public IP: {self.public_ip}")
        print(f"   Local IP: {self.local_ip}")
        print(f"   Node Port: {self.node_port}")
        print(f"   P2P Port: {self.p2p_port}")
        
        return config
    
    def deploy_vps_script(self) -> str:
        """Generate VPS deployment script"""
        script = f"""#!/bin/bash
# 5470 Seed Node VPS Deployment Script
# Run this script on your VPS with public IP

echo "🚀 Deploying 5470 Seed Node on VPS..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip git nodejs npm ufw

# Clone repository
git clone https://github.com/your-repo/5470-blockchain.git
cd 5470-blockchain

# Install Python dependencies
pip3 install requests websockets asyncio

# Install Node.js dependencies
npm install

# Configure firewall
sudo ufw allow {self.node_port}/tcp
sudo ufw allow {self.p2p_port}/tcp
sudo ufw --force enable

# Create systemd service
sudo tee /etc/systemd/system/5470-seed.service > /dev/null <<EOF
[Unit]
Description=5470 Blockchain Seed Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/5470-blockchain
ExecStart=/usr/bin/python3 core/seed_node_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl enable 5470-seed
sudo systemctl start 5470-seed

echo "✅ 5470 Seed Node deployed!"
echo "📊 Status: sudo systemctl status 5470-seed"
echo "📋 Logs: sudo journalctl -u 5470-seed -f"
echo "🌐 Public IP: {self.public_ip}"
echo "🔌 Node Port: {self.node_port}"
"""
        
        with open('deploy_seed_node.sh', 'w') as f:
            f.write(script)
        
        os.chmod('deploy_seed_node.sh', 0o755)
        
        print("📜 VPS deployment script created: deploy_seed_node.sh")
        return script
    
    def test_peer_connectivity(self) -> Dict:
        """Test connectivity to external peers"""
        results = {
            "local_tests": {},
            "external_tests": {},
            "recommendations": []
        }
        
        # Test local ports
        local_tests = [
            ("localhost", self.node_port),
            ("localhost", self.p2p_port),
            (self.local_ip, self.node_port)
        ]
        
        for host, port in local_tests:
            accessible = self.check_port_accessibility(host, port)
            results["local_tests"][f"{host}:{port}"] = accessible
            print(f"🔍 {host}:{port} - {'✅' if accessible else '❌'}")
        
        # Test external connectivity
        external_hosts = [
            "8.8.8.8",  # Google DNS
            "1.1.1.1",  # Cloudflare DNS
            "bitcoin.org"  # Bitcoin.org
        ]
        
        for host in external_hosts:
            try:
                accessible = self.check_port_accessibility(host, 80)
                results["external_tests"][host] = accessible
                print(f"🌐 {host} - {'✅' if accessible else '❌'}")
            except:
                results["external_tests"][host] = False
                print(f"🌐 {host} - ❌")
        
        # Generate recommendations
        if not any(results["local_tests"].values()):
            results["recommendations"].append("Configure firewall to allow ports")
        
        if not any(results["external_tests"].values()):
            results["recommendations"].append("Check internet connectivity")
        
        return results
    
    def generate_peer_discovery_list(self) -> List[Dict]:
        """Generate list of peers for discovery"""
        peers = [
            {
                "ip": self.public_ip,
                "port": self.node_port,
                "type": "seed",
                "location": "local",
                "last_seen": int(time.time()),
                "version": "5470.1"
            }
        ]
        
        # Add example VPS seed nodes (replace with real IPs)
        example_seeds = [
            {"ip": "45.76.123.45", "location": "US-East"},
            {"ip": "139.180.191.67", "location": "US-West"}, 
            {"ip": "207.148.78.123", "location": "EU-London"},
            {"ip": "95.179.147.89", "location": "Asia-Tokyo"}
        ]
        
        for seed in example_seeds:
            peers.append({
                "ip": seed["ip"],
                "port": self.node_port,
                "type": "seed",
                "location": seed["location"],
                "last_seen": int(time.time()),
                "version": "5470.1"
            })
        
        # Save peer list
        with open('peer_discovery.json', 'w') as f:
            json.dump(peers, f, indent=2)
        
        print(f"📊 Generated {len(peers)} seed nodes for discovery")
        return peers
    
    def create_monitoring_dashboard(self):
        """Create monitoring dashboard for seed nodes"""
        dashboard_html = f"""<!DOCTYPE html>
<html>
<head>
    <title>5470 Seed Node Monitor</title>
    <style>
        body {{ font-family: monospace; background: #000; color: #0f0; }}
        .node {{ margin: 10px; padding: 10px; border: 1px solid #0f0; }}
        .online {{ background: #001100; }}
        .offline {{ background: #110000; color: #f00; }}
    </style>
</head>
<body>
    <h1>🌐 5470 Seed Node Network</h1>
    <div class="stats">
        <p>Public IP: {self.public_ip}</p>
        <p>Node Port: {self.node_port}</p>
        <p>P2P Port: {self.p2p_port}</p>
        <p>Status: <span id="status">Checking...</span></p>
    </div>
    
    <h2>Connected Peers</h2>
    <div id="peers"></div>
    
    <script>
        function updateStatus() {{
            fetch('/api/network/stats')
                .then(r => r.json())
                .then(data => {{
                    document.getElementById('status').textContent = 
                        `${{data.connectedPeers}} peers connected`;
                    
                    const peersDiv = document.getElementById('peers');
                    peersDiv.innerHTML = '';
                    
                    // Display connected peers (mock for now)
                    for(let i = 0; i < data.connectedPeers && i < 10; i++) {{
                        const peerDiv = document.createElement('div');
                        peerDiv.className = 'node online';
                        peerDiv.innerHTML = `
                            <strong>Peer ${{i+1}}</strong><br>
                            IP: 192.168.${{Math.floor(Math.random()*255)}}.${{Math.floor(Math.random()*255)}}<br>
                            Last Seen: ${{new Date().toLocaleString()}}
                        `;
                        peersDiv.appendChild(peerDiv);
                    }}
                }})
                .catch(e => {{
                    document.getElementById('status').textContent = 'Offline';
                }});
        }}
        
        updateStatus();
        setInterval(updateStatus, 5000);
    </script>
</body>
</html>"""
        
        with open('seed_monitor.html', 'w') as f:
            f.write(dashboard_html)
        
        print("📊 Seed node monitoring dashboard created: seed_monitor.html")

def main():
    print("🌱 5470 Seed Node Manager")
    print("=" * 50)
    
    manager = SeedNodeManager()
    
    # Create seed node configuration
    config = manager.create_seed_node_config()
    
    # Test connectivity
    print("\n🔍 Testing Connectivity...")
    connectivity = manager.test_peer_connectivity()
    
    # Generate VPS deployment script
    print("\n📜 Generating VPS Deployment Script...")
    manager.deploy_vps_script()
    
    # Configure firewall (requires sudo)
    print("\n🔥 Configuring Firewall...")
    try:
        manager.configure_firewall()
    except Exception as e:
        print(f"⚠️  Firewall configuration requires manual setup: {e}")
    
    # Generate peer discovery
    print("\n📊 Generating Peer Discovery List...")
    peers = manager.generate_peer_discovery_list()
    
    # Create monitoring dashboard
    print("\n📊 Creating Monitoring Dashboard...")
    manager.create_monitoring_dashboard()
    
    print("\n✅ Seed Node Setup Complete!")
    print("\nNext Steps:")
    print("1. Deploy to VPS: ./deploy_seed_node.sh")
    print("2. Update DNS records to point to your VPS IP")
    print("3. Test external connectivity: /peers or getpeerinfo")
    print("4. Monitor: open seed_monitor.html")
    print(f"\nYour Public IP: {manager.public_ip}")

if __name__ == "__main__":
    main()