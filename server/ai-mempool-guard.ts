/**
 * AI MEMPOOL GUARD - QNN Pre-Consensus Risk Scoring
 * Prevents MEV, detects sybil attacks, and prioritizes transactions
 */

import { qnnValidator } from './qnn-validator';

interface GuardConfig {
  enabled: boolean;
  threshold: number; // 0.0 - 1.0
  action: 'advisory' | 'throttle' | 'require-zk';
  rateLimit: {
    maxTxPerSecond: number;
    burstWindow: number;
  };
}

interface RiskScore {
  overall: number;
  sybil: number;
  mev: number;
  dos: number;
  anomaly: number;
  reasons: string[];
}

interface TransactionWithRisk {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  riskScore?: RiskScore;
  requiresZK?: boolean;
  priority: 'high' | 'normal' | 'low' | 'quarantine';
}

class AIMempoolGuard {
  private config: GuardConfig;
  private txHistory = new Map<string, TransactionWithRisk[]>();
  private ipRateLimit = new Map<string, number[]>();
  private suspiciousPatterns = new Set<string>();
  
  constructor(config: Partial<GuardConfig> = {}) {
    this.config = {
      enabled: true,
      threshold: 0.85,
      action: 'throttle',
      rateLimit: {
        maxTxPerSecond: 10,
        burstWindow: 1000
      },
      ...config
    };
    
    console.log('🛡️ AI Mempool Guard initialized');
    console.log(`   Threshold: ${this.config.threshold}`);
    console.log(`   Action: ${this.config.action}`);
  }
  
  /**
   * Pre-consensus transaction scoring
   */
  async scoreTransaction(tx: TransactionWithRisk, sourceIP: string): Promise<RiskScore> {
    const riskScore: RiskScore = {
      overall: 0,
      sybil: 0,
      mev: 0,
      dos: 0,
      anomaly: 0,
      reasons: []
    };
    
    // Rate limiting check
    const rateLimitRisk = this.checkRateLimit(sourceIP);
    if (rateLimitRisk > 0) {
      riskScore.dos = rateLimitRisk;
      riskScore.reasons.push('High transaction frequency detected');
    }
    
    // Sybil attack detection
    const sybilRisk = this.detectSybilBehavior(tx);
    if (sybilRisk > 0) {
      riskScore.sybil = sybilRisk;
      riskScore.reasons.push('Sybil attack pattern detected');
    }
    
    // MEV detection (sandwich attacks, front-running)
    const mevRisk = await this.detectMEVPatterns(tx);
    if (mevRisk > 0) {
      riskScore.mev = mevRisk;
      riskScore.reasons.push('Potential MEV exploitation detected');
    }
    
    // QNN anomaly detection
    if (qnnValidator && qnnValidator.isQNNRunning()) {
      try {
        const qnnResult = await qnnValidator.validateTransaction({
          from: tx.from,
          to: tx.to,
          amount: tx.amount,
          timestamp: tx.timestamp
        });
        
        if (qnnResult && qnnResult.quantumConfidence !== undefined) {
          riskScore.anomaly = 1.0 - qnnResult.quantumConfidence;
          if (qnnResult.riskLevel === 'CRITICAL') {
            riskScore.reasons.push('QNN detected critical anomaly');
          }
        }
      } catch (error) {
        console.warn('QNN validation failed:', error);
      }
    }
    
    // Calculate overall risk
    riskScore.overall = Math.max(
      riskScore.sybil * 0.3,
      riskScore.mev * 0.4,
      riskScore.dos * 0.2,
      riskScore.anomaly * 0.1
    );
    
    return riskScore;
  }
  
  /**
   * Check IP-based rate limiting
   */
  private checkRateLimit(ip: string): number {
    const now = Date.now();
    const window = this.config.rateLimit.burstWindow;
    
    if (!this.ipRateLimit.has(ip)) {
      this.ipRateLimit.set(ip, []);
    }
    
    const timestamps = this.ipRateLimit.get(ip)!;
    
    // Clean old timestamps
    const validTimestamps = timestamps.filter(ts => now - ts < window);
    this.ipRateLimit.set(ip, validTimestamps);
    
    // Add current timestamp
    validTimestamps.push(now);
    
    // Check if over limit
    const txCount = validTimestamps.length;
    const maxAllowed = this.config.rateLimit.maxTxPerSecond * (window / 1000);
    
    return txCount > maxAllowed ? Math.min(txCount / maxAllowed - 1, 1.0) : 0;
  }
  
  /**
   * Detect sybil attack patterns
   */
  private detectSybilBehavior(tx: TransactionWithRisk): number {
    // Check for dust transactions (common sybil tactic)
    if (tx.amount < 0.001) {
      return 0.6;
    }
    
    // Check for rapid-fire transactions from same address
    const fromHistory = this.txHistory.get(tx.from) || [];
    const recentTxs = fromHistory.filter(t => tx.timestamp - t.timestamp < 10000);
    
    if (recentTxs.length > 5) {
      return Math.min(recentTxs.length / 10, 1.0);
    }
    
    return 0;
  }
  
  /**
   * Detect MEV patterns (sandwich attacks, front-running)
   */
  private async detectMEVPatterns(tx: TransactionWithRisk): Promise<number> {
    let riskScore = 0;
    
    // Check for high gas price (potential front-running)
    // Simulated - in real implementation, check actual gas price
    const avgGasPrice = 20; // Simulated average
    const txGasPrice = 30; // Simulated tx gas price
    
    if (txGasPrice > avgGasPrice * 1.5) {
      riskScore += 0.4;
    }
    
    // Check for sandwich attack patterns
    const recentTxs = Array.from(this.txHistory.values()).flat()
      .filter(t => tx.timestamp - t.timestamp < 5000);
    
    // Look for transactions targeting same pair/contract
    const samePairTxs = recentTxs.filter(t => t.to === tx.to);
    if (samePairTxs.length >= 2) {
      riskScore += 0.3;
    }
    
    return Math.min(riskScore, 1.0);
  }
  
  /**
   * Apply guard action based on risk score
   */
  applyGuardAction(tx: TransactionWithRisk, riskScore: RiskScore): {
    allowed: boolean;
    priority: 'high' | 'normal' | 'low' | 'quarantine';
    requiresZK: boolean;
    delay?: number;
    message?: string;
  } {
    if (!this.config.enabled) {
      return { allowed: true, priority: 'normal', requiresZK: false };
    }
    
    if (riskScore.overall < this.config.threshold * 0.3) {
      return { allowed: true, priority: 'high', requiresZK: false };
    }
    
    if (riskScore.overall < this.config.threshold) {
      return { allowed: true, priority: 'normal', requiresZK: false };
    }
    
    // High risk detected
    switch (this.config.action) {
      case 'advisory':
        return {
          allowed: true,
          priority: 'low',
          requiresZK: false,
          message: `High risk detected: ${riskScore.reasons.join(', ')}`
        };
        
      case 'throttle':
        return {
          allowed: true,
          priority: 'low',
          requiresZK: false,
          delay: Math.floor(riskScore.overall * 5000), // Up to 5 second delay
          message: `Transaction throttled due to risk: ${riskScore.reasons.join(', ')}`
        };
        
      case 'require-zk':
        return {
          allowed: true,
          priority: 'normal',
          requiresZK: true,
          message: `ZK proof required due to risk: ${riskScore.reasons.join(', ')}`
        };
        
      default:
        return { allowed: false, priority: 'quarantine', requiresZK: false };
    }
  }
  
  /**
   * Add transaction to history for pattern analysis
   */
  addToHistory(tx: TransactionWithRisk): void {
    if (!this.txHistory.has(tx.from)) {
      this.txHistory.set(tx.from, []);
    }
    
    const history = this.txHistory.get(tx.from)!;
    history.push(tx);
    
    // Keep only recent transactions (last 100 per address)
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }
  
  /**
   * Get guard statistics
   */
  getStats(): {
    totalProcessed: number;
    quarantined: number;
    zkRequired: number;
    averageRisk: number;
    topRiskReasons: { [key: string]: number };
  } {
    const totalTxs = Array.from(this.txHistory.values()).flat();
    const quarantined = totalTxs.filter(tx => tx.priority === 'quarantine').length;
    const zkRequired = totalTxs.filter(tx => tx.requiresZK).length;
    
    const riskSum = totalTxs.reduce((sum, tx) => sum + (tx.riskScore?.overall || 0), 0);
    const averageRisk = totalTxs.length > 0 ? riskSum / totalTxs.length : 0;
    
    const reasonCounts: { [key: string]: number } = {};
    totalTxs.forEach(tx => {
      tx.riskScore?.reasons.forEach(reason => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });
    
    return {
      totalProcessed: totalTxs.length,
      quarantined,
      zkRequired,
      averageRisk,
      topRiskReasons: reasonCounts
    };
  }
}

export const aiMempoolGuard = new AIMempoolGuard({
  enabled: true,
  threshold: 0.75,
  action: 'throttle',
  rateLimit: {
    maxTxPerSecond: 10,
    burstWindow: 1000
  }
});