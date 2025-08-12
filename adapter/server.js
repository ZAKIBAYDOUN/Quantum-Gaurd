require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS for all origins (required by most aggregators)
app.use(cors());
app.use(express.json());

// Base URL for native 5470 Core API
const NATIVE_API = process.env.NATIVE_BASE_API || 'http://localhost:5000/api';

// Helper function to make requests to native API
async function callNativeAPI(endpoint, options = {}) {
  try {
    const response = await axios({
      url: `${NATIVE_API}${endpoint}`,
      timeout: 10000,
      ...options
    });
    return response.data;
  } catch (error) {
    console.error(`Error calling native API ${endpoint}:`, error.message);
    throw error;
  }
}

// Health check endpoint (required by most aggregators)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    service: "5470-dex-adapter",
    version: "1.0.0",
    native_api: NATIVE_API
  });
});

// 1inch/0x Style Endpoints

// Get all trading pairs (0x/1inch standard)
app.get('/swap/v1/pairs', async (req, res) => {
  try {
    const pools = await callNativeAPI('/amm/pools');
    
    // Convert native pools to 1inch format
    const pairs = [];
    
    // Add main 5470 pairs
    const mainPairs = [
      { base: '5470', quote: 'BTC' },
      { base: '5470', quote: 'ETH' },
      { base: '5470', quote: 'USDT' },
      { base: '5470', quote: 'USDC' }
    ];

    mainPairs.forEach(pair => {
      pairs.push({
        symbol: `${pair.base}/${pair.quote}`,
        base: pair.base,
        quote: pair.quote,
        active: true,
        fee: 0.003, // 0.3% fee
        minAmount: "0.01",
        maxAmount: "1000000"
      });
    });

    res.json({
      pairs: pairs,
      count: pairs.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch pairs",
      message: error.message
    });
  }
});

// Get price quote (1inch standard)
app.get('/swap/v1/price', async (req, res) => {
  try {
    const { sellToken, buyToken, sellAmount } = req.query;
    
    if (!sellToken || !buyToken || !sellAmount) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["sellToken", "buyToken", "sellAmount"]
      });
    }

    // Call native price endpoint
    const priceData = await callNativeAPI('/amm/price', {
      method: 'POST',
      data: {
        fromToken: sellToken,
        toToken: buyToken,
        amount: parseFloat(sellAmount)
      }
    });

    // Convert to 1inch format
    const response = {
      sellToken: sellToken,
      buyToken: buyToken,
      sellAmount: sellAmount,
      buyAmount: priceData.outputAmount || "0",
      price: priceData.price || "0",
      guaranteedPrice: priceData.guaranteedPrice || priceData.price || "0",
      to: "0x5470000000000000000000000000000000000000", // 5470 DEX contract
      data: "0x", // Transaction data would go here
      value: "0",
      gas: "150000",
      gasPrice: "20000000000",
      protocolFee: "0",
      minimumProtocolFee: "0",
      buyTokenToEthRate: "1",
      sellTokenToEthRate: "1",
      sources: [
        {
          name: "5470_AMM",
          proportion: "1"
        }
      ],
      orders: [],
      allowanceTarget: "0x5470000000000000000000000000000000000000",
      sellTokenAddress: getTokenAddress(sellToken),
      buyTokenAddress: getTokenAddress(buyToken),
      fees: {
        zeroExFee: null
      }
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get price",
      message: error.message
    });
  }
});

// Get swap quote with transaction data (1inch standard)
app.get('/swap/v1/quote', async (req, res) => {
  try {
    const { sellToken, buyToken, sellAmount, slippagePercentage = 1 } = req.query;
    
    if (!sellToken || !buyToken || !sellAmount) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["sellToken", "buyToken", "sellAmount"]
      });
    }

    // Get price first
    const priceData = await callNativeAPI('/amm/price', {
      method: 'POST',
      data: {
        fromToken: sellToken,
        toToken: buyToken,
        amount: parseFloat(sellAmount)
      }
    });

    // Calculate minimum amount out with slippage
    const buyAmount = parseFloat(priceData.outputAmount || 0);
    const minBuyAmount = buyAmount * (1 - parseFloat(slippagePercentage) / 100);

    const response = {
      sellToken: sellToken,
      buyToken: buyToken,
      sellAmount: sellAmount,
      buyAmount: buyAmount.toString(),
      minBuyAmount: minBuyAmount.toString(),
      price: priceData.price || "0",
      guaranteedPrice: (buyAmount / parseFloat(sellAmount)).toString(),
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
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get quote",
      message: error.message
    });
  }
});

// DEX specific endpoints

// Get pool information (DefiLlama style)
app.get('/dex/pools', async (req, res) => {
  try {
    const pools = await callNativeAPI('/amm/pools');
    
    const formattedPools = [
      {
        id: "5470_BTC",
        name: "5470/BTC",
        symbol: "5470-BTC",
        token0: {
          address: getTokenAddress("5470"),
          symbol: "5470",
          decimals: 8
        },
        token1: {
          address: getTokenAddress("BTC"),
          symbol: "BTC", 
          decimals: 8
        },
        reserves: ["0", "0"], // Would come from actual pool data
        totalSupply: "0",
        fee: 0.003,
        volumeUSD: "0",
        liquidityUSD: "0"
      },
      {
        id: "5470_ETH",
        name: "5470/ETH",
        symbol: "5470-ETH",
        token0: {
          address: getTokenAddress("5470"),
          symbol: "5470",
          decimals: 8
        },
        token1: {
          address: getTokenAddress("ETH"),
          symbol: "ETH",
          decimals: 18
        },
        reserves: ["0", "0"],
        totalSupply: "0", 
        fee: 0.003,
        volumeUSD: "0",
        liquidityUSD: "0"
      }
    ];

    res.json({
      pools: formattedPools,
      count: formattedPools.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch pools",
      message: error.message
    });
  }
});

// Get token list
app.get('/tokens', (req, res) => {
  const tokens = [
    {
      address: getTokenAddress("5470"),
      symbol: "5470",
      name: "5470 Core",
      decimals: 8,
      logoURI: "https://example.com/5470.png"
    },
    {
      address: getTokenAddress("BTC"),
      symbol: "BTC", 
      name: "Bitcoin",
      decimals: 8,
      logoURI: "https://example.com/btc.png"
    },
    {
      address: getTokenAddress("ETH"),
      symbol: "ETH",
      name: "Ethereum", 
      decimals: 18,
      logoURI: "https://example.com/eth.png"
    },
    {
      address: getTokenAddress("USDT"),
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      logoURI: "https://example.com/usdt.png"
    },
    {
      address: getTokenAddress("USDC"),
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      logoURI: "https://example.com/usdc.png"
    }
  ];

  res.json({
    tokens: tokens,
    count: tokens.length,
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
  // This would generate actual transaction data for the swap
  // For now, return a placeholder
  return "0x095ea7b3" + 
         "0000000000000000000000005470000000000000000000000000000000000000" +
         parseInt(sellAmount).toString(16).padStart(64, '0');
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 5470 DEX Adapter running on port ${PORT}`);
  console.log(`📡 Native API: ${NATIVE_API}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`💱 Pairs: http://localhost:${PORT}/swap/v1/pairs`);
  console.log(`💰 Ready for 1inch/OpenOcean/DefiLlama integration!`);
});