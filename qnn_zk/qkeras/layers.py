# qkeras/layers.py
import numpy as np
from typing import Tuple
from qflow.core import Q, to_q, from_q

class Layer:
    def build(self, input_shape: Tuple[int]): ...
    def forward(self, x: np.ndarray) -> np.ndarray: ...
    def params(self): return []

class Dense(Layer):
    def __init__(self, units: int):
        self.units = units
    def build(self, input_shape):
        in_f = input_shape[-1]
        limit = np.sqrt(6/(in_f+self.units))
        self.W = (np.random.uniform(-limit, limit, (in_f, self.units))).astype(np.float64)
        self.b = np.zeros((self.units,), dtype=np.float64)
    def forward(self, x):
        return x @ self.W + self.b
    def params(self): return [self.W, self.b]

class QuantumNeuronLayer(Layer):
    """32 'neuronas cuánticas' simuladas con bloques variacionales ligeros."""
    def __init__(self, width: int = 32, depth: int = 2, seed: int = 42):
        self.width = width
        self.depth = depth
        self.rng = np.random.default_rng(seed)
    def build(self, input_shape):
        in_f = input_shape[-1]
        self.theta = self.rng.normal(0, 0.2, (self.depth, self.width, 3))  # Rx,Ry,Rz
        self.embed = self.rng.normal(0, 0.5, (in_f, self.width))          # proyección
        self.alpha = self.rng.normal(0, 0.2, (self.width,))                # mezcla
    def _rot_block(self, S, theta):
        w = S.shape[1]
        a = S[:,:,0]; b = S[:,:,1]
        rx, ry, rz = theta[:,0], theta[:,1], theta[:,2]
        a1 = a*np.cos(rx) - b*np.sin(rx); b1 = a*np.sin(rx) + b*np.cos(rx)
        a2 = a1*np.cos(ry) - b1*np.sin(ry); b2 = a1*np.sin(ry) + b1*np.cos(ry)
        a3 = a2 + 0.1*np.roll(b2, 1, axis=1)
        b3 = b2 - 0.1*np.roll(a2, -1, axis=1)
        a4 = a3*np.cos(rz) - b3*np.sin(rz); b4 = a3*np.sin(rz) + b3*np.cos(rz)
        norm = np.maximum(np.sqrt(a4*a4 + b4*b4), 1e-6)
        return np.stack([a4/norm, b4/norm], axis=2)
    def forward(self, x):
        B, F = x.shape
        angles = x @ self.embed
        S = np.zeros((B, self.width, 2), dtype=np.float64); S[:,:,0] = 1.0
        for d in range(self.depth):
            th = self.theta[d] + np.stack([angles, angles, angles], axis=2)
            S = self._rot_block(S, th)
        expZ = S[:,:,0]**2 - S[:,:,1]**2
        mix = expZ + (x @ self.embed) * 0.05 + self.alpha
        return 0.5*(np.tanh(mix) + 1.0)
    def params(self): return [self.theta, self.embed, self.alpha]
