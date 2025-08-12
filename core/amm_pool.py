#!/usr/bin/env python3
"""
5470 AMM (Automated Market Maker) - Uniswap-style DEX
Internal liquidity pool for 5470/other assets on native blockchain
"""

import json
import os
import time
import hashlib
from typing import Dict, List, Optional, Tuple
from decimal import Decimal, getcontext

# Set precision for financial calculations
getcontext().prec = 18

class AMMPool:
    """
    Automated Market Maker using constant product formula (x * y = k)
    Native implementation for 5470 blockchain
    """
    
    def __init__(self, pool_id: str, token_a: str = "5470", token_b: str = "BTC"):
        self.pool_id = pool_id
        self.token_a = token_a  # Base token (5470)
        self.token_b = token_b  # Pair token (BTC, ETH, etc.)
        
        # Pool reserves
        self.reserve_a = Decimal('0')  # 5470 tokens
        self.reserve_b = Decimal('0')  # Paired tokens
        
        # Pool tokens (LP tokens)
        self.total_supply = Decimal('0')
        self.lp_holders = {}  # address -> LP balance
        
        # Pool state
        self.fee_rate = Decimal('0.003')  # 0.3% fee
        self.created_at = int(time.time())
        self.last_price = Decimal('0')
        
        # Load existing pool data
        self.load_pool_state()
    
    def load_pool_state(self):
        """Load pool state from disk"""
        pool_file = f"amm_data/pool_{self.pool_id}.json"
        if os.path.exists(pool_file):
            try:
                with open(pool_file, 'r') as f:
                    data = json.load(f)
                    self.reserve_a = Decimal(str(data.get('reserve_a', '0')))
                    self.reserve_b = Decimal(str(data.get('reserve_b', '0')))
                    self.total_supply = Decimal(str(data.get('total_supply', '0')))
                    self.lp_holders = data.get('lp_holders', {})
                    self.last_price = Decimal(str(data.get('last_price', '0')))
                    print(f"📊 Loaded AMM pool {self.pool_id}: {self.reserve_a} {self.token_a} / {self.reserve_b} {self.token_b}")
            except Exception as e:
                print(f"⚠️ Error loading pool state: {e}")
    
    def save_pool_state(self):
        """Save pool state to disk"""
        os.makedirs("amm_data", exist_ok=True)
        pool_file = f"amm_data/pool_{self.pool_id}.json"
        
        data = {
            'pool_id': self.pool_id,
            'token_a': self.token_a,
            'token_b': self.token_b,
            'reserve_a': str(self.reserve_a),
            'reserve_b': str(self.reserve_b),
            'total_supply': str(self.total_supply),
            'lp_holders': self.lp_holders,
            'fee_rate': str(self.fee_rate),
            'created_at': self.created_at,
            'last_price': str(self.last_price),
            'last_update': int(time.time())
        }
        
        with open(pool_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_price(self) -> Decimal:
        """Get current price of token_b in terms of token_a"""
        if self.reserve_b == 0:
            return Decimal('0')
        return self.reserve_a / self.reserve_b
    
    def get_inverse_price(self) -> Decimal:
        """Get current price of token_a in terms of token_b"""
        if self.reserve_a == 0:
            return Decimal('0')
        return self.reserve_b / self.reserve_a
    
    def calculate_swap_output(self, amount_in: Decimal, token_in: str) -> Tuple[Decimal, Decimal]:
        """
        Calculate output amount for a swap using constant product formula
        Returns: (amount_out, fee_amount)
        """
        if token_in == self.token_a:
            reserve_in = self.reserve_a
            reserve_out = self.reserve_b
        elif token_in == self.token_b:
            reserve_in = self.reserve_b
            reserve_out = self.reserve_a
        else:
            raise ValueError(f"Invalid token: {token_in}")
        
        if reserve_in == 0 or reserve_out == 0:
            return Decimal('0'), Decimal('0')
        
        # Apply fee
        fee_amount = amount_in * self.fee_rate
        amount_in_after_fee = amount_in - fee_amount
        
        # Constant product formula: x * y = k
        # new_reserve_out = (reserve_in * reserve_out) / (reserve_in + amount_in_after_fee)
        # amount_out = reserve_out - new_reserve_out
        
        amount_out = (amount_in_after_fee * reserve_out) / (reserve_in + amount_in_after_fee)
        
        return amount_out, fee_amount
    
    def swap(self, amount_in: Decimal, token_in: str, user_address: str) -> Dict:
        """Execute a swap transaction"""
        if amount_in <= 0:
            return {'success': False, 'error': 'Invalid amount'}
        
        amount_out, fee_amount = self.calculate_swap_output(amount_in, token_in)
        
        if amount_out <= 0:
            return {'success': False, 'error': 'Insufficient liquidity'}
        
        # Update reserves
        if token_in == self.token_a:
            self.reserve_a += amount_in
            self.reserve_b -= amount_out
            token_out = self.token_b
        else:
            self.reserve_b += amount_in
            self.reserve_a -= amount_out
            token_out = self.token_a
        
        # Update price
        self.last_price = self.get_price()
        
        # Save state
        self.save_pool_state()
        
        return {
            'success': True,
            'amount_in': str(amount_in),
            'token_in': token_in,
            'amount_out': str(amount_out),
            'token_out': token_out,
            'fee_amount': str(fee_amount),
            'new_price': str(self.last_price),
            'user': user_address,
            'timestamp': int(time.time()),
            'tx_hash': hashlib.sha256(f"{user_address}{amount_in}{token_in}{time.time()}".encode()).hexdigest()[:16]
        }
    
    def add_liquidity(self, amount_a: Decimal, amount_b: Decimal, user_address: str) -> Dict:
        """Add liquidity to the pool"""
        if amount_a <= 0 or amount_b <= 0:
            return {'success': False, 'error': 'Invalid amounts'}
        
        # Calculate LP tokens to mint
        if self.total_supply == 0:
            # First liquidity provision
            lp_tokens = (amount_a * amount_b).sqrt()
        else:
            # Subsequent provisions - maintain price ratio
            lp_tokens_a = (amount_a * self.total_supply) / self.reserve_a
            lp_tokens_b = (amount_b * self.total_supply) / self.reserve_b
            lp_tokens = min(lp_tokens_a, lp_tokens_b)
        
        # Update reserves
        self.reserve_a += amount_a
        self.reserve_b += amount_b
        
        # Mint LP tokens
        self.total_supply += lp_tokens
        if user_address not in self.lp_holders:
            self.lp_holders[user_address] = '0'
        
        current_balance = Decimal(self.lp_holders[user_address])
        self.lp_holders[user_address] = str(current_balance + lp_tokens)
        
        # Update price
        self.last_price = self.get_price()
        
        # Save state
        self.save_pool_state()
        
        return {
            'success': True,
            'amount_a': str(amount_a),
            'amount_b': str(amount_b),
            'lp_tokens': str(lp_tokens),
            'total_supply': str(self.total_supply),
            'user_share': str((lp_tokens / self.total_supply) * 100),
            'new_price': str(self.last_price),
            'user': user_address,
            'timestamp': int(time.time())
        }
    
    def remove_liquidity(self, lp_tokens: Decimal, user_address: str) -> Dict:
        """Remove liquidity from the pool"""
        if lp_tokens <= 0:
            return {'success': False, 'error': 'Invalid LP token amount'}
        
        if user_address not in self.lp_holders:
            return {'success': False, 'error': 'No liquidity position'}
        
        user_lp_balance = Decimal(self.lp_holders[user_address])
        if lp_tokens > user_lp_balance:
            return {'success': False, 'error': 'Insufficient LP tokens'}
        
        # Calculate proportional amounts
        share = lp_tokens / self.total_supply
        amount_a = self.reserve_a * share
        amount_b = self.reserve_b * share
        
        # Update reserves
        self.reserve_a -= amount_a
        self.reserve_b -= amount_b
        
        # Burn LP tokens
        self.total_supply -= lp_tokens
        self.lp_holders[user_address] = str(user_lp_balance - lp_tokens)
        
        # Update price
        self.last_price = self.get_price()
        
        # Save state
        self.save_pool_state()
        
        return {
            'success': True,
            'lp_tokens_burned': str(lp_tokens),
            'amount_a_received': str(amount_a),
            'amount_b_received': str(amount_b),
            'remaining_lp_tokens': self.lp_holders[user_address],
            'new_price': str(self.last_price),
            'user': user_address,
            'timestamp': int(time.time())
        }
    
    def get_pool_info(self) -> Dict:
        """Get current pool information"""
        tvl = self.reserve_a + (self.reserve_b * self.get_price()) if self.get_price() > 0 else self.reserve_a
        
        return {
            'pool_id': self.pool_id,
            'token_a': self.token_a,
            'token_b': self.token_b,
            'reserve_a': str(self.reserve_a),
            'reserve_b': str(self.reserve_b),
            'total_supply': str(self.total_supply),
            'current_price': str(self.get_price()),
            'inverse_price': str(self.get_inverse_price()),
            'fee_rate': str(self.fee_rate),
            'tvl': str(tvl),
            'active_lps': len([addr for addr, balance in self.lp_holders.items() if Decimal(balance) > 0]),
            'created_at': self.created_at,
            'last_update': int(time.time())
        }

class AMMManager:
    """Manages multiple AMM pools"""
    
    def __init__(self):
        self.pools = {}
        self.supported_pairs = [
            ('5470', 'BTC'),
            ('5470', 'ETH'),
            ('5470', 'USDT'),
            ('5470', 'USDC')
        ]
        self.initialize_pools()
    
    def initialize_pools(self):
        """Initialize supported trading pairs"""
        for token_a, token_b in self.supported_pairs:
            pool_id = f"{token_a}_{token_b}"
            self.pools[pool_id] = AMMPool(pool_id, token_a, token_b)
            print(f"🔄 Initialized AMM pool: {pool_id}")
    
    def get_pool(self, pool_id: str) -> Optional[AMMPool]:
        """Get pool by ID"""
        return self.pools.get(pool_id)
    
    def get_all_pools(self) -> Dict:
        """Get information for all pools"""
        return {pool_id: pool.get_pool_info() for pool_id, pool in self.pools.items()}
    
    def execute_swap(self, pool_id: str, amount_in: Decimal, token_in: str, user_address: str) -> Dict:
        """Execute swap on specified pool"""
        pool = self.get_pool(pool_id)
        if not pool:
            return {'success': False, 'error': f'Pool {pool_id} not found'}
        
        return pool.swap(amount_in, token_in, user_address)
    
    def add_liquidity(self, pool_id: str, amount_a: Decimal, amount_b: Decimal, user_address: str) -> Dict:
        """Add liquidity to specified pool"""
        pool = self.get_pool(pool_id)
        if not pool:
            return {'success': False, 'error': f'Pool {pool_id} not found'}
        
        return pool.add_liquidity(amount_a, amount_b, user_address)
    
    def remove_liquidity(self, pool_id: str, lp_tokens: Decimal, user_address: str) -> Dict:
        """Remove liquidity from specified pool"""
        pool = self.get_pool(pool_id)
        if not pool:
            return {'success': False, 'error': f'Pool {pool_id} not found'}
        
        return pool.remove_liquidity(lp_tokens, user_address)

# Global AMM manager instance
amm_manager = AMMManager()

if __name__ == "__main__":
    print("🚀 5470 AMM (Automated Market Maker) System")
    print("=" * 50)
    
    # Initialize with some liquidity for demonstration
    pool = amm_manager.get_pool("5470_BTC")
    if pool and pool.total_supply == 0:
        # Add initial liquidity: 1000 5470 tokens and 0.05 BTC
        result = pool.add_liquidity(Decimal('1000'), Decimal('0.05'), 'genesis_pool')
        print(f"📊 Genesis liquidity added: {result}")
    
    # Show pool status
    pools_info = amm_manager.get_all_pools()
    for pool_id, info in pools_info.items():
        print(f"\n📈 Pool {pool_id}:")
        print(f"   Reserves: {info['reserve_a']} {info['token_a']} / {info['reserve_b']} {info['token_b']}")
        print(f"   Price: 1 {info['token_b']} = {info['current_price']} {info['token_a']}")
        print(f"   TVL: {info['tvl']} {info['token_a']}")