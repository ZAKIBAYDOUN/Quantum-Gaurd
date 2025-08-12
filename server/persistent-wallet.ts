import { db } from "./db";
import { wallets, miningRewards, type DBWallet, type InsertWallet, type InsertMiningReward } from "@shared/schema";
import { eq, sum, sql } from "drizzle-orm";
import crypto from "crypto";

class PersistentWallet {
  private walletAddress: string;
  private sessionId = `session_${Date.now()}`;

  constructor(userSessionId?: string) {
    // Generate unique wallet address per user session
    if (userSessionId) {
      this.walletAddress = this.generateWalletAddress(userSessionId);
    } else {
      this.walletAddress = this.generateWalletAddress(this.sessionId);
    }
  }

  // Generate unique wallet address based on session
  private generateWalletAddress(sessionData: string): string {
    // Generate unique address for each session, but keep owner's address for persistent session
    if (sessionData.includes('wallet_persistent_fc1c65b62d480f388f0bc3bd34f3c3647aa59c18')) {
      console.log(`🏦 Loading owner's wallet with blockchain data`);
      return '0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18';
    }
    
    // Generate unique address for new users
    const hash = crypto.createHash('sha256').update(sessionData + Date.now()).digest('hex');
    const address = '0x' + hash.substring(0, 40);
    console.log(`👤 Generated unique wallet: ${address.substring(0, 12)}...`);
    return address;
  }

  // Initialize wallet in database
  async initializeWallet(): Promise<DBWallet> {
    try {
      // Check if wallet exists
      let wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.address, this.walletAddress))
        .limit(1);

      if (wallet.length === 0) {
        // Set initial balance based on wallet type
        let initialBalance = "0.0"; // New users start with 0
        
        // Owner's wallet keeps all blockchain data (updated balance from balance_snapshots.json)
        if (this.walletAddress === '0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18') {
          console.log(`🏦 Restoring owner's wallet with authentic blockchain balance`);
          initialBalance = "157156.0"; // Current authentic balance from balance_snapshots.json
        } else {
          console.log(`👤 Creating new user wallet: ${this.walletAddress.substring(0, 12)}...`);
          // New users get a small starting balance for testing
          initialBalance = "100.0";
        }
        
        const newWallet = await db
          .insert(wallets)
          .values({
            address: this.walletAddress,
            balance: initialBalance,
            privateBalance: "0",
            totalMined: initialBalance === "157156.0" ? "157150.0" : initialBalance,
            totalBlocks: initialBalance === "157156.0" ? 6289 : 0, // Authentic blocks for current balance
            isActive: true
          })
          .returning();
        
        console.log(`💰 Created persistent wallet: ${this.walletAddress} with ${initialBalance} tokens`);
        return newWallet[0];
      }

      console.log(`💰 Loaded existing persistent wallet with ${wallet[0].balance} tokens`);
      return wallet[0];
    } catch (error) {
      console.error("Failed to initialize wallet:", error);
      throw error;
    }
  }

  // Record mining reward and update balance
  async recordMiningReward(blockHeight: number, reward: number): Promise<void> {
    try {
      // Record the mining reward
      await db.insert(miningRewards).values({
        walletAddress: this.walletAddress,
        blockHeight,
        reward: reward.toString(),
        sessionId: this.sessionId
      });

      // Update wallet balance and stats
      const currentWallet = await this.getWalletBalance();
      const newBalance = parseFloat(currentWallet.balance) + reward;
      const newTotalMined = parseFloat(currentWallet.totalMined || "0") + reward;
      const newTotalBlocks = currentWallet.totalBlocks + 1;

      await db
        .update(wallets)
        .set({
          balance: newBalance.toString(),
          totalMined: newTotalMined.toString(),
          totalBlocks: newTotalBlocks,
          lastMiningSession: new Date(),
          updatedAt: new Date()
        })
        .where(eq(wallets.address, this.walletAddress));

      console.log(`⛏️ Recorded mining reward: ${reward} tokens at block ${blockHeight}`);
      console.log(`💰 New balance: ${newBalance} tokens (Total mined: ${newTotalMined})`);
    } catch (error) {
      console.error("Failed to record mining reward:", error);
      throw error;
    }
  }

  // Get current wallet balance
  async getWalletBalance(): Promise<DBWallet> {
    try {
      const wallet = await db
        .select()
        .from(wallets)
        .where(eq(wallets.address, this.walletAddress))
        .limit(1);

      if (wallet.length === 0) {
        return await this.initializeWallet();
      }

      return wallet[0];
    } catch (error) {
      console.error("Failed to get wallet balance:", error);
      throw error;
    }
  }

  // Get mining history for this session
  async getMiningHistory(limit = 10) {
    try {
      return await db
        .select()
        .from(miningRewards)
        .where(eq(miningRewards.walletAddress, this.walletAddress))
        .orderBy(sql`${miningRewards.minedAt} DESC`)
        .limit(limit);
    } catch (error) {
      console.error("Failed to get mining history:", error);
      return [];
    }
  }

  // Synchronize current mining session with database
  async syncMiningSession(currentBlocks: number, currentBalance: number): Promise<number> {
    try {
      const wallet = await this.getWalletBalance();
      const dbBalance = parseFloat(wallet.balance);
      
      // If current balance is much higher than DB, sync the difference
      if (currentBalance > dbBalance) {
        const newRewards = currentBalance - dbBalance;
        const blocksDifference = currentBlocks - wallet.totalBlocks;
        
        if (blocksDifference > 0) {
          // Record bulk mining rewards for the difference
          for (let i = 0; i < blocksDifference; i++) {
            const blockHeight = wallet.totalBlocks + i + 1;
            const rewardPerBlock = newRewards / blocksDifference;
            await this.recordMiningReward(blockHeight, rewardPerBlock);
          }
        }
      }

      // Return the current database balance
      const updatedWallet = await this.getWalletBalance();
      return parseFloat(updatedWallet.balance);
    } catch (error) {
      console.error("Failed to sync mining session:", error);
      return currentBalance; // Fallback to current balance
    }
  }

  // Update balance (for transactions)
  async updateBalance(newBalance: number): Promise<void> {
    try {
      await db
        .update(wallets)
        .set({
          balance: newBalance.toString(),
          updatedAt: new Date()
        })
        .where(eq(wallets.address, this.walletAddress));
    } catch (error) {
      console.error("Failed to update balance:", error);
      throw error;
    }
  }

  // Update wallet balance and mining stats
  async updateWalletBalance(newBalance: string, newTotalMined: string, totalBlocks: number): Promise<void> {
    try {
      await db
        .update(wallets)
        .set({
          balance: newBalance,
          totalMined: newTotalMined,
          totalBlocks: totalBlocks,
          lastMiningSession: new Date(),
          updatedAt: new Date()
        })
        .where(eq(wallets.address, this.walletAddress));
    } catch (error) {
      console.error("Failed to update wallet balance:", error);
      throw error;
    }
  }
  // Get current wallet address
  getAddress(): string {
    return this.walletAddress;
  }
}

// Create wallet factory instead of singleton
export function createPersistentWallet(userSessionId?: string): PersistentWallet {
  return new PersistentWallet(userSessionId);
}

// Temporary singleton for backward compatibility (will be removed)
export const persistentWallet = new PersistentWallet();