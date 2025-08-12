import fs from 'fs';
import path from 'path';
import { db } from './db';
import { wallets } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface BalanceSnapshot {
  address: string;
  balance: number;
  totalMined: number;
  totalBlocks: number;
  timestamp: number;
}

export class BalanceProtectionManager {
  private snapshotFile = path.join(process.cwd(), 'balance_snapshots.json');
  private protectedAddress = '0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18';

  async createSnapshot(): Promise<void> {
    try {
      // Get current wallet data from database
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.address, this.protectedAddress))
        .limit(1);

      if (!wallet) {
        console.log('⚠️ No wallet found to create snapshot');
        return;
      }

      const snapshot: BalanceSnapshot = {
        address: wallet.address,
        balance: parseFloat(wallet.balance),
        totalMined: parseFloat(wallet.totalMined),
        totalBlocks: wallet.totalBlocks,
        timestamp: Date.now()
      };

      // Save to file
      fs.writeFileSync(this.snapshotFile, JSON.stringify(snapshot, null, 2));
      console.log(`🛡️ Balance snapshot created: ${snapshot.balance} tokens`);
    } catch (error) {
      console.error('❌ Error creating balance snapshot:', error);
    }
  }

  async restoreFromSnapshot(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.snapshotFile)) {
        console.log('📝 No snapshot file found, skipping restore');
        return false;
      }

      const snapshotData = fs.readFileSync(this.snapshotFile, 'utf8');
      const snapshot: BalanceSnapshot = JSON.parse(snapshotData);

      // Check if current balance is lower than snapshot
      const [currentWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.address, this.protectedAddress))
        .limit(1);

      if (currentWallet && parseFloat(currentWallet.balance) < snapshot.balance) {
        // Restore balance from snapshot
        await db
          .update(wallets)
          .set({
            balance: snapshot.balance.toString(),
            totalMined: snapshot.totalMined.toString(),
            totalBlocks: snapshot.totalBlocks,
            updatedAt: new Date()
          })
          .where(eq(wallets.address, this.protectedAddress));

        console.log(`🛡️ Balance restored from snapshot: ${snapshot.balance} tokens`);
        return true;
      }

      console.log('✅ Current balance is safe, no restore needed');
      return false;
    } catch (error) {
      console.error('❌ Error restoring from snapshot:', error);
      return false;
    }
  }

  async protectBalance(): Promise<void> {
    // Create snapshot before any operation
    await this.createSnapshot();
    
    // Set up periodic balance protection
    setInterval(async () => {
      await this.restoreFromSnapshot();
      await this.createSnapshot();
    }, 30000); // Every 30 seconds
  }
}

export const balanceProtection = new BalanceProtectionManager();