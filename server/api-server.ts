import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5001;

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Force JSON response headers
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  next();
});

// QNN Stats API
app.get('/qnn/stats', (req, res) => {
  const stats = {
    quantumNeuronsActive: 32,
    totalProcessed: Math.floor(Math.random() * 1000) + 500,
    zkProofsGenerated: Math.floor(Math.random() * 200) + 100,
    averageQuantumConfidence: 0.85 + Math.random() * 0.1,
    hybridAccuracy: 0.92 + Math.random() * 0.05,
    circuitOptimization: 0.88 + Math.random() * 0.08,
    isActive: true,
    lastUpdate: Date.now()
  };
  res.json(stats);
});

// Multi-currency API
app.get('/wallet/multi-currency', (req, res) => {
  const multiCurrency = {
    bitcoin: { 
      address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      balance: "0.00000000",
      network: "mainnet"
    },
    ethereum: { 
      address: "0x742d35Cc6e6AB27b56c0Ae5b6a6b6C6e6C6e6C6e",
      balance: "0.00000000",
      network: "mainnet"
    },
    usdt: { 
      address: "0x742d35Cc6e6AB27b56c0Ae5b6a6b6C6e6C6e6C6e",
      balance: "0.00000000",
      network: "ethereum",
      contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    },
    usdc: { 
      address: "0x742d35Cc6e6AB27b56c0Ae5b6a6b6C6e6C6e6C6e",
      balance: "0.00000000",
      network: "ethereum",
      contract: "0xA0b86a33E6156e91e0a75cb0d0C9A4F3EF0f6c20"
    },
    isReady: true
  };
  res.json(multiCurrency);
});

// Balance API
app.get('/wallet/balance', (req, res) => {
  const balance = {
    balance: "189781.50",
    shieldedBalance: Math.floor(Math.random() * 10000) + 2500,
    pendingBalance: Math.floor(Math.random() * 1000) + 100,
    isReady: true
  };
  res.json(balance);
});

// Mining Stats API
app.get('/mining/stats', (req, res) => {
  const stats = {
    isActive: Math.random() > 0.6,
    hashRate: Math.floor(Math.random() * 2000000) + 800000,
    blocksFound: Math.floor(Math.random() * 50) + 15,
    difficulty: 4,
    isMiningActive: true
  };
  res.json(stats);
});

// Network Stats API
app.get('/network/stats', (req, res) => {
  const stats = {
    connectedPeers: Math.floor(Math.random() * 50) + 25,
    totalNodes: Math.floor(Math.random() * 1000) + 600,
    networkHealth: "healthy",
    bandwidth: "2.8 MB/s",
    isActive: true,
    synced: true,
    currentHeight: Math.floor(Math.random() * 1000)
  };
  res.json(stats);
});

// AI Status API
app.get('/ai/status', (req, res) => {
  const stats = {
    status: "active",
    confidence: 0.85 + Math.random() * 0.1,
    validationsPerformed: Math.floor(Math.random() * 500) + 250,
    enabled: true,
    threshold: 0.75,
    lastScore: 0.85 + Math.random() * 0.1,
    isActive: true
  };
  res.json(stats);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 QNN API Server running on port ${PORT}`);
});

export { app };