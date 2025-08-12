/**
 * 🚀 EVM DEPLOYMENT ENGINE
 * Complete smart contract deployment system with multi-network support
 */

import express from "express";
import { ethers } from "ethers";
import type { Request, Response } from "express";

export const evmRouter = express.Router();

// Supported networks with RPC endpoints
const RPCS: Record<string, string> = {
  sepolia: process.env.EVM_RPC_SEPOLIA || "https://sepolia.infura.io/v3/demo",
  amoy: process.env.EVM_RPC_AMOY || "https://rpc-amoy.polygon.technology",
  anvil: process.env.EVM_RPC_ANVIL || "http://127.0.0.1:8545",
  localhost: "http://127.0.0.1:8545",
  // Quantum-Guard's own RPC
  quantum: process.env.QUANTUM_RPC || "http://127.0.0.1:5470"
};

interface DeployRequest {
  abi: any[];
  bytecode: string;
  args?: any[];
  network?: string;
  gasLimit?: number;
}

interface DeployResponse {
  ok: boolean;
  address?: string;
  txHash?: string;
  chainId?: number;
  blockNumber?: number;
  gasUsed?: number;
  rpc?: string;
  error?: string;
}

// POST /api/evm/deploy - Deploy smart contract to EVM network
evmRouter.post("/api/evm/deploy", express.json({ limit: "10mb" }), async (req: Request, res: Response) => {
  try {
    const { abi, bytecode, args = [], network = "sepolia", gasLimit }: DeployRequest = req.body;
    
    if (!abi || !bytecode) {
      return res.status(400).json({ 
        ok: false, 
        error: "Missing abi or bytecode" 
      } as DeployResponse);
    }

    // Determine RPC URL
    let rpc = RPCS[network];
    if (!rpc && typeof network === "string" && network.startsWith("http")) {
      rpc = network; // Custom RPC URL
    }
    
    if (!rpc) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid network: ${network}. Supported: ${Object.keys(RPCS).join(", ")}` 
      } as DeployResponse);
    }

    // Check for deployer private key
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk || pk.length < 32) {
      return res.status(500).json({ 
        ok: false, 
        error: "DEPLOYER_PRIVATE_KEY not configured" 
      } as DeployResponse);
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);

    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    // Estimate gas
    let gasEst: bigint;
    try {
      const deployTx = await factory.getDeployTransaction(...args);
      gasEst = await provider.estimateGas(deployTx);
    } catch (error) {
      console.warn("Gas estimation failed, using fallback:", error);
      gasEst = BigInt(gasLimit || 3_000_000);
    }

    // Add 20% buffer to gas estimate
    const finalGasLimit = gasEst + (gasEst * BigInt(20)) / BigInt(100);

    // Deploy contract
    const contract = await factory.deploy(...args, { 
      gasLimit: finalGasLimit 
    });
    
    const deployTx = contract.deploymentTransaction();
    if (!deployTx) {
      throw new Error("Deployment transaction not found");
    }

    // Wait for deployment
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    const receipt = await provider.getTransactionReceipt(deployTx.hash);
    const network_info = await provider.getNetwork();

    const response: DeployResponse = {
      ok: true,
      address,
      txHash: deployTx.hash,
      blockNumber: receipt?.blockNumber || undefined,
      gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed) : undefined,
      chainId: Number(network_info.chainId),
      rpc
    };

    res.json(response);

  } catch (error: any) {
    console.error("Deployment error:", error);
    
    const response: DeployResponse = {
      ok: false,
      error: error?.message || String(error)
    };
    
    res.status(500).json(response);
  }
});

// GET /api/evm/networks - Get supported networks
evmRouter.get("/api/evm/networks", (req: Request, res: Response) => {
  const networks = Object.keys(RPCS).map(key => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    rpc: RPCS[key],
    available: !!RPCS[key]
  }));

  res.json({
    ok: true,
    networks,
    hasDeployerKey: !!process.env.DEPLOYER_PRIVATE_KEY
  });
});

// POST /api/evm/estimate-gas - Estimate deployment gas
evmRouter.post("/api/evm/estimate-gas", express.json(), async (req: Request, res: Response) => {
  try {
    const { abi, bytecode, args = [], network = "sepolia" }: DeployRequest = req.body;
    
    if (!abi || !bytecode) {
      return res.status(400).json({ ok: false, error: "Missing abi or bytecode" });
    }

    const rpc = RPCS[network] || (typeof network === "string" && network.startsWith("http") ? network : "");
    if (!rpc) {
      return res.status(400).json({ ok: false, error: "Invalid network" });
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    const factory = new ethers.ContractFactory(abi, bytecode);
    
    const deployTx = await factory.getDeployTransaction(...args);
    const gasEstimate = await provider.estimateGas(deployTx);

    res.json({
      ok: true,
      gasEstimate: Number(gasEstimate),
      gasEstimateHex: gasEstimate.toString(16),
      network,
      rpc
    });

  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    });
  }
});