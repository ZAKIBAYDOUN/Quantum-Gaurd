import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

export type Balances = Record<string, number>;

export interface Block {
  index: number;
  timestamp: number;
  prevHash: string;
  hash: string;
  nonce: number;
  transactions: Array<{ from?: string; to: string; amount: number }>;
  miner: string | null;
}

export interface MiningStats {
  running: boolean;
  isActive?: boolean; // convenience mirror of `running` for frontend
  startedAt: number | null;
  lastBlockAt: number | null;
  totalBlocksMined: number;
  totalHashes: number;
  hashrate: number; // hashes/sec (rolling)
}

type BalanceSnapshot = {
  timestamp: number;
  totalSupply: number;
  balances: Balances;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILES = {
  balances: path.join(DATA_DIR, "balances.json"),
  balanceSnapshots: path.join(DATA_DIR, "balance_snapshots.json"),
  blocks: path.join(DATA_DIR, "blocks.json"),
  miningStats: path.join(DATA_DIR, "mining_stats.json"),
};

// Legacy files from Python system (real data location)
const LEGACY_FILES = {
  balanceSnapshots: path.resolve(process.cwd(), "balance_snapshots.json"),
  balances: path.resolve(process.cwd(), "balances.json"),
};

let balancesCache: Balances = {};
let blocksCache: Block[] = [];
let miningStatsCache: MiningStats = {
  running: false,
  isActive: false,
  startedAt: null,
  lastBlockAt: null,
  totalBlocksMined: 0,
  totalHashes: 0,
  hashrate: 0,
};

let lastBalanceSnapshotAt = 0;
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============ FS HELPERS ============
async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const buf = await fsp.readFile(file, "utf8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

async function writeJSONAtomic(file: string, data: any) {
  await ensureDir(path.dirname(file));
  const tmp = file + ".tmp";
  const json = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmp, json, "utf8");
  await fsp.rename(tmp, file);
}

// ============ HASHING ============
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ============ LOAD & INIT ============
export async function init() {
  await ensureDir(DATA_DIR);

  balancesCache = await readJSON<Balances>(FILES.balances, {});
  blocksCache = await readJSON<Block[]>(FILES.blocks, []);
  miningStatsCache = await readJSON<MiningStats>(FILES.miningStats, miningStatsCache);

  // Genesis block if needed
  if (blocksCache.length === 0) {
    const genesis: Block = {
      index: 0,
      timestamp: Date.now(),
      prevHash: "0".repeat(64),
      nonce: 0,
      transactions: [],
      miner: null,
      hash: "",
    };
    genesis.hash = sha256(JSON.stringify({ ...genesis, hash: undefined }));
    blocksCache.push(genesis);
    await writeJSONAtomic(FILES.blocks, blocksCache);
  }

  // Connect to real balance system from Python
  await connectToLegacySystem();
  
  // Restore balances if corrupted/empty from snapshot
  const restored = await restoreBalancesFromSnapshots();
  if (restored) {
    console.log("💾 Restored balances from snapshot.");
  }

  // Persist loaded defaults to ensure files exist
  await writeJSONAtomic(FILES.balances, balancesCache);
  await writeJSONAtomic(FILES.miningStats, miningStatsCache);

  // Graceful persist
  const persistAndExit = async () => {
    await persistAll();
    process.exit(0);
  };
  process.once("SIGINT", persistAndExit);
  process.once("SIGTERM", persistAndExit);
}

// Connect to legacy Python system with real balance data
async function connectToLegacySystem(): Promise<void> {
  try {
    // Read real balance snapshot from Python system
    const legacySnapshot = await readJSON<any>(LEGACY_FILES.balanceSnapshots, null);
    
    if (legacySnapshot && legacySnapshot.balance && legacySnapshot.address) {
      const realBalance = Number(legacySnapshot.balance);
      const realAddress = legacySnapshot.address;
      
      if (realBalance > 0 && realAddress) {
        // Update our cache with real balance
        balancesCache = { [realAddress]: realBalance };
        await writeJSONAtomic(FILES.balances, balancesCache);
        console.log(`🔗 Connected to legacy system: ${realBalance} tokens for ${realAddress}`);
        
        // Create snapshot in new format
        await maybeSnapshotBalances(true);
      }
    }
  } catch (error) {
    console.warn("⚠️ Could not connect to legacy system:", error);
  }
}

export async function persistAll() {
  await Promise.all([
    writeJSONAtomic(FILES.balances, balancesCache),
    writeJSONAtomic(FILES.blocks, blocksCache),
    writeJSONAtomic(FILES.miningStats, miningStatsCache),
  ]);
}

// ============ BALANCES ============
export function getBalances(): Balances {
  return balancesCache;
}

export function getTotalSupply(b: Balances = balancesCache): number {
  return Object.values(b).reduce((a, n) => a + Number(n || 0), 0);
}

export async function setBalances(next: Balances) {
  balancesCache = sanitizeBalances(next);
  await writeJSONAtomic(FILES.balances, balancesCache);
  await maybeSnapshotBalances();
}

export async function credit(address: string, amount: number) {
  if (!address) throw new Error("Invalid address");
  if (!(Number.isFinite(amount) && amount > 0)) throw new Error("Invalid amount");
  balancesCache[address] = (balancesCache[address] || 0) + amount;
  await writeJSONAtomic(FILES.balances, balancesCache);
  await maybeSnapshotBalances();
}

export async function debit(address: string, amount: number) {
  if (!address) throw new Error("Invalid address");
  if (!(Number.isFinite(amount) && amount > 0)) throw new Error("Invalid amount");
  const cur = balancesCache[address] || 0;
  if (cur < amount) throw new Error("Insufficient balance");
  balancesCache[address] = cur - amount;
  if (balancesCache[address] === 0) delete balancesCache[address];
  await writeJSONAtomic(FILES.balances, balancesCache);
  await maybeSnapshotBalances();
}

export async function transfer(from: string, to: string, amount: number) {
  if (from === to) throw new Error("Sender and receiver must differ");
  await debit(from, amount);
  await credit(to, amount);
}

function sanitizeBalances(b: Balances): Balances {
  const out: Balances = {};
  for (const [k, v] of Object.entries(b || {})) {
    const num = Number(v);
    if (k && Number.isFinite(num) && num > 0) out[k] = num;
  }
  return out;
}

async function maybeSnapshotBalances(force = false) {
  const now = Date.now();
  if (!force && now - lastBalanceSnapshotAt < SNAPSHOT_MIN_INTERVAL_MS) return;

  const snapshotEntry: BalanceSnapshot = {
    timestamp: now,
    totalSupply: getTotalSupply(),
    balances: balancesCache,
  };

  const existing = (await readJSON<any>(FILES.balanceSnapshots, [])) ?? [];
  let snapshots: BalanceSnapshot[];

  if (Array.isArray(existing)) {
    snapshots = existing;
  } else if (existing && Array.isArray(existing.snapshots)) {
    snapshots = existing.snapshots;
  } else {
    snapshots = [];
  }

  snapshots.push(snapshotEntry);
  if (snapshots.length > 200) snapshots = snapshots.slice(-200);

  await writeJSONAtomic(FILES.balanceSnapshots, { snapshots });
  lastBalanceSnapshotAt = now;
}

/**
 * Balance restoration from balance_snapshots.json
 */
export async function restoreBalancesFromSnapshots(): Promise<boolean> {
  const existing = (await readJSON<any>(FILES.balanceSnapshots, [])) ?? [];
  let snapshots: BalanceSnapshot[];

  if (Array.isArray(existing)) {
    snapshots = existing as BalanceSnapshot[];
  } else if (existing && Array.isArray(existing.snapshots)) {
    snapshots = existing.snapshots as BalanceSnapshot[];
  } else {
    snapshots = [];
  }
  if (snapshots.length === 0) return false;

  const latest = snapshots.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
  const currentTotal = getTotalSupply(balancesCache);
  const latestTotal = latest.totalSupply || getTotalSupply(latest.balances || {});
  const shouldRestore = currentTotal === 0 || currentTotal < latestTotal;

  if (shouldRestore) {
    balancesCache = sanitizeBalances(latest.balances || {});
    await writeJSONAtomic(FILES.balances, balancesCache);
    return true;
  }
  return false;
}

// ============ BLOCKCHAIN ============
export function getBlocks(): Block[] {
  return blocksCache;
}

export async function appendBlock(block: Block) {
  // Basic linkage check
  const last = blocksCache[blocksCache.length - 1];
  if (block.prevHash !== last.hash) throw new Error("Invalid prevHash");

  blocksCache.push(block);
  await writeJSONAtomic(FILES.blocks, blocksCache);

  // Snapshot balances occasionally as well
  await maybeSnapshotBalances(false);
}

// ============ MINING STATS ============
export function getMiningStats(): MiningStats {
  return miningStatsCache;
}
export async function setMiningStats(next: Partial<MiningStats>) {
  miningStatsCache = { ...miningStatsCache, ...next };
  // Mirror running into isActive for frontend grep
  if (typeof next.running === "boolean") {
    miningStatsCache.isActive = next.running;
  }
  await writeJSONAtomic(FILES.miningStats, miningStatsCache);
}

// ============ REWARD & BLOCK BUILD ============
export function buildCandidateBlock({
  minerAddress,
  rewardAmount,
  extraTx = [],
}: {
  minerAddress: string | null;
  rewardAmount: number;
  extraTx?: Array<{ from?: string; to: string; amount: number }>;
}): Block {
  const last = blocksCache[blocksCache.length - 1];
  const index = last.index + 1;
  const timestamp = Date.now();
  const transactions = [
    ...(extraTx || []),
    ...(minerAddress && rewardAmount > 0 ? [{ to: minerAddress, amount: rewardAmount }] : []),
  ];
  return {
    index,
    timestamp,
    prevHash: last.hash,
    transactions,
    miner: minerAddress,
    nonce: 0,
    hash: "",
  };
}

export function sealBlock(candidate: Omit<Block, "hash"> & { hash?: string }, nonce: number): Block {
  const headerForHash = { ...candidate, hash: undefined, nonce };
  const hash = sha256(JSON.stringify(headerForHash));
  return { ...(candidate as Block), nonce, hash };
}