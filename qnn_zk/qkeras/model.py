# qkeras/model.py
import numpy as np
from typing import List
from qflow.core import Loss
from .layers import Layer

class Model:
    def __init__(self, layers: List[Layer]):
        self.layers = layers
        self.built = False
    def build(self, input_shape):
        xshape = input_shape
        for ly in self.layers:
            ly.build(xshape)
            if hasattr(ly, 'units'): xshape = (None, ly.units)
            elif hasattr(ly, 'width'): xshape = (None, ly.width)
        self.built = True
    def forward(self, x: np.ndarray) -> np.ndarray:
        assert self.built
        h = x
        for ly in self.layers:
            h = ly.forward(h)
        return h
    def compile(self, optimizer=None, loss=None):
        self.optimizer = optimizer
        self.loss = loss or Loss()
    def fit(self, X, y, epochs=3, batch_size=64):
        for _ in range(epochs):
            _ = self.forward(X)
    def predict(self, X):
        return self.forward(X)
    def get_weights(self):
        W = []
        for ly in self.layers:
            if hasattr(ly, 'params'):
                for p in ly.params(): W.append(p)
        return W
