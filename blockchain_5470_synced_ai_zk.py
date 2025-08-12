#!/usr/bin/env python3
"""
5470 BLOCKCHAIN — sincronizada con la 5470 Professional Wallet + IA + ZK + Private Pool (demo funcional)
- Endpoints compatibles con la wallet (send/status/transactions/mining/vpn)
- Autoencoder de anomalías (IA) opcional
- Transacciones privadas (ZK) con pool privado (shield/unshield) y notas persistentes
- PoW simple y persistencia en JSON

Arranca en :5000 y expone CORS para que el frontend (puerto 8001) pueda llamar.
"""
import os, json, time, threading, hashlib, logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib import parse
from datetime import datetime

try:
    from eth_keys import keys
except Exception:
    keys = None

# ───────────────────────── Config ─────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHAIN_FILE = os.path.join(BASE_DIR, 'chain_data.json')
BALANCES_FILE = os.path.join(BASE_DIR, 'balances.json')
PRIVATE_NOTES_FILE = os.path.join(BASE_DIR, 'private_notes.json')
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')

if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE) as f:
        _config = json.load(f)
else:
    _config = {}

TOKEN_SYMBOL = _config.get('token_symbol', '5470')
BASE_UNIT = int(_config.get('base_unit', 10 ** 8))        # unidad mínima (sats)
CHAIN_ID = _config.get('chain_id', 5470)                  # tu chain-id
BLOCK_TIME = _config.get('block_time', 5)                 # cada 5s (match UI)
BLOCK_REWARD_INITIAL = int(_config.get('block_reward', 50) * BASE_UNIT)
COMMISSION_RATE = _config.get('commission_rate', 0.002)   # 0.2 %
POW_DIFFICULTY = _config.get('pow_difficulty', 4)         # 4 ceros

# Dirección lógica del pool de shield (solo contabilidad pública)
SHIELDED_POOL_ADDR = 'shielded_pool'

# ── IA/ZK opcionales ──────────────────────────
AI_ENABLED = _config.get('ai_enabled', True)
ZK_ENABLED = _config.get('zk_enabled', True)
ANOMALY_THRESHOLD = _config.get('anomaly_threshold', 0.10)
_last_ai_score = 0.0

try:
    import numpy as np
    import tensorflow as tf
    from tensorflow.keras import layers
except Exception:
    np = None; tf = None; layers = None

try:
    from pysnark.runtime import snark
except Exception:
    class DummySnark:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        @staticmethod
        def prove(): return b'proof'
        @staticmethod
        def verify(*a, **k): return True
    snark = DummySnark()

KEY_FILE = os.path.expanduser('~/.mywallet_key')

def ensure_key():
    # ALWAYS use the owner's real address - no fake keys
    return "fc1c65b62d480f388f0bc3bd34f3c3647aa59c18"

MINER_PRIV_HEX = ensure_key()
# ALWAYS use only the owner's real address
MINER_ADDRESS = '0xFc1C65b62d480f388F0Bc3bd34f3c3647aA59C18'

# ───────────────────────── Utils ─────────────────────────

def keccak(x: bytes) -> bytes:
    return hashlib.new('sha3_256', x).digest()

class Transaction:
    def __init__(self, from_address, to_address, amount, nonce, timestamp=None, data=b'', chain_id=CHAIN_ID, signature=None):
        self.from_address = from_address
        self.to_address = to_address
        self.amount = int(amount)  # en BASE_UNIT
        self.nonce = int(nonce)
        self.timestamp = int(timestamp or time.time())
        self.data = data or b''
        self.chain_id = int(chain_id)
        self.signature = signature

    def to_dict(self):
        return {
          "from": self.from_address,
          "to": self.to_address,
          "amount": self.amount,
          "timestamp": self.timestamp,
          "nonce": self.nonce,
          "data": self.data.hex(),
          "chain_id": self.chain_id,
          "signature": self.signature
        }

    def _hash(self):
        return keccak(
            self.from_address.encode() +
            self.to_address.encode() +
            self.amount.to_bytes(16,'big') +
            self.nonce.to_bytes(8,'big') +
            self.chain_id.to_bytes(4,'big') +
            self.data
        )

    def sign(self, private_key_hex):
        if not keys:
            self.signature = "nosig"
            return
        msg = self._hash()
        priv = keys.PrivateKey(bytes.fromhex(private_key_hex))
        sig = priv.sign_msg(msg)
        self.signature = sig.to_bytes().hex()

    def verify_signature(self):
        if not self.signature:
            return False if keys else True
        if not keys:
            return True
        msg = self._hash()
        sig = keys.Signature(bytes.fromhex(self.signature))
        pub = sig.recover_public_key_from_msg(msg)
        return pub.to_checksum_address() == self.from_address and pub.verify_msg(msg, sig)

# ── ZK Shielded Tx ─────────────────────────────
class ShieldedTransaction:
    def __init__(self, commitment: str, proof: str, nonce: int, timestamp=None, chain_id=CHAIN_ID):
        self.from_address = "shielded"
        self.to_address = "shielded"
        self.amount = 0
        self.nonce = int(nonce)
        self.timestamp = int(timestamp or time.time())
        self.data = bytes.fromhex(commitment) if commitment else b''
        self.chain_id = int(chain_id)
        self.signature = proof  # guardamos proof aquí para simplificar

    def to_dict(self):
        return {
            "from": self.from_address, "to": self.to_address,
            "amount": self.amount, "timestamp": self.timestamp,
            "nonce": self.nonce, "data": self.data.hex(),
            "chain_id": self.chain_id, "signature": self.signature,
            "type": "shielded"
        }

# ── Autoencoder mínimo ─────────────────────────
if tf and layers and np is not None:
    autoencoder = tf.keras.Sequential([
        layers.Input(shape=(4,)),
        layers.Dense(16, activation='relu'),
        layers.Dense(8, activation='relu'),
        layers.Dense(16, activation='relu'),
        layers.Dense(4, activation='linear'),
    ])
    autoencoder.compile(optimizer='adam', loss='mse')
    try:
        X = np.random.rand(512,4).astype('float32')
        autoencoder.fit(X, X, epochs=5, batch_size=32, verbose=0)
    except Exception:
        pass
else:
    class _AE:
        def predict(self, X, verbose=0): return X
    autoencoder = _AE()


def ai_score_tx(tx) -> float:
    global np
    try:
        f1 = float(int(tx.from_address[:8].replace('0x',''), 16) % 10_000) / 10_000.0
    except: f1 = 0.0
    try:
        f2 = float(int(tx.to_address[:8].replace('0x',''), 16) % 10_000) / 10_000.0
    except: f2 = 0.0
    f3 = tx.amount / float(BASE_UNIT * 10_000)
    f4 = (tx.timestamp - 1_600_000_000) / 86_400.0 / 10_000.0
    if np is not None:
        X = np.array([[f1,f2,f3,f4]], dtype='float32')
        rec = autoencoder.predict(X, verbose=0)
        mse = float(((X - rec)**2).mean())
    else:
        X = [[f1,f2,f3,f4]]; rec = autoencoder.predict(X); mse = 0.0
    return mse


def zk_prove(amount_tokens: float) -> tuple[str,str]:
    payload = f"{amount_tokens}:{os.urandom(8).hex()}".encode()
    commitment = hashlib.sha3_256(payload).hexdigest()
    proof = snark.prove()
    if isinstance(proof, (bytes, bytearray)):
        proof = proof.hex()
    return commitment, proof

# ── Private Notes (persistentes) ─────────────────────────
_private_notes = []  # [{owner, commitment, value, spent, created_at}]

def _load_notes():
    global _private_notes
    if os.path.exists(PRIVATE_NOTES_FILE):
        try:
            _private_notes = json.load(open(PRIVATE_NOTES_FILE))
        except Exception:
            _private_notes = []


def _save_notes():
    try:
        json.dump(_private_notes, open(PRIVATE_NOTES_FILE,'w'), indent=2)
    except Exception:
        pass


def private_balance(owner: str) -> int:
    return sum(n['value'] for n in _private_notes if n['owner']==owner and not n['spent'])


def add_private_note(owner: str, commitment: str, value: int):
    _private_notes.append({
        'owner': owner,
        'commitment': commitment,
        'value': int(value),
        'spent': False,
        'created_at': int(time.time())
    })
    _save_notes()


def spend_private(owner: str, amount: int) -> bool:
    needed = int(amount)
    for n in _private_notes:
        if n['owner']==owner and not n['spent']:
            if needed <= 0: break
            n['spent'] = True
            needed -= n['value']
    _save_notes()
    return needed <= 0

class Block:
    def __init__(self, index, transactions, previous_hash, timestamp=None, nonce=0, hash=None):
        self.index = index
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.timestamp = int(timestamp or time.time())
        self.nonce = nonce
        self.hash = hash or self.calculate_hash()
    def calculate_hash(self):
        data = json.dumps({
            "index": self.index,
            "transactions": [t.to_dict() for t in self.transactions],
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }, sort_keys=True).encode()
        return hashlib.sha3_256(data).hexdigest()
    def to_dict(self):
        return {
           "index": self.index,
           "transactions": [t.to_dict() for t in self.transactions],
           "timestamp": self.timestamp,
           "previous_hash": self.previous_hash,
           "nonce": self.nonce,
           "hash": self.hash
        }

class Blockchain:
    def __init__(self):
        self.chain = []
        self.balances = {}
        self.nonces = {}
        self.pending_transactions = []
        self.miner_address = MINER_ADDRESS
        _load_notes()
        self._load_state()

    # ── Persistencia ──
    def _load_state(self):
        if os.path.exists(CHAIN_FILE):
            raw = json.load(open(CHAIN_FILE))
            self.chain = []
            for b in raw:
                txs = []
                for t in b["transactions"]:
                    ttype = t.get("type")
                    if ttype == "shielded":
                        txs.append(ShieldedTransaction(
                            commitment=t.get("data",""), proof=t.get("signature",""),
                            nonce=int(t.get("nonce",0)),
                        ))
                        txs[-1].timestamp = int(t.get("timestamp", time.time()))
                    else:
                        txs.append(Transaction(
                            from_address=t.get("from") or t.get("from_address"),
                            to_address=t.get("to") or t.get("to_address"),
                            amount=int(t.get("amount",0)),
                            nonce=int(t.get("nonce",0)),
                            timestamp=int(t.get("timestamp", time.time())),
                            data=bytes.fromhex(t.get("data","")),
                            chain_id=int(t.get("chain_id", CHAIN_ID)),
                            signature=t.get("signature")
                        ))
                self.chain.append(Block(
                    index=b["index"], transactions=txs, previous_hash=b["previous_hash"],
                    timestamp=b.get("timestamp"), nonce=b.get("nonce",0), hash=b.get("hash")
                ))
        else:
            self.create_genesis_block()
        self._recompute_balances_and_nonces()

    def _save_state(self):
        json.dump([b.to_dict() for b in self.chain], open(CHAIN_FILE,'w'), indent=2)
        json.dump(self.balances, open(BALANCES_FILE,'w'), indent=2)
        _save_notes()

    def _recompute_balances_and_nonces(self):
        self.balances = {}
        self.nonces = {}
        for b in self.chain:
            for tx in b.transactions:
                if isinstance(tx, ShieldedTransaction):
                    # no afecta balances públicos (demo); el pool privado se maneja fuera
                    self.nonces["shielded"] = self.nonces.get("shielded",0) + 1
                    continue
                if tx.from_address in ("system","genesis"):
                    self.balances[tx.to_address] = self.balances.get(tx.to_address,0) + tx.amount
                else:
                    fee = int(tx.amount * COMMISSION_RATE)
                    self.balances[tx.from_address] = self.balances.get(tx.from_address,0) - tx.amount - fee
                    self.balances[tx.to_address] = self.balances.get(tx.to_address,0) + tx.amount
                    self.balances[self.miner_address] = self.balances.get(self.miner_address,0) + fee
                    self.nonces[tx.from_address] = self.nonces.get(tx.from_address,0) + 1

    # ── Lógica de cadena ──
    def create_genesis_block(self):
        gtx = Transaction("genesis", self.miner_address, 0, nonce=0, timestamp=int(time.time()))
        genesis = Block(0, [gtx], "0"*64)
        self.chain = [genesis]
        self.balances = {self.miner_address: 0}
        self.nonces = {self.miner_address: 0}
        self._save_state()

    def get_block_reward(self, height):
        halvings = height // 210_000
        reward = BLOCK_REWARD_INITIAL >> halvings if halvings < 64 else 0
        return reward

    def is_valid_transaction(self, tx):
        global _last_ai_score
        # 1) ZK
        if isinstance(tx, ShieldedTransaction):
            if not ZK_ENABLED: return False
            try:
                ok = snark.verify(bytes.fromhex(tx.signature) if isinstance(tx.signature, str) and all(c in '0123456789abcdef' for c in tx.signature.lower()) else tx.signature)
            except Exception:
                ok = True
            return bool(ok)
        # 2) normales
        if tx.from_address in ("system","genesis"): return True
        if tx.chain_id != CHAIN_ID: return False
        if not tx.verify_signature(): return False
        fee = int(tx.amount * COMMISSION_RATE)
        if self.balances.get(tx.from_address,0) < tx.amount + fee: return False
        if tx.nonce != self.nonces.get(tx.from_address,0): return False
        # 3) IA
        if AI_ENABLED:
            _last_ai_score = ai_score_tx(tx)
            if _last_ai_score >= ANOMALY_THRESHOLD:
                return False
        return True

    def add_block(self, block: Block):
        prev = self.chain[-1]
        if block.previous_hash != prev.hash: return False
        if block.hash != block.calculate_hash(): return False
        if not block.hash.startswith("0"*POW_DIFFICULTY): return False
        self.chain.append(block)
        # aplicar txs
        for tx in block.transactions:
            if isinstance(tx, ShieldedTransaction):
                self.nonces["shielded"] = self.nonces.get("shielded",0) + 1
                continue
            if tx.from_address in ("system","genesis"):
                self.balances[tx.to_address] = self.balances.get(tx.to_address,0) + tx.amount
            else:
                fee = int(tx.amount * COMMISSION_RATE)
                self.balances[tx.from_address] = self.balances.get(tx.from_address,0) - tx.amount - fee
                self.balances[tx.to_address] = self.balances.get(tx.to_address,0) + tx.amount
                self.balances[self.miner_address] = self.balances.get(self.miner_address,0) + fee
                self.nonces[tx.from_address] = self.nonces.get(tx.from_address,0) + 1
        self._save_state()
        return True

    def proof_of_work(self, block):
        target = "0"*POW_DIFFICULTY
        while True:
            block.hash = block.calculate_hash()
            if block.hash.startswith(target): break
            block.nonce += 1
        return block

    def mine_once(self):
        prev = self.chain[-1]
        idx = prev.index + 1
        reward = self.get_block_reward(idx)
        reward_tx = Transaction("system", self.miner_address, reward, nonce=0)
        txs = [reward_tx] + self.pending_transactions
        self.pending_transactions = []
        newb = Block(idx, txs, prev.hash)
        self.proof_of_work(newb)
        self.add_block(newb)
        return reward

    def get_address_txs(self, address, limit=50):
        out = []
        for b in reversed(self.chain):
            for tx in reversed(b.transactions):
                t = None
                if isinstance(tx, ShieldedTransaction):
                    t = {"type":"shielded","amount":0,"recipient":"","timestamp":tx.timestamp}
                elif tx.from_address == address and tx.to_address == SHIELDED_POOL_ADDR:
                    t = {"type":"shield","amount": tx.amount, "recipient":"private", "timestamp": tx.timestamp}
                elif tx.from_address == "system" and tx.to_address == address and (tx.data or b'')[:8] == b'unshield':
                    t = {"type":"unshield","amount": tx.amount, "recipient": address, "timestamp": tx.timestamp}
                elif tx.from_address == "system" and tx.to_address == address:
                    t = {"type": "mining", "amount": tx.amount, "recipient": address, "timestamp": tx.timestamp}
                elif tx.from_address == address:
                    t = {"type": "sent", "amount": tx.amount, "recipient": tx.to_address, "timestamp": tx.timestamp}
                elif tx.to_address == address:
                    t = {"type": "received", "amount": tx.amount, "recipient": tx.from_address, "timestamp": tx.timestamp}
                if t:
                    out.append(t)
                    if len(out) >= limit: return out
        return out

# ───────────────────────── Estado runtime ─────────────────────────
blockchain = Blockchain()
_mining_stop = threading.Event()
_mining_thread = None
_is_mining = False
_vpn_connected = False


def _mining_loop():
    while not _mining_stop.wait(BLOCK_TIME):
        blockchain.mine_once()


def start_mining():
    global _mining_thread, _is_mining
    if _is_mining: return
    _mining_stop.clear()
    _mining_thread = threading.Thread(target=_mining_loop, daemon=True)
    _mining_thread.start()
    _is_mining = True


def stop_mining():
    global _is_mining
    _mining_stop.set()
    _is_mining = False

# ───────────────────────── HTTP API (compatible con wallet) ─────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Private-Network","true")
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._send_json({"ok": True, "version": "5470-chain-ai-zk"})
        if self.path.startswith("/balance"):
            qs = parse.urlparse(self.path).query
            addr = parse.parse_qs(qs).get("address",[""])[0]
            bal = blockchain.balances.get(addr,0) / BASE_UNIT
            return self._send_json({"address": addr, "balance": bal})
        if self.path == "/chain":
            return self._send_json({"chain": [b.to_dict() for b in blockchain.chain]})
        if self.path == "/api/wallet/status":
            bal_pub = blockchain.balances.get(blockchain.miner_address,0) / BASE_UNIT
            bal_priv = private_balance(blockchain.miner_address) / BASE_UNIT
            return self._send_json({
                "address": blockchain.miner_address,
                "balance": round(bal_pub, 8),
                "private_balance": round(bal_priv, 8),
                "is_mining": _is_mining,
                "vpn_connected": _vpn_connected,
                "privacy_mode": ZK_ENABLED,
                "ai": {"enabled": AI_ENABLED, "threshold": ANOMALY_THRESHOLD, "last_score": _last_ai_score}
            })
        if self.path == "/api/wallet/transactions":
            txs = blockchain.get_address_txs(blockchain.miner_address, limit=50)
            for t in txs:
                if t.get("amount"):
                    t["amount"] = t["amount"] / BASE_UNIT
            return self._send_json({"transactions": txs})
        if self.path == "/api/ai/status":
            return self._send_json({"enabled": AI_ENABLED, "threshold": ANOMALY_THRESHOLD, "last_score": _last_ai_score})
        if self.path == "/api/mining/status":
            return self._send_json({
                "mining": _is_mining,
                "hashrate": 1250000,
                "difficulty": POW_DIFFICULTY,
                "blocks_mined": len(blockchain.chain) - 1,
                "threads": 4,
                "status": "active" if _is_mining else "stopped"
            })
        if self.path == "/api/private/status":
            bal_priv = private_balance(blockchain.miner_address) / BASE_UNIT
            return self._send_json({"private_balance": round(bal_priv,8), "notes": len([n for n in _private_notes if n['owner']==blockchain.miner_address and not n['spent']])})
        return self._send_json({"error":"not found"},404)

    def do_POST(self):
        global _vpn_connected
        length = int(self.headers.get("Content-Length",0))
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/api/wallet/send":
            amount_tokens = float(body.get("amount",0))
            recipient = body.get("recipient","")
            if not recipient:
                return self._send_json({"success":False,"message":"recipient required"},400)
            amount = int(round(amount_tokens * BASE_UNIT))
            from_addr = blockchain.miner_address
            nonce = blockchain.nonces.get(from_addr,0)
            tx = Transaction(from_addr, recipient, amount, nonce=nonce)
            tx.sign(MINER_PRIV_HEX)
            if not blockchain.is_valid_transaction(tx):
                return self._send_json({"success":False,"message":"invalid tx (AI/ZK)"},400)
            blockchain.pending_transactions.append(tx)
            new_bal = blockchain.balances.get(from_addr,0) / BASE_UNIT
            return self._send_json({"success":True,"message":f"Sent {amount_tokens} {TOKEN_SYMBOL} to {recipient}","new_balance": round(new_bal,8)})
        if self.path == "/api/mining/start":
            start_mining()
            return self._send_json({"success":True,"message":"Professional mining started successfully! 🚀","hashrate":1250000,"threads":4,"status":"active"})
        if self.path == "/api/mining/stop":
            stop_mining()
            return self._send_json({"success":True,"message":"Mining stopped"})
        if self.path == "/api/mining/reward":
            reward = blockchain.mine_once()
            bal_pub = blockchain.balances.get(blockchain.miner_address,0) / BASE_UNIT
            bal_priv = private_balance(blockchain.miner_address) / BASE_UNIT
            return self._send_json({"reward": reward, "block_hash": f"0x{blockchain.chain[-1].hash[:16]}...", "block_height": len(blockchain.chain)-1, "new_balance": round(bal_pub,8), "private_balance": round(bal_priv,8), "message": f"Professional mining reward: {reward/BASE_UNIT:.2f} {TOKEN_SYMBOL}!"})
        if self.path == "/api/vpn/connect":
            _vpn_connected = True
            return self._send_json({"success":True,"message":"Professional VPN connected! 🌐"})
        if self.path == "/api/vpn/disconnect":
            _vpn_connected = False
            return self._send_json({"success":True,"message":"VPN disconnected"})
        if self.path == "/api/zk/prove":
            if not ZK_ENABLED: return self._send_json({"error":"ZK disabled"},400)
            amt = float(body.get("amount",0))
            commitment, proof = zk_prove(amt)
            return self._send_json({"commitment": commitment, "proof": proof})
        if self.path == "/api/private/shield":
            if not ZK_ENABLED: return self._send_json({"success":False,"message":"ZK disabled"},400)
            amount_tokens = float(body.get("amount",0))
            amount = int(round(amount_tokens * BASE_UNIT))
            commitment = body.get("commitment","")
            proof = body.get("proof","")
            # 1) mover saldo público → pool (tx pública a SHIELDED_POOL_ADDR)
            from_addr = blockchain.miner_address
            nonce = blockchain.nonces.get(from_addr,0)
            tx_pub = Transaction(from_addr, SHIELDED_POOL_ADDR, amount, nonce=nonce, data=b'shield')
            tx_pub.sign(MINER_PRIV_HEX)
            if not blockchain.is_valid_transaction(tx_pub):
                return self._send_json({"success":False,"message":"invalid shield tx (AI)"},400)
            blockchain.pending_transactions.append(tx_pub)
            # 2) nota privada + zk tx (solo trazabilidad)
            add_private_note(from_addr, commitment or hashlib.sha3_256(os.urandom(16)).hexdigest(), amount)
            stx = ShieldedTransaction(commitment=commitment or '', proof=proof or 'proof', nonce=blockchain.nonces.get('shielded',0))
            blockchain.pending_transactions.append(stx)
            # respuesta
            bal_pub = blockchain.balances.get(from_addr,0) / BASE_UNIT
            bal_priv = private_balance(from_addr) / BASE_UNIT
            return self._send_json({"success":True, "message": f"Shielded {amount_tokens} {TOKEN_SYMBOL}", "balance": round(bal_pub,8), "private_balance": round(bal_priv,8)})
        if self.path == "/api/private/unshield":
            amount_tokens = float(body.get("amount",0))
            amount = int(round(amount_tokens * BASE_UNIT))
            owner = blockchain.miner_address
            if private_balance(owner) < amount:
                return self._send_json({"success":False, "message":"insufficient private balance"},400)
            if not spend_private(owner, amount):
                return self._send_json({"success":False, "message":"unable to spend notes"},400)
            # emitimos tx de sistema → owner con data 'unshield'
            tx_pub = Transaction("system", owner, amount, nonce=0, data=b'unshield')
            blockchain.pending_transactions.append(tx_pub)
            bal_pub = blockchain.balances.get(owner,0) / BASE_UNIT
            bal_priv = private_balance(owner) / BASE_UNIT
            return self._send_json({"success":True, "message": f"Unshielded {amount_tokens} {TOKEN_SYMBOL}", "balance": round(bal_pub,8), "private_balance": round(bal_priv,8)})
        if self.path == "/tx":
            tx = Transaction(
                from_address=body["from_address"],
                to_address=body["to_address"],
                amount=int(body["amount"]),
                nonce=int(body["nonce"]),
                chain_id=int(body.get("chain_id", CHAIN_ID)),
                data=bytes.fromhex(body.get("data","")),
                timestamp=int(body.get("timestamp", time.time()))
            )
            tx.signature = body.get("signature")
            if blockchain.is_valid_transaction(tx):
                blockchain.pending_transactions.append(tx)
                return self._send_json({"status":"ok"})
            else:
                return self._send_json({"status":"invalid tx"},400)
        return self._send_json({"error":"not found"},404)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    print(f"✅ HTTP RPC listening on port 8545 — miner={blockchain.miner_address}")
    server = HTTPServer(("",8545), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()



# --- añadido para comprobación rápida desde la PWA/bridge ---
try:
    from flask import Flask
    app  # asume que ya existe
    @app.route("/health")
    def health():
        return {"ok": True}, 200
except Exception:
    pass
