/**
 * 🛡️ QUANTUM-GUARD™ API ROUTES
 * Risk assessment and ML fallback endpoints
 */

import express from 'express';
import { quantumGuard } from './quantum-guard';
import { smartContractIntegration } from './smart-contract-integration';

const router = express.Router();

// Risk assessment for transactions
router.post('/quantum-guard/assess', async (req, res) => {
  try {
    const {
      amount = 0,
      gas_price = 21000,
      recipient_known = false,
      time_since_last = 3600,
      amount_ratio = 0.1,
      contract_interaction = false,
      unusual_pattern = false
    } = req.body;

    const assessment = await quantumGuard.assessTransaction({
      amount: parseFloat(amount) || 0,
      gas_price: parseFloat(gas_price) || 21000,
      recipient_known: Boolean(recipient_known),
      time_since_last: parseInt(time_since_last) || 3600,
      amount_ratio: parseFloat(amount_ratio) || 0.1,
      contract_interaction: Boolean(contract_interaction),
      unusual_pattern: Boolean(unusual_pattern)
    });

    res.json({
      success: true,
      assessment,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('🛡️ Quantum-Guard assessment failed:', error);
    res.status(500).json({
      success: false,
      error: 'Risk assessment unavailable',
      fallback: true
    });
  }
});

// Health metrics for Quantum-Guard system
router.get('/quantum-guard/health', async (req, res) => {
  try {
    const metrics = quantumGuard.getHealthMetrics();
    
    res.json({
      status: 'operational',
      ...metrics,
      uptime: process.uptime(),
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('🛡️ Quantum-Guard health check failed:', error);
    res.status(500).json({
      status: 'degraded',
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Quick risk scoring for UI
router.get('/quantum-guard/quick-score/:amount/:recipient', async (req, res) => {
  try {
    const { amount, recipient } = req.params;
    
    const assessment = await quantumGuard.assessTransaction({
      amount: parseFloat(amount) || 0,
      gas_price: 21000,
      recipient_known: recipient.length === 42 && recipient.startsWith('0x'),
      time_since_last: 3600,
      amount_ratio: 0.1,
      contract_interaction: false,
      unusual_pattern: false
    });

    res.json({
      score: assessment.score,
      risk_level: assessment.risk_level,
      model: assessment.model,
      timestamp: assessment.timestamp
    });

  } catch (error) {
    console.error('🛡️ Quick score failed:', error);
    res.status(500).json({
      score: 0.5,
      risk_level: 'MEDIUM',
      model: 'FALLBACK',
      error: true
    });
  }
});

// Smart contract integration endpoints
router.get('/smart-contracts/status', async (req, res) => {
  try {
    await smartContractIntegration.initializeProvider();
    const status = await smartContractIntegration.getContractStatus();
    
    res.json({
      success: true,
      ...status,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('🏗️ Smart contract status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Smart contract status unavailable',
      timestamp: Date.now()
    });
  }
});

router.post('/smart-contracts/risk-score', async (req, res) => {
  try {
    const { txHash, sender, score, threshold } = req.body;
    
    const result = await smartContractIntegration.submitRiskScore(
      txHash || `0x${Math.random().toString(16).substring(2, 66)}`,
      sender || '0x0',
      parseFloat(score) || 0.9,
      parseFloat(threshold) || 0.75
    );
    
    res.json(result);

  } catch (error) {
    console.error('🏗️ Risk score submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Risk score submission failed'
    });
  }
});

router.post('/smart-contracts/commit-reveal', async (req, res) => {
  try {
    const { params, value } = req.body;
    
    const result = await smartContractIntegration.createCommitRevealOrder(
      params || { type: 'swap', from: 'ETH', to: 'USDC' },
      parseFloat(value) || 1.0
    );
    
    res.json(result);

  } catch (error) {
    console.error('🏗️ Commit-reveal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Commit-reveal order failed'
    });
  }
});

router.post('/smart-contracts/zk-proof', async (req, res) => {
  try {
    const { data, proofType } = req.body;
    
    const result = await smartContractIntegration.generateZKProof(
      data || { amount: 1000, recipient: '0x0' },
      proofType || 'TRANSFER_PRIVACY'
    );
    
    res.json(result);

  } catch (error) {
    console.error('🏗️ ZK proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'ZK proof generation failed'
    });
  }
});

router.post('/smart-contracts/mpc-execute', async (req, res) => {
  try {
    const { calls, requireRiskCheck } = req.body;
    
    const result = await smartContractIntegration.executeMPCTransaction(
      calls || [{ to: '0x0', value: 0, data: '0x' }],
      requireRiskCheck !== false
    );
    
    res.json(result);

  } catch (error) {
    console.error('🏗️ MPC execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'MPC transaction failed'
    });
  }
});

export default router;