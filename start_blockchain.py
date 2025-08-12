#!/usr/bin/env python3
"""
Startup script for the 5470 Blockchain
This script ensures the blockchain starts properly and handles any dependencies
"""
import subprocess
import sys
import os
import time
import signal
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def install_dependencies():
    """Install required Python packages"""
    requirements = [
        'numpy',
        'tensorflow',
        'eth-keys',
        'eth-utils',
    ]
    
    for package in requirements:
        try:
            __import__(package.replace('-', '_'))
            logger.info(f"✓ {package} is already installed")
        except ImportError:
            logger.info(f"Installing {package}...")
            try:
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
                logger.info(f"✓ {package} installed successfully")
            except subprocess.CalledProcessError:
                logger.warning(f"Failed to install {package}, continuing anyway...")

def create_config():
    """Create default configuration if it doesn't exist"""
    config = {
        "token_symbol": "5470",
        "base_unit": 100000000,
        "chain_id": 5470,
        "block_time": 5,
        "block_reward": 50,
        "commission_rate": 0.002,
        "pow_difficulty": 4,
        "ai_enabled": True,
        "zk_enabled": True,
        "anomaly_threshold": 0.10
    }
    
    if not os.path.exists('config.json'):
        import json
        with open('config.json', 'w') as f:
            json.dump(config, f, indent=2)
        logger.info("✓ Created default config.json")

def start_blockchain():
    """Start the blockchain process"""
    logger.info("🚀 Starting 5470 Blockchain Core...")
    
    # Create config if needed
    create_config()
    
    # Install dependencies
    install_dependencies()
    
    # Start the blockchain
    try:
        process = subprocess.Popen(
            [sys.executable, 'blockchain_5470_synced_ai_zk.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        logger.info("✅ Blockchain started successfully!")
        logger.info("📡 HTTP RPC Server: http://localhost:5000")
        logger.info("🔗 WebSocket P2P: ws://localhost:5000/ws")
        logger.info("⛏️  Mining: Auto-start enabled")
        logger.info("🧠 AI Anomaly Detection: Enabled")
        logger.info("🔒 ZK-Proofs: Enabled")
        
        # Handle shutdown gracefully
        def signal_handler(sig, frame):
            logger.info("🛑 Shutting down blockchain...")
            process.terminate()
            process.wait()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Wait for the process
        process.wait()
        
    except Exception as e:
        logger.error(f"❌ Failed to start blockchain: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_blockchain()
