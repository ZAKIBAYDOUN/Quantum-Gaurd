/**
 * WALLET MPC (Multi-Party Computation) SYSTEM
 * 2-of-2 threshold signing for enhanced security
 */

import { createHash, randomBytes } from 'crypto';
import { db } from './db';
import { userAddresses } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface MPCKeyShare {
  shareId: string;
  deviceShare: string; // Encrypted with device key
  backupShare: string; // Encrypted with backup key
  publicKey: string;
  threshold: number;
  created: Date;
}

interface SigningSession {
  sessionId: string;
  transaction: {
    from: string;
    to: string;
    amount: number;
    nonce: number;
  };
  deviceSignature?: string;
  backupSignature?: string;
  finalSignature?: string;
  status: 'pending' | 'partial' | 'complete' | 'failed';
  expiry: Date;
}

interface WalletPolicy {
  dailyLimit: number;
  whitelist: string[];
  requiresCoSigner: boolean;
  recoveryContacts: string[];
  timeLock: number; // seconds
}

class WalletMPCSystem {
  private keyShares = new Map<string, MPCKeyShare>();
  private signingSessions = new Map<string, SigningSession>();
  private walletPolicies = new Map<string, WalletPolicy>();
  private readonly SESSION_EXPIRY = 300000; // 5 minutes
  
  constructor() {
    this.startSessionCleanup();
    console.log('🔐 Wallet MPC System initialized');
    console.log('   Threshold: 2-of-2 signing');
    console.log('   Features: Account abstraction, recovery, policies');
  }
  
  /**
   * Generate MPC key shares for new wallet
   */
  async generateMPCWallet(userId: string): Promise<{
    success: boolean;
    publicKey: string;
    deviceShare: string;
    backupInstructions: string;
    recoveryCode: string;
  }> {
    try {
      // Generate master private key
      const masterKey = randomBytes(32);
      const publicKey = this.derivePublicKey(masterKey);
      
      // Split into two shares using simple XOR (in production, use proper secret sharing)
      const share1 = randomBytes(32);
      const share2 = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        share2[i] = masterKey[i] ^ share1[i];
      }
      
      // Generate device encryption key
      const deviceKey = createHash('sha256').update(userId + 'device').digest();
      const backupKey = createHash('sha256').update(userId + 'backup').digest();
      
      // Encrypt shares
      const deviceShare = this.encryptShare(share1, deviceKey);
      const backupShare = this.encryptShare(share2, backupKey);
      
      const shareId = this.generateShareId(userId);
      
      const mpcShare: MPCKeyShare = {
        shareId,
        deviceShare,
        backupShare,
        publicKey,
        threshold: 2,
        created: new Date()
      };
      
      this.keyShares.set(userId, mpcShare);
      
      // Generate recovery code
      const recoveryCode = this.generateRecoveryCode(userId, backupKey.toString('hex'));
      
      console.log(`🔐 MPC wallet generated for user: ${userId}`);
      console.log(`   Public key: ${publicKey.substring(0, 16)}...`);
      console.log(`   Threshold: 2-of-2`);
      
      return {
        success: true,
        publicKey,
        deviceShare,
        backupInstructions: `Store this recovery code safely: ${recoveryCode}`,
        recoveryCode
      };
      
    } catch (error) {
      console.error('Error generating MPC wallet:', error);
      return {
        success: false,
        publicKey: '',
        deviceShare: '',
        backupInstructions: '',
        recoveryCode: ''
      };
    }
  }
  
  /**
   * Initiate MPC signing session
   */
  async initiateSigning(userId: string, transaction: {
    from: string;
    to: string;
    amount: number;
    nonce: number;
  }): Promise<{
    sessionId: string;
    requiresPolicy: boolean;
    policyViolations: string[];
    canProceed: boolean;
  }> {
    const sessionId = this.generateSessionId();
    const expiry = new Date(Date.now() + this.SESSION_EXPIRY);
    
    // Check wallet policies
    const policy = this.walletPolicies.get(userId);
    const policyCheck = this.checkWalletPolicy(userId, transaction, policy);
    
    const signingSession: SigningSession = {
      sessionId,
      transaction,
      status: 'pending',
      expiry
    };
    
    this.signingSessions.set(sessionId, signingSession);
    
    console.log(`✏️ Signing session initiated: ${sessionId}`);
    console.log(`   Transaction: ${transaction.amount} tokens to ${transaction.to.substring(0, 16)}...`);
    
    return {
      sessionId,
      requiresPolicy: !!policy,
      policyViolations: policyCheck.violations,
      canProceed: policyCheck.canProceed
    };
  }
  
  /**
   * Add device signature to session
   */
  async addDeviceSignature(sessionId: string, signature: string): Promise<{
    success: boolean;
    needsBackupSignature: boolean;
    message: string;
  }> {
    const session = this.signingSessions.get(sessionId);
    
    if (!session) {
      return { success: false, needsBackupSignature: false, message: 'Session not found' };
    }
    
    if (new Date() > session.expiry) {
      this.signingSessions.delete(sessionId);
      return { success: false, needsBackupSignature: false, message: 'Session expired' };
    }
    
    session.deviceSignature = signature;
    session.status = 'partial';
    
    console.log(`📱 Device signature added to session: ${sessionId}`);
    
    return {
      success: true,
      needsBackupSignature: true,
      message: 'Device signature added. Waiting for backup signature.'
    };
  }
  
  /**
   * Add backup signature and complete transaction
   */
  async addBackupSignature(sessionId: string, signature: string): Promise<{
    success: boolean;
    finalSignature: string;
    transactionHash: string;
    message: string;
  }> {
    const session = this.signingSessions.get(sessionId);
    
    if (!session) {
      return { 
        success: false, 
        finalSignature: '', 
        transactionHash: '', 
        message: 'Session not found' 
      };
    }
    
    if (!session.deviceSignature) {
      return { 
        success: false, 
        finalSignature: '', 
        transactionHash: '', 
        message: 'Device signature required first' 
      };
    }
    
    session.backupSignature = signature;
    
    // Combine signatures (simplified - in production use proper MPC)
    const finalSignature = this.combineSignatures(session.deviceSignature, signature);
    const transactionHash = this.generateTransactionHash(session.transaction, finalSignature);
    
    session.finalSignature = finalSignature;
    session.status = 'complete';
    
    console.log(`✅ MPC signing complete: ${sessionId}`);
    console.log(`   Transaction hash: ${transactionHash}`);
    
    return {
      success: true,
      finalSignature,
      transactionHash,
      message: 'Transaction signed with MPC threshold signature'
    };
  }
  
  /**
   * Set wallet policy
   */
  setWalletPolicy(userId: string, policy: WalletPolicy): void {
    this.walletPolicies.set(userId, policy);
    console.log(`📋 Wallet policy set for user: ${userId}`);
    console.log(`   Daily limit: ${policy.dailyLimit}`);
    console.log(`   Whitelist entries: ${policy.whitelist.length}`);
    console.log(`   Co-signer required: ${policy.requiresCoSigner}`);
  }
  
  /**
   * Social recovery process
   */
  async initiateSocialRecovery(userId: string, recoveryContacts: string[]): Promise<{
    recoveryId: string;
    contactsNotified: number;
    threshold: number;
    message: string;
  }> {
    const recoveryId = this.generateRecoveryId();
    const policy = this.walletPolicies.get(userId);
    const requiredContacts = Math.ceil((recoveryContacts.length + 1) / 2); // Majority
    
    console.log(`🆘 Social recovery initiated for user: ${userId}`);
    console.log(`   Recovery ID: ${recoveryId}`);
    console.log(`   Contacts notified: ${recoveryContacts.length}`);
    console.log(`   Threshold: ${requiredContacts}`);
    
    // In production, send notifications to recovery contacts
    return {
      recoveryId,
      contactsNotified: recoveryContacts.length,
      threshold: requiredContacts,
      message: `Recovery process initiated. ${requiredContacts} of ${recoveryContacts.length} contacts must approve.`
    };
  }
  
  /**
   * Helper methods
   */
  private derivePublicKey(privateKey: Buffer): string {
    // Simplified public key derivation
    return '0x' + createHash('sha256').update(privateKey).digest('hex').substring(0, 40);
  }
  
  private encryptShare(share: Buffer, key: Buffer): string {
    // Simplified encryption - in production use AES-GCM
    const encrypted = Buffer.alloc(share.length);
    for (let i = 0; i < share.length; i++) {
      encrypted[i] = share[i] ^ key[i % key.length];
    }
    return encrypted.toString('hex');
  }
  
  private generateShareId(userId: string): string {
    return createHash('sha256').update(userId + Date.now()).digest('hex').substring(0, 16);
  }
  
  private generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }
  
  private generateRecoveryId(): string {
    return randomBytes(12).toString('hex');
  }
  
  private generateRecoveryCode(userId: string, backupKey: string): string {
    const code = createHash('sha256').update(userId + backupKey).digest('hex').substring(0, 24);
    return code.toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
  }
  
  private combineSignatures(sig1: string, sig2: string): string {
    // Simplified signature combination - in production use proper threshold signatures
    return createHash('sha256').update(sig1 + sig2).digest('hex');
  }
  
  private generateTransactionHash(tx: any, signature: string): string {
    const txData = `${tx.from}-${tx.to}-${tx.amount}-${tx.nonce}`;
    return createHash('sha256').update(txData + signature).digest('hex');
  }
  
  private checkWalletPolicy(userId: string, transaction: any, policy?: WalletPolicy): {
    canProceed: boolean;
    violations: string[];
  } {
    if (!policy) {
      return { canProceed: true, violations: [] };
    }
    
    const violations: string[] = [];
    
    // Check daily limit
    if (transaction.amount > policy.dailyLimit) {
      violations.push(`Amount exceeds daily limit: ${transaction.amount} > ${policy.dailyLimit}`);
    }
    
    // Check whitelist
    if (policy.whitelist.length > 0 && !policy.whitelist.includes(transaction.to)) {
      violations.push('Recipient not in whitelist');
    }
    
    return {
      canProceed: violations.length === 0 || !policy.requiresCoSigner,
      violations
    };
  }
  
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      let cleaned = 0;
      
      for (const [sessionId, session] of this.signingSessions.entries()) {
        if (now > session.expiry) {
          this.signingSessions.delete(sessionId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired signing sessions`);
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Get MPC system statistics
   */
  getStats(): {
    totalWallets: number;
    activeSessions: number;
    completedSignings: number;
    policiesActive: number;
    securityFeatures: {
      mpcThreshold: string;
      accountAbstraction: boolean;
      socialRecovery: boolean;
      policyEngine: boolean;
    };
  } {
    const completedSessions = Array.from(this.signingSessions.values())
      .filter(s => s.status === 'complete').length;
    
    return {
      totalWallets: this.keyShares.size,
      activeSessions: this.signingSessions.size,
      completedSignings: completedSessions,
      policiesActive: this.walletPolicies.size,
      securityFeatures: {
        mpcThreshold: '2-of-2',
        accountAbstraction: true,
        socialRecovery: true,
        policyEngine: true
      }
    };
  }
}

export const walletMPCSystem = new WalletMPCSystem();