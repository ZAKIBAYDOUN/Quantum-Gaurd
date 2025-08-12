import { z } from "zod";
import { pgTable, serial, varchar, decimal, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Database tables for persistent storage
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 42 }).notNull().unique(),
  balance: decimal("balance", { precision: 20, scale: 8 }).notNull().default("0"),
  privateBalance: decimal("private_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  totalMined: decimal("total_mined", { precision: 20, scale: 8 }).notNull().default("0"),
  totalBlocks: integer("total_blocks").notNull().default(0),
  lastMiningSession: timestamp("last_mining_session").defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Multi-currency wallet addresses table
export const multiWalletAddresses = pgTable("multi_wallet_addresses", {
  id: serial("id").primaryKey(),
  mainWallet: varchar("main_wallet", { length: 42 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(), // BTC, ETH, USDT, USDC
  address: varchar("address", { length: 64 }).notNull(),
  balance: decimal("balance", { precision: 20, scale: 8 }).notNull().default("0"),
  privateKey: varchar("private_key", { length: 128 }), // Encrypted
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const miningRewards = pgTable("mining_rewards", {
  id: serial("id").primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  blockHeight: integer("block_height").notNull(),
  reward: decimal("reward", { precision: 20, scale: 8 }).notNull(),
  minedAt: timestamp("mined_at").defaultNow(),
  sessionId: varchar("session_id", { length: 64 }).notNull()
});

// User permanent addresses table for production
export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().unique(),
  primaryAddress: varchar("primary_address", { length: 42 }).notNull(),
  privateKey: text("private_key").notNull(), // Encrypted with AES-256
  btcAddress: varchar("btc_address", { length: 64 }).notNull(),
  btcPrivateKey: text("btc_private_key").notNull(),
  ethAddress: varchar("eth_address", { length: 42 }).notNull(),
  ethPrivateKey: text("eth_private_key").notNull(),
  usdtAddress: varchar("usdt_address", { length: 42 }).notNull(),
  usdcAddress: varchar("usdc_address", { length: 42 }).notNull(),
  balance: decimal("balance", { precision: 30, scale: 18 }).notNull().default("0"),
  totalMined: decimal("total_mined", { precision: 30, scale: 18 }).notNull().default("0"),
  totalBlocks: integer("total_blocks").notNull().default(0),
  miningActive: boolean("mining_active").notNull().default(false),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// P2P Peers table for 100k+ scaling
export const p2pPeers = pgTable("p2p_peers", {
  id: serial("id").primaryKey(),
  peerId: varchar("peer_id", { length: 64 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  port: integer("port").notNull(),
  publicKey: text("public_key"),
  region: varchar("region", { length: 50 }),
  country: varchar("country", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  reliability: decimal("reliability", { precision: 5, scale: 2 }).notNull().default("100.00"),
  lastSeen: timestamp("last_seen").defaultNow(),
  totalBlocks: integer("total_blocks").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow()
});

// Real-time mining sessions
export const miningSessions = pgTable("mining_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  minerAddress: varchar("miner_address", { length: 42 }).notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  blocksFound: integer("blocks_found").notNull().default(0),
  totalReward: decimal("total_reward", { precision: 30, scale: 18 }).notNull().default("0"),
  hashRate: integer("hash_rate").notNull().default(1200000),
  difficulty: integer("difficulty").notNull().default(4),
  isActive: boolean("is_active").notNull().default(true),
  qnnValidations: integer("qnn_validations").notNull().default(0)
});

// Insert and select schemas
export const insertWalletSchema = createInsertSchema(wallets);
export const selectWalletSchema = createSelectSchema(wallets);
export const insertMiningRewardSchema = createInsertSchema(miningRewards);
export const selectMiningRewardSchema = createSelectSchema(miningRewards);
export const insertMultiWalletSchema = createInsertSchema(multiWalletAddresses);
export const selectMultiWalletSchema = createSelectSchema(multiWalletAddresses);
export const insertUserAddressSchema = createInsertSchema(userAddresses);
export const selectUserAddressSchema = createSelectSchema(userAddresses);
export const insertP2PPeerSchema = createInsertSchema(p2pPeers);
export const selectP2PPeerSchema = createSelectSchema(p2pPeers);
export const insertMiningSessionSchema = createInsertSchema(miningSessions);
export const selectMiningSessionSchema = createSelectSchema(miningSessions);

// Type exports for database tables
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = typeof userAddresses.$inferInsert;
export type P2PPeer = typeof p2pPeers.$inferSelect;
export type InsertP2PPeer = typeof p2pPeers.$inferInsert;
export type MiningSession = typeof miningSessions.$inferSelect;
export type InsertMiningSession = typeof miningSessions.$inferInsert;
export type MiningReward = typeof miningRewards.$inferSelect;
export type InsertMiningReward = typeof miningRewards.$inferInsert;
// ZK-SNARKs Chat Messages on Blockchain
export const zkChatMessages = pgTable('zk_chat_messages', {
  id: serial('id').primaryKey(),
  messageHash: varchar('message_hash', { length: 64 }).notNull().unique(),
  senderAddress: varchar('sender_address', { length: 42 }).notNull(),
  encryptedContent: text('encrypted_content').notNull(),
  zkProof: text('zk_proof').notNull(),
  nullifierHash: varchar('nullifier_hash', { length: 64 }).notNull(),
  commitment: varchar('commitment', { length: 64 }).notNull(),
  blockHeight: integer('block_height').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  roomId: varchar('room_id', { length: 32 }).notNull().default('global'),
  isVerified: boolean('is_verified').notNull().default(false)
});

// Chat room metadata
export const zkChatRooms = pgTable('zk_chat_rooms', {
  id: serial('id').primaryKey(),
  roomId: varchar('room_id', { length: 32 }).notNull().unique(),
  roomName: varchar('room_name', { length: 100 }).notNull(),
  description: text('description'),
  createdBy: varchar('created_by', { length: 42 }).notNull(),
  participantCount: integer('participant_count').notNull().default(1),
  isPrivate: boolean('is_private').notNull().default(false),
  zkCircuit: text('zk_circuit'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// TABLA PARA DIRECCIONES PERSISTENTES POR USUARIO
export const persistentUserAddresses = pgTable("persistent_user_addresses", {
  id: serial("id").primaryKey(),
  sessionFingerprint: varchar("session_fingerprint", { length: 64 }).notNull().unique(), // Hash of IP + User-Agent
  primaryAddress: varchar("primary_address", { length: 42 }).notNull().unique(),
  btcAddress: varchar("btc_address", { length: 62 }).notNull().unique(),
  ethAddress: varchar("eth_address", { length: 42 }).notNull().unique(),
  usdtAddress: varchar("usdt_address", { length: 42 }).notNull().unique(),
  usdcAddress: varchar("usdc_address", { length: 42 }).notNull().unique(),
  privateKey: varchar("private_key", { length: 128 }).notNull(),
  publicKey: varchar("public_key", { length: 128 }).notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessAt: timestamp("last_access_at").defaultNow().notNull(),
});

export type DBWallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type MiningReward = typeof miningRewards.$inferSelect;
export type InsertMiningReward = typeof miningRewards.$inferInsert;
export type DBMultiWallet = typeof multiWalletAddresses.$inferSelect;
export type InsertMultiWallet = typeof multiWalletAddresses.$inferInsert;
export type DBZkChatMessage = typeof zkChatMessages.$inferSelect;
export type InsertZkChatMessage = typeof zkChatMessages.$inferInsert;
export type DBZkChatRoom = typeof zkChatRooms.$inferSelect;
export type InsertZkChatRoom = typeof zkChatRooms.$inferInsert;

// Blockchain and wallet related schemas
export const walletSchema = z.object({
  address: z.string(),
  balance: z.number(),
  privateBalance: z.number(),
  nonce: z.number(),
});

export const transactionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  amount: z.number(),
  timestamp: z.number(),
  type: z.enum(["sent", "received", "mining", "shield", "unshield", "shielded"]),
  status: z.enum(["pending", "confirmed", "failed"]),
  hash: z.string().optional(),
  blockHeight: z.number().optional(),
});

export const blockSchema = z.object({
  index: z.number(),
  hash: z.string(),
  previousHash: z.string(),
  timestamp: z.number(),
  nonce: z.number(),
  transactions: z.array(transactionSchema),
  miner: z.string().optional(),
});

export const peerSchema = z.object({
  id: z.string(),
  address: z.string(),
  port: z.number(),
  status: z.enum(["connected", "disconnected", "syncing"]),
  lastSeen: z.number(),
  blockHeight: z.number(),
});

export const miningStatsSchema = z.object({
  isActive: z.boolean(),
  hashRate: z.number(),
  blocksFound: z.number(),
  totalEarned: z.number(),
  difficulty: z.string(),
  threads: z.number(),
  uptime: z.number(),
});

export const networkStatsSchema = z.object({
  connectedPeers: z.number(),
  totalNodes: z.number(),
  currentHeight: z.number(),
  txPoolSize: z.number(),
  avgBlockTime: z.number(),
  synced: z.boolean(),
});

export const aiStatsSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number(),
  lastScore: z.number(),
  status: z.enum(["normal", "warning", "anomaly"]),
});

export const coinJoinPoolSchema = z.object({
  id: z.string(),
  participants: z.number(),
  maxParticipants: z.number(),
  amount: z.number(),
  status: z.enum(["waiting", "active", "completed", "cancelled"]),
  createdAt: z.number(),
});

// AMM (Automated Market Maker) schemas
export const ammPoolSchema = z.object({
  pool_id: z.string(),
  token_a: z.string(),
  token_b: z.string(),
  reserve_a: z.string(),
  reserve_b: z.string(),
  total_supply: z.string(),
  current_price: z.string(),
  fee_rate: z.string(),
  tvl: z.string(),
});

export const swapRequestSchema = z.object({
  pool_id: z.string(),
  amount_in: z.number().positive(),
  token_in: z.string(),
});

export const addLiquiditySchema = z.object({
  pool_id: z.string(),
  amount_a: z.number().min(0).default(0),
  amount_b: z.number().min(0).default(0),
}).refine(data => data.amount_a > 0 || data.amount_b > 0, {
  message: "At least one amount must be greater than 0",
});

export const removeLiquiditySchema = z.object({
  pool_id: z.string(),
  lp_tokens: z.number().positive(),
});

export type AMMPool = z.infer<typeof ammPoolSchema>;
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export type AddLiquidityRequest = z.infer<typeof addLiquiditySchema>;
export type RemoveLiquidityRequest = z.infer<typeof removeLiquiditySchema>;

// Add AMM types to existing exports
export type CoinJoinInput = z.infer<typeof coinJoinSchema>;
export type SignMessageInput = z.infer<typeof signMessageSchema>;
export type VerifySignatureInput = z.infer<typeof verifySignatureSchema>;

// Form schemas for user inputs
export const sendTransactionSchema = z.object({
  to: z.string().min(1, "Recipient address is required"),
  amount: z.number().min(0.00000001, "Amount must be greater than 0"),
  message: z.string().optional(),
  feeLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

export const shieldFundsSchema = z.object({
  amount: z.number().min(0.00000001, "Amount must be greater than 0"),
});

export const unshieldFundsSchema = z.object({
  amount: z.number().min(0.00000001, "Amount must be greater than 0"),
  toAddress: z.string().min(1, "Destination address is required"),
});

export const coinJoinSchema = z.object({
  amount: z.number().min(0.00000001, "Amount must be greater than 0"),
  privacyLevel: z.number().min(2).max(10).default(5),
  outputAddress: z.string().min(1, "Output address is required"),
});

export const signMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
});

export const verifySignatureSchema = z.object({
  message: z.string().min(1, "Message is required"),
  signature: z.string().min(1, "Signature is required"),
});

// ZK-SNARKs Chat schemas
export const zkChatMessageSchema = z.object({
  content: z.string().min(1, "Message content is required").max(500, "Message too long"),
  roomId: z.string().min(1, "Room ID is required").default("global"),
  isPrivate: z.boolean().default(false),
});

export const zkChatRoomSchema = z.object({
  roomName: z.string().min(1, "Room name is required").max(100, "Room name too long"),
  description: z.string().max(250, "Description too long").optional(),
  isPrivate: z.boolean().default(false),
});

// Type exports
export type Wallet = z.infer<typeof walletSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Peer = z.infer<typeof peerSchema>;
export type MiningStats = z.infer<typeof miningStatsSchema>;
export type NetworkStats = z.infer<typeof networkStatsSchema>;
export type AIStats = z.infer<typeof aiStatsSchema>;
export type CoinJoinPool = z.infer<typeof coinJoinPoolSchema>;
export type SendTransactionInput = z.infer<typeof sendTransactionSchema>;
export type ShieldFundsInput = z.infer<typeof shieldFundsSchema>;
export type UnshieldFundsInput = z.infer<typeof unshieldFundsSchema>;
export type CoinJoinInput = z.infer<typeof coinJoinSchema>;
export type SignMessageInput = z.infer<typeof signMessageSchema>;
export type VerifySignatureInput = z.infer<typeof verifySignatureSchema>;
export type ZkChatMessageInput = z.infer<typeof zkChatMessageSchema>;
export type ZkChatRoomInput = z.infer<typeof zkChatRoomSchema>;
