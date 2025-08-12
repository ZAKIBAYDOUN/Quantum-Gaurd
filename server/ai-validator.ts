import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface TransactionData {
  amount: number;
  sender: string;
  receiver: string;
  timestamp: number;
  fee: number;
  type: string;
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  anomalyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  warnings: string[];
}

export class AITransactionValidator extends EventEmitter {
  private aiProcess: ChildProcess | null = null;
  private isRunning = false;
  private validationQueue: TransactionData[] = [];
  private validationHistory: ValidationResult[] = [];
  
  constructor() {
    super();
    this.initializeValidator();
  }

  async initializeValidator(): Promise<void> {
    try {
      console.log('🤖 Initializing AI Transaction Validator with TensorFlow/Keras...');
      
      // Start the AI validation service
      await this.startAIService();
      
      // Set up automatic validation processing
      this.setupValidationLoop();
      
      console.log('✅ AI Transaction Validator is ready');
      this.emit('ready');
    } catch (error) {
      console.error('❌ Failed to initialize AI validator:', error);
      this.emit('error', error);
    }
  }

  private async startAIService(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Launch Python AI service with TensorFlow
      this.aiProcess = spawn('python3', ['-c', `
import tensorflow as tf
import numpy as np
import json
import sys
import time
from tensorflow import keras
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

print("🤖 Starting AI Transaction Validator...")
print("📊 TensorFlow version:", tf.__version__)

# Create 32-neuron autoencoder for anomaly detection
class TransactionValidator:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = self.build_model()
        self.threshold = 0.1
        
    def build_model(self):
        # 32-neuron autoencoder architecture for transaction validation
        model = keras.Sequential([
            keras.layers.Dense(32, activation='relu', input_shape=(6,)),
            keras.layers.Dense(16, activation='relu'),
            keras.layers.Dense(8, activation='relu'),
            keras.layers.Dense(16, activation='relu'),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(6, activation='linear')
        ])
        
        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        return model
        
    def preprocess_transaction(self, tx):
        # Extract features: amount, timestamp_norm, fee_ratio, sender_hash, receiver_hash, type_encoded
        features = [
            float(tx.get('amount', 0)),
            float(tx.get('timestamp', 0)) / 1000000000,  # Normalize timestamp
            float(tx.get('fee', 0)) / max(float(tx.get('amount', 1)), 1),  # Fee ratio
            hash(tx.get('sender', '')) % 1000 / 1000,  # Sender hash normalized
            hash(tx.get('receiver', '')) % 1000 / 1000,  # Receiver hash normalized
            1.0 if tx.get('type') == 'transfer' else 0.5  # Transaction type
        ]
        return np.array(features).reshape(1, -1)
        
    def validate_transaction(self, tx):
        try:
            # Preprocess transaction
            features = self.preprocess_transaction(tx)
            
            # Predict using autoencoder
            reconstruction = self.model.predict(features, verbose=0)
            
            # Calculate reconstruction error (anomaly score)
            mse = np.mean((features - reconstruction) ** 2)
            anomaly_score = float(mse)
            
            # Determine validation result
            is_valid = anomaly_score < self.threshold
            confidence = max(0.1, 1.0 - (anomaly_score / self.threshold))
            
            # Risk level based on anomaly score
            if anomaly_score > 0.5:
                risk_level = 'CRITICAL'
            elif anomaly_score > 0.3:
                risk_level = 'HIGH'
            elif anomaly_score > 0.1:
                risk_level = 'MEDIUM'
            else:
                risk_level = 'LOW'
                
            # Generate warnings
            warnings = []
            if anomaly_score > self.threshold:
                warnings.append('High anomaly score detected')
            if float(tx.get('amount', 0)) > 10000:
                warnings.append('Large transaction amount')
            if float(tx.get('fee', 0)) / max(float(tx.get('amount', 1)), 1) > 0.1:
                warnings.append('Unusually high fee ratio')
                
            return {
                'isValid': is_valid,
                'confidence': confidence,
                'anomalyScore': anomaly_score,
                'riskLevel': risk_level,
                'warnings': warnings
            }
        except Exception as e:
            return {
                'isValid': False,
                'confidence': 0.0,
                'anomalyScore': 1.0,
                'riskLevel': 'CRITICAL',
                'warnings': [f'Validation error: {str(e)}']
            }

# Initialize validator
validator = TransactionValidator()
print("✅ AI Transaction Validator initialized with 32-neuron architecture")

# Main validation loop
while True:
    try:
        line = sys.stdin.readline().strip()
        if not line:
            continue
            
        if line == "PING":
            print("PONG")
            sys.stdout.flush()
            continue
            
        # Parse transaction data
        tx_data = json.loads(line)
        
        # Validate transaction
        result = validator.validate_transaction(tx_data)
        
        # Send result
        print(json.dumps(result))
        sys.stdout.flush()
        
    except Exception as e:
        error_result = {
            'isValid': False,
            'confidence': 0.0,
            'anomalyScore': 1.0,
            'riskLevel': 'CRITICAL',
            'warnings': [f'Processing error: {str(e)}']
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
`], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let initTimeout: NodeJS.Timeout;

      this.aiProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('🤖 AI Validator:', output.trim());
        
        if (output.includes('✅ AI Transaction Validator initialized')) {
          clearTimeout(initTimeout);
          this.isRunning = true;
          resolve();
        }
      });

      this.aiProcess.stderr?.on('data', (data) => {
        console.error('🚨 AI Validator Error:', data.toString());
      });

      this.aiProcess.on('error', (error) => {
        console.error('❌ AI Process Error:', error);
        clearTimeout(initTimeout);
        reject(error);
      });

      this.aiProcess.on('exit', (code) => {
        console.log(`🤖 AI Validator process exited with code ${code}`);
        this.isRunning = false;
      });

      // Timeout for initialization
      initTimeout = setTimeout(() => {
        reject(new Error('AI validator initialization timeout'));
      }, 30000);
    });
  }

  private setupValidationLoop(): void {
    // Process validation queue every 100ms
    setInterval(() => {
      if (this.validationQueue.length > 0 && this.isRunning) {
        const transaction = this.validationQueue.shift();
        if (transaction) {
          this.processTransaction(transaction);
        }
      }
    }, 100);
  }

  private async processTransaction(transaction: TransactionData): Promise<void> {
    try {
      if (!this.aiProcess || !this.isRunning) {
        console.warn('⚠️ AI validator not ready, skipping validation');
        return;
      }

      // Send transaction to AI process
      this.aiProcess.stdin?.write(JSON.stringify(transaction) + '\n');

      // Set up response listener
      const responseHandler = (data: Buffer) => {
        try {
          const response = data.toString().trim();
          if (response && response !== 'PONG') {
            const result: ValidationResult = JSON.parse(response);
            this.validationHistory.push(result);
            
            // Emit validation result
            this.emit('validation', {
              transaction,
              result
            });

            // Log significant validations
            if (result.riskLevel === 'HIGH' || result.riskLevel === 'CRITICAL') {
              console.log(`🚨 HIGH RISK TRANSACTION DETECTED:
                Amount: ${transaction.amount}
                Risk: ${result.riskLevel}
                Anomaly Score: ${result.anomalyScore.toFixed(4)}
                Warnings: ${result.warnings.join(', ')}`);
            }
          }
        } catch (error) {
          console.error('Error parsing AI validation response:', error);
        }
      };

      // Add temporary listener for this transaction
      this.aiProcess.stdout?.once('data', responseHandler);

    } catch (error) {
      console.error('Error processing transaction validation:', error);
    }
  }

  // Public method to validate a transaction
  async validateTransaction(transaction: TransactionData): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️ AI validator not running, queuing transaction');
    }
    
    this.validationQueue.push(transaction);
    console.log(`🔍 Added transaction to validation queue (${this.validationQueue.length} pending)`);
  }

  // Get validation statistics
  getValidationStats() {
    const recent = this.validationHistory.slice(-100);
    const highRiskCount = recent.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
    const avgAnomalyScore = recent.reduce((sum, r) => sum + r.anomalyScore, 0) / recent.length || 0;
    
    return {
      totalValidations: this.validationHistory.length,
      recentValidations: recent.length,
      highRiskTransactions: highRiskCount,
      averageAnomalyScore: avgAnomalyScore.toFixed(4),
      queueLength: this.validationQueue.length,
      isRunning: this.isRunning
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (!this.isRunning || !this.aiProcess) {
      return false;
    }

    try {
      this.aiProcess.stdin?.write('PING\n');
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        
        const pongHandler = (data: Buffer) => {
          if (data.toString().includes('PONG')) {
            clearTimeout(timeout);
            resolve(true);
          }
        };
        
        this.aiProcess?.stdout?.once('data', pongHandler);
      });
    } catch {
      return false;
    }
  }

  // Shutdown validator
  async shutdown(): Promise<void> {
    if (this.aiProcess) {
      this.aiProcess.kill();
      this.aiProcess = null;
    }
    this.isRunning = false;
    console.log('🤖 AI Transaction Validator shutdown complete');
  }
}

// Export singleton instance
export const aiValidator = new AITransactionValidator();