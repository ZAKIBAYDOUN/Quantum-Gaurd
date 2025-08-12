#!/bin/bash
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
sudo ufw allow 5470/tcp
sudo ufw allow 8333/tcp
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
echo "🌐 Public IP: 35.237.216.148"
echo "🔌 Node Port: 5470"
