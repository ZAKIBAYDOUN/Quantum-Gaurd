# qflow/core.py
import json, math, os, hashlib
from dataclasses import dataclass
from typing import List, Dict, Any
import numpy as np

Q = 16  # Q16.16 (fixed point)

def to_q(x):
    return (np.round(np.array(x, dtype=np.float64) * (1 << Q))).astype(np.int64)

def from_q(xq):
    return np.array(xq, dtype=np.float64) / float(1 << Q)

def blake2b_hex(data: bytes) -> str:
    return hashlib.blake2b(data).hexdigest()

@dataclass
class Tensor:
    data: np.ndarray
    name: str | None = None

class Optimizer:
    def __init__(self, lr: float = 1e-3):
        self.lr = lr
    def step(self, params: List[np.ndarray], grads: List[np.ndarray]):
        pass

class Loss:
    def __call__(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        eps = 1e-7
        y_pred = np.clip(y_pred, eps, 1-eps)
        return float(-np.mean(y_true*np.log(y_pred)+(1-y_true)*np.log(1-y_pred)))

def save_json(path: str, obj: Dict[str, Any]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)

def load_json(path: str) -> Dict[str, Any]:
    with open(path) as f:
        return json.load(f)
