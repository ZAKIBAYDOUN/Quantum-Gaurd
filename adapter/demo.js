// Demo del Adapter DEX 5470 - Prueba de endpoints
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simulación de datos DEX 5470 para demostración
const mockData = {
  health: {
    ok: true,
    timestamp: Date.now(),
    service: "5470-dex-adapter",
    version: "1.0.0",
    native_api: "http://localhost:5000/api"
  },
  pairs: [
    { symbol: "5470/BTC", base: "5470", quote: "BTC", active: true, fee: 0.003, minAmount: "0.01", maxAmount: "1000000" },
    { symbol: "5470/ETH", base: "5470", quote: "ETH", active: true, fee: 0.003, minAmount: "0.01", maxAmount: "1000000" },
    { symbol: "5470/USDT", base: "5470", quote: "USDT", active: true, fee: 0.003, minAmount: "0.01", maxAmount: "1000000" },
    { symbol: "5470/USDC", base: "5470", quote: "USDC", active: true, fee: 0.003, minAmount: "0.01", maxAmount: "1000000" }
  ],
  tokens: [
    { address: "0x5470000000000000000000000000000000000547", symbol: "5470", name: "5470 Core", decimals: 8, logoURI: "https://example.com/5470.png" },
    { address: "0x0000000000000000000000000000000000000BTC", symbol: "BTC", name: "Bitcoin", decimals: 8, logoURI: "https://example.com/btc.png" },
    { address: "0x0000000000000000000000000000000000000ETH", symbol: "ETH", name: "Ethereum", decimals: 18, logoURI: "https://example.com/eth.png" },
    { address: "0x0000000000000000000000000000000000000USDT", symbol: "USDT", name: "Tether USD", decimals: 6, logoURI: "https://example.com/usdt.png" },
    { address: "0x0000000000000000000000000000000000000USDC", symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "https://example.com/usdc.png" }
  ]
};

// Health check
app.get('/health', (req, res) => {
  res.json(mockData.health);
});

// Trading pairs
app.get('/swap/v1/pairs', (req, res) => {
  res.json({
    pairs: mockData.pairs,
    count: mockData.pairs.length,
    timestamp: Date.now()
  });
});

// Price quote
app.get('/swap/v1/price', (req, res) => {
  const { sellToken, buyToken, sellAmount } = req.query;
  
  if (!sellToken || !buyToken || !sellAmount) {
    return res.status(400).json({
      error: "Missing required parameters",
      required: ["sellToken", "buyToken", "sellAmount"]
    });
  }

  // Simulate price calculation
  const amount = parseFloat(sellAmount);
  let buyAmount = "0";
  let price = "0";

  if (sellToken === "5470" && buyToken === "BTC") {
    buyAmount = (amount * 0.00002).toString();
    price = "0.00002";
  } else if (sellToken === "5470" && buyToken === "ETH") {
    buyAmount = (amount * 0.0005).toString();
    price = "0.0005";
  } else if (sellToken === "5470" && buyToken === "USDT") {
    buyAmount = (amount * 0.5).toString();
    price = "0.5";
  } else if (sellToken === "5470" && buyToken === "USDC") {
    buyAmount = (amount * 0.5).toString();
    price = "0.5";
  }

  res.json({
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    price,
    guaranteedPrice: price,
    to: "0x5470000000000000000000000000000000000000",
    data: "0x",
    value: "0",
    gas: "150000",
    gasPrice: "20000000000",
    protocolFee: "0",
    minimumProtocolFee: "0",
    buyTokenToEthRate: "1",
    sellTokenToEthRate: "1",
    sources: [{ name: "5470_AMM", proportion: "1" }],
    orders: [],
    allowanceTarget: "0x5470000000000000000000000000000000000000",
    sellTokenAddress: getTokenAddress(sellToken),
    buyTokenAddress: getTokenAddress(buyToken),
    fees: { zeroExFee: null }
  });
});

// Swap quote
app.get('/swap/v1/quote', (req, res) => {
  const { sellToken, buyToken, sellAmount, slippagePercentage = 1 } = req.query;
  
  if (!sellToken || !buyToken || !sellAmount) {
    return res.status(400).json({
      error: "Missing required parameters",
      required: ["sellToken", "buyToken", "sellAmount"]
    });
  }

  // Use same price logic as /price endpoint
  const amount = parseFloat(sellAmount);
  let buyAmount = 0;
  let price = "0";

  if (sellToken === "5470" && buyToken === "BTC") {
    buyAmount = amount * 0.00002;
    price = "0.00002";
  } else if (sellToken === "5470" && buyToken === "ETH") {
    buyAmount = amount * 0.0005;
    price = "0.0005";
  } else if (sellToken === "5470" && buyToken === "USDT") {
    buyAmount = amount * 0.5;
    price = "0.5";
  } else if (sellToken === "5470" && buyToken === "USDC") {
    buyAmount = amount * 0.5;
    price = "0.5";
  }

  const minBuyAmount = buyAmount * (1 - parseFloat(slippagePercentage) / 100);

  res.json({
    sellToken,
    buyToken,
    sellAmount,
    buyAmount: buyAmount.toString(),
    minBuyAmount: minBuyAmount.toString(),
    price,
    guaranteedPrice: (buyAmount / amount).toString(),
    to: "0x5470000000000000000000000000000000000000",
    data: generateSwapData(sellToken, buyToken, sellAmount, minBuyAmount),
    value: sellToken === "ETH" ? sellAmount : "0",
    gas: "200000",
    gasPrice: "20000000000",
    protocolFee: "0",
    minimumProtocolFee: "0",
    buyTokenToEthRate: "1",
    sellTokenToEthRate: "1",
    allowanceTarget: "0x5470000000000000000000000000000000000000",
    sellTokenAddress: getTokenAddress(sellToken),
    buyTokenAddress: getTokenAddress(buyToken)
  });
});

// DEX pools
app.get('/dex/pools', (req, res) => {
  const pools = [
    {
      id: "5470_BTC",
      name: "5470/BTC",
      symbol: "5470-BTC",
      token0: { address: getTokenAddress("5470"), symbol: "5470", decimals: 8 },
      token1: { address: getTokenAddress("BTC"), symbol: "BTC", decimals: 8 },
      reserves: ["10000", "0.2"],
      totalSupply: "1000",
      fee: 0.003,
      volumeUSD: "50000",
      liquidityUSD: "5000"
    },
    {
      id: "5470_ETH",
      name: "5470/ETH",
      symbol: "5470-ETH",
      token0: { address: getTokenAddress("5470"), symbol: "5470", decimals: 8 },
      token1: { address: getTokenAddress("ETH"), symbol: "ETH", decimals: 18 },
      reserves: ["20000", "10"],
      totalSupply: "2000",
      fee: 0.003,
      volumeUSD: "100000",
      liquidityUSD: "25000"
    }
  ];

  res.json({
    pools,
    count: pools.length,
    timestamp: Date.now()
  });
});

// Tokens
app.get('/tokens', (req, res) => {
  res.json({
    tokens: mockData.tokens,
    count: mockData.tokens.length,
    timestamp: Date.now()
  });
});

// Helper functions
function getTokenAddress(symbol) {
  const addresses = {
    "5470": "0x5470000000000000000000000000000000000547",
    "BTC": "0x0000000000000000000000000000000000000BTC",
    "ETH": "0x0000000000000000000000000000000000000ETH",
    "USDT": "0x0000000000000000000000000000000000000USDT",
    "USDC": "0x0000000000000000000000000000000000000USDC"
  };
  return addresses[symbol] || "0x0000000000000000000000000000000000000000";
}

function generateSwapData(sellToken, buyToken, sellAmount, minBuyAmount) {
  return "0x095ea7b3" + 
         "0000000000000000000000005470000000000000000000000000000000000000" +
         parseInt(sellAmount).toString(16).padStart(64, '0');
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    available_endpoints: [
      "GET /health",
      "GET /swap/v1/pairs",
      "GET /swap/v1/price",
      "GET /swap/v1/quote",
      "GET /dex/pools",
      "GET /tokens"
    ]
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 5470 DEX Adapter Demo running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`💱 Pairs: http://localhost:${PORT}/swap/v1/pairs`);
  console.log(`💰 Ready for 1inch/OpenOcean/DefiLlama integration!`);
  console.log(`\n📋 Test commands:`);
  console.log(`curl http://localhost:${PORT}/health`);
  console.log(`curl http://localhost:${PORT}/swap/v1/pairs`);
  console.log(`curl "http://localhost:${PORT}/swap/v1/price?sellToken=5470&buyToken=BTC&sellAmount=10"`);
});