import {
  appendBlock,
  buildCandidateBlock,
  sealBlock,
  getMiningStats,
  setMiningStats,
  credit,
} from "./storage";

let running = false;
let loopTimer: NodeJS.Timeout | null = null;

// ===== Config (env overrides allowed) =====
const TARGET_PREFIX = process.env.TARGET_PREFIX || "0000"; // PoW difficulty
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS || 2000);
const MINER_REWARD = Number(process.env.MINER_REWARD || 10);
const MINER_ADDRESS = process.env.MINER_ADDRESS || "0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18";

// ===== Mining Stats & Hashing =====
let totalHashes = 0;
let sessionStartTime = 0;
let lastHashCheckTime = 0;
let hashesInLastWindow = 0;

function calculateHashrate(): number {
  const now = Date.now();
  const elapsed = (now - lastHashCheckTime) / 1000; // seconds
  if (elapsed < 1) return 0; // Too early to calc
  
  const rate = hashesInLastWindow / elapsed;
  
  // Reset for next window
  lastHashCheckTime = now;
  hashesInLastWindow = 0;
  
  return Math.round(rate);
}

function incrementHashes(count = 1) {
  totalHashes += count;
  hashesInLastWindow += count;
}

function meetsDifficulty(hash: string): boolean {
  return hash.startsWith(TARGET_PREFIX);
}

// ===== Core Mining Loop =====
async function miningTick() {
  if (!running) return;

  try {
    const candidate = buildCandidateBlock({
      minerAddress: MINER_ADDRESS,
      rewardAmount: MINER_REWARD,
    });

    // Try nonces until we find a valid hash
    let found = false;
    const maxAttempts = 10000; // Prevent infinite loops
    
    for (let nonce = 0; nonce < maxAttempts && running && !found; nonce++) {
      const sealed = sealBlock(candidate, nonce);
      incrementHashes();
      
      if (meetsDifficulty(sealed.hash)) {
        // Found valid block!
        await appendBlock(sealed);
        await credit(MINER_ADDRESS, MINER_REWARD);
        
        const stats = getMiningStats();
        await setMiningStats({
          ...stats,
          totalBlocksMined: stats.totalBlocksMined + 1,
          totalHashes: totalHashes,
          lastBlockAt: Date.now(),
          hashrate: calculateHashrate(),
        });
        
        console.log(`⛏️ Block #${sealed.index} mined! Hash: ${sealed.hash.substring(0, 12)}... Reward: ${MINER_REWARD} tokens`);
        found = true;
      }
    }

    // Update hashrate even if no block found
    if (running) {
      const stats = getMiningStats();
      await setMiningStats({
        ...stats,
        totalHashes: totalHashes,
        hashrate: calculateHashrate(),
      });
    }
  } catch (error) {
    console.error("Mining tick error:", error);
  }

  // Schedule next tick
  if (running) {
    loopTimer = setTimeout(miningTick, TICK_INTERVAL_MS);
  }
}

// ===== Public API =====
export async function start(): Promise<boolean> {
  if (running) return true;

  running = true;
  sessionStartTime = Date.now();
  lastHashCheckTime = sessionStartTime;
  totalHashes = 0;
  hashesInLastWindow = 0;

  await setMiningStats({
    running: true,
    isActive: true,
    startedAt: sessionStartTime,
    hashrate: 0,
  });

  console.log(`🚀 Mining started with difficulty: ${TARGET_PREFIX}, reward: ${MINER_REWARD} tokens`);
  
  // Start mining loop
  miningTick();
  
  return true;
}

export async function stop(): Promise<void> {
  if (!running) return;

  running = false;
  
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  await setMiningStats({
    running: false,
    isActive: false,
    hashrate: 0,
  });

  console.log("⏹️ Mining stopped");
}

export function getStats() {
  const stats = getMiningStats();
  return {
    ...stats,
    totalHashes,
    sessionStartTime,
  };
}