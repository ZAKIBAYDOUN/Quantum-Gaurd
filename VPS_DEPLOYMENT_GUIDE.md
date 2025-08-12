# 5470 VPS Seed Node Deployment Guide

Deploy true decentralized P2P seed nodes with public IP addresses for authentic blockchain networking.

## 🌐 Network Infrastructure

**Current Status:**
- Public IP: `35.237.216.148`
- Local IP: `172.31.99.162`
- Node Port: `5470`
- P2P Port: `8333`

## 🚀 Quick VPS Deployment

### 1. Prerequisites

```bash
# Minimum VPS Requirements
- 1 vCPU, 1GB RAM, 20GB SSD
- Ubuntu 20.04+ or Debian 11+
- Public static IP address
- Root or sudo access
```

### 2. Automated Deployment

```bash
# Copy and run the deployment script
chmod +x deploy_seed_node.sh
./deploy_seed_node.sh

# The script will:
# - Update system packages
# - Install Python, Node.js, dependencies
# - Configure firewall (ports 5470, 8333)
# - Set up systemd service
# - Start seed node automatically
```

### 3. Manual Setup (Alternative)

```bash
# 1. System Update
sudo apt update && sudo apt upgrade -y

# 2. Install Dependencies
sudo apt install -y python3 python3-pip nodejs npm git ufw

# 3. Clone Repository
git clone https://github.com/your-repo/5470-blockchain.git
cd 5470-blockchain

# 4. Python Dependencies
pip3 install websockets requests asyncio

# 5. Node.js Dependencies
npm install

# 6. Firewall Configuration
sudo ufw allow 5470/tcp  # Node port
sudo ufw allow 8333/tcp  # P2P port
sudo ufw allow 8080/tcp  # Monitoring port
sudo ufw --force enable

# 7. Start Seed Server
cd core
python3 seed_node_server.py
```

## 📊 Monitoring & Testing

### Check Node Status

```bash
# Local status
curl http://localhost:8080/status

# External connectivity test
curl http://YOUR_PUBLIC_IP:8080/status
curl http://YOUR_PUBLIC_IP:8080/peers
```

### Expected Response

```json
{
  "node_id": "seed_hostname_timestamp",
  "public_ip": "YOUR_PUBLIC_IP",
  "port": 5470,
  "uptime": 3600,
  "connected_peers": 12,
  "status": "online"
}
```

## 🔧 Advanced Configuration

### Custom DNS Seeds

Edit `core/seed_node_manager.py`:

```python
# Add your VPS IP to seed nodes
example_seeds = [
    {"ip": "YOUR_VPS_IP", "location": "Custom-Location"},
    {"ip": "45.76.123.45", "location": "US-East"},
    # ... existing seeds
]
```

### Systemd Service (Production)

```bash
# Create service file
sudo tee /etc/systemd/system/5470-seed.service > /dev/null <<EOF
[Unit]
Description=5470 Blockchain Seed Node
After=network.target

[Service]
Type=simple
User=runner
WorkingDirectory=/home/runner/5470-blockchain
ExecStart=/usr/bin/python3 core/seed_node_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable 5470-seed
sudo systemctl start 5470-seed

# Check status
sudo systemctl status 5470-seed
sudo journalctl -u 5470-seed -f
```

## 🌍 DNS Configuration

### A Records Setup

```bash
# Point DNS records to your VPS IP
seed1.5470coin.net    A    YOUR_VPS_IP
seed2.5470coin.net    A    ANOTHER_VPS_IP
seed3.5470coin.net    A    THIRD_VPS_IP
```

### Test DNS Resolution

```bash
# Test DNS seeds
nslookup seed1.5470coin.net
dig seed1.5470coin.net +short

# Verify multiple seeds
python3 -c "
import socket
seeds = ['seed1.5470coin.net', 'seed2.5470coin.net']
for seed in seeds:
    try:
        ip = socket.gethostbyname(seed)
        print(f'{seed} -> {ip}')
    except:
        print(f'{seed} -> FAILED')
"
```

## 🔥 Firewall Rules

### UFW Configuration

```bash
# Allow essential ports
sudo ufw allow ssh
sudo ufw allow 5470/tcp   # 5470 Node
sudo ufw allow 8333/tcp   # Bitcoin-style P2P
sudo ufw allow 8080/tcp   # HTTP monitoring

# Optional: Limit SSH
sudo ufw limit ssh

# Enable firewall
sudo ufw --force enable
sudo ufw status verbose
```

### iptables (Alternative)

```bash
# Allow incoming connections
iptables -A INPUT -p tcp --dport 5470 -j ACCEPT
iptables -A INPUT -p tcp --dport 8333 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Save rules (Ubuntu/Debian)
iptables-save > /etc/iptables/rules.v4
```

## 📈 Network Performance

### High-Performance Settings

```bash
# Increase connection limits
echo 'net.core.somaxconn = 65536' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65536' >> /etc/sysctl.conf
echo 'fs.file-max = 100000' >> /etc/sysctl.conf

# Apply settings
sysctl -p
```

### Process Limits

```bash
# Edit limits for user
sudo tee -a /etc/security/limits.conf <<EOF
runner soft nofile 65536
runner hard nofile 65536
runner soft nproc 65536
runner hard nproc 65536
EOF
```

## 🔍 Troubleshooting

### Common Issues

1. **Port Not Accessible**
   ```bash
   # Check if service is running
   netstat -tlnp | grep :5470
   
   # Test local connectivity
   telnet localhost 5470
   
   # Check firewall
   sudo ufw status
   ```

2. **DNS Resolution Failed**
   ```bash
   # Check /etc/hosts
   cat /etc/hosts
   
   # Test DNS resolution
   nslookup your-domain.com
   ```

3. **WebSocket Connection Failed**
   ```bash
   # Check Python websockets
   python3 -c "import websockets; print('WebSocket OK')"
   
   # Check if port is in use
   lsof -i :5470
   ```

### Log Analysis

```bash
# View seed node logs
tail -f core/seed_node.log

# Check system logs
sudo journalctl -u 5470-seed -f

# Monitor connections
ss -tulnp | grep :5470
```

## 🎯 Testing Connectivity

### Internal Tests

```bash
# Test all endpoints locally
curl http://localhost:8080/status
curl http://localhost:8080/peers
curl http://localhost:5000/api/peers
curl http://localhost:5000/api/getpeerinfo
```

### External Tests

```bash
# Test from another machine
curl http://YOUR_VPS_IP:8080/status
curl http://YOUR_VPS_IP:8080/peers

# WebSocket test (using websocat if available)
echo '{"type":"ping"}' | websocat ws://YOUR_VPS_IP:5470
```

## 📋 Maintenance

### Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update 5470 node
cd 5470-blockchain
git pull origin main
npm install
pip3 install -r requirements.txt

# Restart service
sudo systemctl restart 5470-seed
```

### Backup Configuration

```bash
# Backup important files
tar -czf 5470-backup-$(date +%Y%m%d).tar.gz \
    seed_node_config.json \
    peer_discovery.json \
    deploy_seed_node.sh \
    core/seed_node_server.py
```

## 🌐 Multi-VPS Network

### Deploy Multiple Seed Nodes

1. **Deploy on 3-5 different VPS providers**
   - DigitalOcean, Linode, Vultr, AWS, GCP
   - Different geographic regions
   - Ensure diversity in IP ranges

2. **Configure Cross-Connection**
   ```python
   # In seed_node_manager.py
   SEED_NODES = [
       "45.76.123.45:5470",     # VPS-1
       "139.180.191.67:5470",   # VPS-2  
       "207.148.78.123:5470",   # VPS-3
       "YOUR_NEW_VPS:5470"      # Your VPS
   ]
   ```

3. **Test Network Connectivity**
   ```bash
   # From each VPS, test others
   for ip in 45.76.123.45 139.180.191.67 207.148.78.123; do
       curl http://$ip:8080/status || echo "Failed: $ip"
   done
   ```

## ✅ Success Verification

Your seed node deployment is successful when:

- [ ] Service responds to `curl http://YOUR_VPS_IP:8080/status`
- [ ] Shows connected peers via `/peers` endpoint
- [ ] Firewall allows ports 5470 and 8333
- [ ] DNS resolution works for your domain
- [ ] WebSocket connections accepted on port 5470
- [ ] Systemd service runs automatically after reboot

---

## 📞 Support

For deployment issues:
1. Check logs: `sudo journalctl -u 5470-seed -f`
2. Verify network: `netstat -tlnp | grep 5470`
3. Test connectivity: Run external curl tests
4. Review this guide's troubleshooting section

**Network Status:** Active with 35.237.216.148 as primary seed node