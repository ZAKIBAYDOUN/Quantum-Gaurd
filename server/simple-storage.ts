// Sistema de storage simplificado sin loops
import fs from "fs";
import path from "path";

export interface SimpleMiningStats {
  isActive: boolean;
  hashRate: number;
  blocksFound: number;
  totalHashes: number;
  startedAt: number | null;
  lastBlockAt: number | null;
}

let miningState: SimpleMiningStats = {
  isActive: false,
  hashRate: 0,
  blocksFound: 0,
  totalHashes: 0,
  startedAt: null,
  lastBlockAt: null
};

let balanceData = {
  "0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18": 189781
};

// Mining functions
export function getMiningStats(): SimpleMiningStats {
  return { ...miningState };
}

export async function startMining(): Promise<boolean> {
  if (miningState.isActive) return true;
  
  miningState.isActive = true;
  miningState.startedAt = Date.now();
  miningState.hashRate = Math.floor(Math.random() * 2000000) + 800000;
  
  // Simulate mining with simple interval
  const miningInterval = setInterval(() => {
    if (!miningState.isActive) {
      clearInterval(miningInterval);
      return;
    }
    
    miningState.totalHashes += miningState.hashRate;
    
    // 10% chance to find a block every 2 seconds
    if (Math.random() < 0.1) {
      miningState.blocksFound++;
      miningState.lastBlockAt = Date.now();
      
      // Add reward to balance
      const rewardAddress = "0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18";
      balanceData[rewardAddress] = (balanceData[rewardAddress] || 0) + 10;
      
      console.log(`⛏️ Block #${miningState.blocksFound} mined! Reward: 10 tokens`);
    }
  }, 2000);
  
  return true;
}

export async function stopMining(): Promise<void> {
  miningState.isActive = false;
}

// Balance functions
export function getBalance(): number {
  return Object.values(balanceData).reduce((sum, bal) => sum + bal, 0);
}

export function getBalances() {
  return { ...balanceData };
}

// Blockchain data
export function getBlockchainData() {
  return {
    totalBlocks: miningState.blocksFound,
    difficulty: 4,
    lastBlockTime: miningState.lastBlockAt ? new Date(miningState.lastBlockAt).toISOString() : null,
    synced: true,
    networkHealth: "healthy"
  };
}

// Sync with live balance from logs
export function syncWithLiveBalance() {
  try {
    const snapshotPath = path.join(process.cwd(), "balance_snapshots.json");
    if (fs.existsSync(snapshotPath)) {
      const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      if (data.balance && data.balance > 0) {
        balanceData["0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18"] = data.balance;
        console.log(`🔄 Synced with live balance: ${data.balance} tokens`);
        return data.balance;
      }
    }
  } catch (error) {
    console.log("No snapshot found");
  }
  return 189781; // Fallback
}

// Monitor balance changes every 5 seconds
export function startBalanceMonitor() {
  setInterval(() => {
    syncWithLiveBalance();
  }, 5000);
  console.log("📊 Balance monitor started - syncing every 5 seconds");
}

// Initialize
syncWithLiveBalance();
startBalanceMonitor();