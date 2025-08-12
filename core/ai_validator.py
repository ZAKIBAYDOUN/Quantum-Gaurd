#!/usr/bin/env python3
"""
TensorFlow/Keras AI Transaction Validator for 5470 Blockchain
32-neuron neural network for anomaly detection and transaction validation
"""

import numpy as np
import json
import time
import os
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

# TensorFlow imports with error handling
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    TF_AVAILABLE = True
    print("✅ TensorFlow available for AI validation")
except ImportError as e:
    print(f"⚠️ TensorFlow not available: {e}")
    print("🔄 Using simplified AI validation fallback")
    TF_AVAILABLE = False
    tf = None
    keras = None
    layers = None

@dataclass 
class TransactionFeatures:
    """Features extracted from transaction for AI analysis"""
    amount: float
    timestamp: float
    hour_of_day: int
    day_of_week: int
    amount_normalized: float
    time_since_last_tx: float
    frequency_score: float
    amount_deviation: float
    
    def to_array(self) -> np.ndarray:
        """Convert to numpy array for neural network input"""
        return np.array([
            self.amount_normalized,
            self.hour_of_day / 24.0,  # Normalize to [0,1]
            self.day_of_week / 7.0,   # Normalize to [0,1] 
            self.time_since_last_tx,
            self.frequency_score,
            self.amount_deviation,
            np.sin(2 * np.pi * self.hour_of_day / 24.0),  # Cyclical hour encoding
            np.cos(2 * np.pi * self.hour_of_day / 24.0)   # Cyclical hour encoding
        ])

class TransactionAIValidator:
    """AI-powered transaction validator using 32-neuron neural network"""
    
    def __init__(self, model_dir: str = "ai_models"):
        self.model_dir = model_dir
        self.model_file = os.path.join(model_dir, "transaction_validator_32.h5")
        self.history_file = os.path.join(model_dir, "transaction_history.json")
        
        os.makedirs(model_dir, exist_ok=True)
        
        self.model = None
        self.transaction_history: List[Dict] = []
        self.anomaly_threshold = 0.1
        self.last_validation_score = 0.0
        
        # Statistics for normalization
        self.amount_stats = {"mean": 10.0, "std": 25.0, "min": 0.0, "max": 1000.0}
        
        self.load_transaction_history()
        
        if TF_AVAILABLE:
            self.initialize_neural_network()
        else:
            print("🤖 Using rule-based validation (TensorFlow not available)")
    
    def initialize_neural_network(self):
        """Initialize 32-neuron neural network for transaction validation"""
        try:
            if os.path.exists(self.model_file):
                print("📂 Loading existing AI validation model...")
                self.model = keras.models.load_model(self.model_file)
                print("✅ AI model loaded successfully")
            else:
                print("🧠 Creating new 32-neuron transaction validator...")
                self.create_neural_network()
                print("✅ New AI model created")
                
        except Exception as e:
            print(f"❌ Error initializing neural network: {e}")
            self.model = None
    
    def create_neural_network(self):
        """Create 32-neuron autoencoder for anomaly detection"""
        if not TF_AVAILABLE:
            return
            
        # Input layer - 8 features
        input_layer = keras.Input(shape=(8,), name="transaction_features")
        
        # Encoder layers
        encoded = layers.Dense(32, activation='relu', name="encoder_32")(input_layer)
        encoded = layers.Dropout(0.2)(encoded)
        encoded = layers.Dense(16, activation='relu', name="encoder_16")(encoded) 
        encoded = layers.Dropout(0.1)(encoded)
        encoded = layers.Dense(8, activation='relu', name="bottleneck")(encoded)
        
        # Decoder layers
        decoded = layers.Dense(16, activation='relu', name="decoder_16")(encoded)
        decoded = layers.Dropout(0.1)(decoded)
        decoded = layers.Dense(32, activation='relu', name="decoder_32")(decoded)
        decoded = layers.Dropout(0.2)(decoded)
        decoded = layers.Dense(8, activation='sigmoid', name="output_reconstruction")(decoded)
        
        # Create autoencoder model
        self.model = keras.Model(input_layer, decoded, name="transaction_validator_32")
        
        # Compile with anomaly detection focus
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        print("🧠 32-neuron neural network architecture:")
        self.model.summary()
        
        # Generate initial training data if no history exists
        if len(self.transaction_history) < 100:
            print("📚 Generating initial training data...")
            self.generate_training_data()
            self.train_model()
    
    def generate_training_data(self, num_samples: int = 1000):
        """Generate synthetic training data for normal transactions"""
        print(f"🎲 Generating {num_samples} training samples...")
        
        training_data = []
        
        for i in range(num_samples):
            # Generate normal transaction patterns
            base_time = time.time() - (i * 3600)  # Spread over hours
            
            # Normal business hours bias
            hour = int((base_time % 86400) / 3600)
            if 9 <= hour <= 17:  # Business hours
                amount = np.random.lognormal(2.5, 1.0)  # $12-50 typical
            else:  # Off hours
                amount = np.random.lognormal(1.8, 0.8)  # $6-20 typical
            
            # Clip amount to reasonable range
            amount = max(0.1, min(amount, 1000.0))
            
            features = self.extract_features({
                'amount': amount,
                'timestamp': base_time,
                'from_address': f"0x{''.join([hex(np.random.randint(0,16))[2:] for _ in range(40)])}",
                'to_address': f"0x{''.join([hex(np.random.randint(0,16))[2:] for _ in range(40)])}"
            })
            
            training_data.append(features.to_array())
        
        self.training_data = np.array(training_data)
        print(f"✅ Generated {len(training_data)} training samples")
    
    def train_model(self, epochs: int = 50):
        """Train the neural network on transaction data"""
        if not TF_AVAILABLE or self.model is None:
            return
        
        if not hasattr(self, 'training_data') or len(self.training_data) == 0:
            print("❌ No training data available")
            return
        
        print(f"🏋️ Training AI model for {epochs} epochs...")
        
        # For autoencoder, input = output (unsupervised learning)
        X = self.training_data
        y = self.training_data  # Reconstruct input
        
        # Split training/validation
        split_idx = int(0.8 * len(X))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Train model
        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=32,
            validation_data=(X_val, y_val),
            verbose=1,
            callbacks=[
                keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
                keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5)
            ]
        )
        
        # Save model
        self.model.save(self.model_file)
        
        print(f"✅ AI model training completed")
        print(f"   Final loss: {history.history['loss'][-1]:.4f}")
        print(f"   Final val_loss: {history.history['val_loss'][-1]:.4f}")
    
    def extract_features(self, transaction: Dict) -> TransactionFeatures:
        """Extract features from transaction for AI analysis"""
        timestamp = transaction.get('timestamp', time.time())
        amount = float(transaction.get('amount', 0))
        
        # Time-based features
        dt = time.localtime(timestamp)
        hour_of_day = dt.tm_hour
        day_of_week = dt.tm_wday
        
        # Normalize amount
        amount_normalized = min(1.0, amount / 1000.0)  # Cap at 1000
        
        # Calculate time since last transaction
        time_since_last = 1.0  # Default
        if self.transaction_history:
            last_tx_time = self.transaction_history[-1].get('timestamp', timestamp)
            time_since_last = min(1.0, (timestamp - last_tx_time) / 3600.0)  # Hours, cap at 1
        
        # Frequency score (how often this amount appears)
        similar_amounts = [tx for tx in self.transaction_history 
                          if abs(tx.get('amount', 0) - amount) < amount * 0.1]
        frequency_score = min(1.0, len(similar_amounts) / 100.0)
        
        # Amount deviation from recent average
        recent_amounts = [tx.get('amount', 0) for tx in self.transaction_history[-50:]]
        if recent_amounts:
            avg_amount = np.mean(recent_amounts)
            amount_deviation = min(1.0, abs(amount - avg_amount) / max(avg_amount, 1.0))
        else:
            amount_deviation = 0.5
        
        return TransactionFeatures(
            amount=amount,
            timestamp=timestamp,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            amount_normalized=amount_normalized,
            time_since_last_tx=time_since_last,
            frequency_score=frequency_score,
            amount_deviation=amount_deviation
        )
    
    def validate_transaction(self, transaction: Dict) -> Dict:
        """Validate transaction using AI model"""
        try:
            features = self.extract_features(transaction)
            feature_array = features.to_array().reshape(1, -1)
            
            if TF_AVAILABLE and self.model is not None:
                # Use neural network
                reconstruction = self.model.predict(feature_array, verbose=0)
                reconstruction_error = np.mean(np.square(feature_array - reconstruction))
                anomaly_score = min(1.0, reconstruction_error)
                self.last_validation_score = anomaly_score
                
                is_anomaly = anomaly_score > self.anomaly_threshold
                confidence = 1.0 - anomaly_score
                
            else:
                # Rule-based fallback validation
                anomaly_score, is_anomaly, confidence = self.rule_based_validation(features)
                self.last_validation_score = anomaly_score
            
            # Add to history
            tx_record = transaction.copy()
            tx_record['validation_timestamp'] = time.time()
            tx_record['anomaly_score'] = anomaly_score
            tx_record['is_anomaly'] = is_anomaly
            self.transaction_history.append(tx_record)
            
            # Keep history manageable
            if len(self.transaction_history) > 10000:
                self.transaction_history = self.transaction_history[-5000:]
            
            self.save_transaction_history()
            
            return {
                "valid": not is_anomaly,
                "anomaly_score": anomaly_score,
                "confidence": confidence,
                "is_anomaly": is_anomaly,
                "threshold": self.anomaly_threshold,
                "features_analyzed": 8,
                "validation_method": "neural_network" if (TF_AVAILABLE and self.model) else "rule_based"
            }
            
        except Exception as e:
            print(f"❌ AI validation error: {e}")
            return {
                "valid": True,
                "anomaly_score": 0.5,
                "confidence": 0.5,
                "is_anomaly": False,
                "error": str(e),
                "validation_method": "fallback"
            }
    
    def rule_based_validation(self, features: TransactionFeatures) -> Tuple[float, bool, float]:
        """Rule-based validation fallback when TensorFlow is not available"""
        anomaly_indicators = []
        
        # Check for unusual amounts
        if features.amount > 500:  # Large transaction
            anomaly_indicators.append(0.3)
        elif features.amount < 0.1:  # Very small transaction
            anomaly_indicators.append(0.2)
        
        # Check for unusual timing
        if features.hour_of_day < 6 or features.hour_of_day > 22:  # Late night/early morning
            anomaly_indicators.append(0.2)
        
        # Check frequency patterns
        if features.frequency_score > 0.8:  # Very frequent amount
            anomaly_indicators.append(0.1)
        elif features.frequency_score < 0.1:  # Very unusual amount
            anomaly_indicators.append(0.3)
        
        # Check deviation from normal
        if features.amount_deviation > 0.7:  # Very different from recent
            anomaly_indicators.append(0.4)
        
        # Calculate overall anomaly score
        if anomaly_indicators:
            anomaly_score = min(1.0, sum(anomaly_indicators) / len(anomaly_indicators))
        else:
            anomaly_score = 0.1  # Low baseline
        
        is_anomaly = anomaly_score > self.anomaly_threshold
        confidence = 1.0 - anomaly_score
        
        return anomaly_score, is_anomaly, confidence
    
    def get_ai_stats(self) -> Dict:
        """Get AI validation statistics"""
        recent_validations = self.transaction_history[-100:] if len(self.transaction_history) >= 100 else self.transaction_history
        
        if not recent_validations:
            return {
                "total_validations": 0,
                "anomaly_rate": 0.0,
                "avg_score": 0.0,
                "model_available": TF_AVAILABLE and self.model is not None
            }
        
        anomaly_count = sum(1 for tx in recent_validations if tx.get('is_anomaly', False))
        avg_score = np.mean([tx.get('anomaly_score', 0) for tx in recent_validations])
        
        return {
            "total_validations": len(self.transaction_history),
            "recent_validations": len(recent_validations),
            "anomaly_rate": anomaly_count / len(recent_validations) if recent_validations else 0.0,
            "avg_anomaly_score": float(avg_score),
            "last_score": self.last_validation_score,
            "threshold": self.anomaly_threshold,
            "model_available": TF_AVAILABLE and self.model is not None,
            "tensorflow_version": tf.__version__ if TF_AVAILABLE else "Not available",
            "model_architecture": "32-neuron autoencoder" if self.model else "Rule-based fallback"
        }
    
    def save_transaction_history(self):
        """Save transaction history to disk"""
        try:
            with open(self.history_file, 'w') as f:
                json.dump(self.transaction_history[-1000:], f, indent=2)  # Keep last 1000
        except Exception as e:
            print(f"❌ Error saving transaction history: {e}")
    
    def load_transaction_history(self):
        """Load transaction history from disk"""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, 'r') as f:
                    self.transaction_history = json.load(f)
                print(f"📂 Loaded {len(self.transaction_history)} transaction validation records")
        except Exception as e:
            print(f"❌ Error loading transaction history: {e}")
            self.transaction_history = []

# Global AI validator instance
ai_validator = TransactionAIValidator()

if __name__ == "__main__":
    # Test AI validation system
    print("🧠 Testing AI Transaction Validator...")
    
    validator = TransactionAIValidator("test_ai_models")
    
    # Test normal transaction
    normal_tx = {
        "amount": 15.50,
        "timestamp": time.time(),
        "from_address": "0x742d35Cc6635C0532925a3b8D2c23a12D2c53f15",
        "to_address": "0x8ba1f109551bD432803012645Hac136c07d40d73"
    }
    
    result = validator.validate_transaction(normal_tx)
    print(f"\n✅ Normal transaction validation:")
    print(f"   Valid: {result['valid']}")
    print(f"   Anomaly Score: {result['anomaly_score']:.3f}")
    print(f"   Confidence: {result['confidence']:.3f}")
    print(f"   Method: {result['validation_method']}")
    
    # Test suspicious transaction
    suspicious_tx = {
        "amount": 999.99,  # Large amount
        "timestamp": time.time(),
        "from_address": "0x742d35Cc6635C0532925a3b8D2c23a12D2c53f15",
        "to_address": "0x8ba1f109551bD432803012645Hac136c07d40d73"
    }
    
    result = validator.validate_transaction(suspicious_tx)
    print(f"\n⚠️ Suspicious transaction validation:")
    print(f"   Valid: {result['valid']}")
    print(f"   Anomaly Score: {result['anomaly_score']:.3f}")
    print(f"   Confidence: {result['confidence']:.3f}")
    print(f"   Is Anomaly: {result['is_anomaly']}")
    
    # Show AI stats
    print(f"\n📊 AI Validation Statistics:")
    stats = validator.get_ai_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")