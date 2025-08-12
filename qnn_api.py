# qnn_api.py
from fastapi import FastAPI
from pydantic import BaseModel, conlist
from typing import List, Dict
import numpy as np
import hashlib
import time

app = FastAPI(title="5470 QNN API", version="0.1.0")

class InferRequest(BaseModel):
    features: List[float]  # vector fijo (ej. 16)
    meta: Dict[str, str] | None = None

class InferResponse(BaseModel):
    score: float
    q_out: float
    model_version: str
    transcript_hash: str
    commits: Dict[str, str]
    runtime_ms: int

def normalize(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, -10, 10)
    return (x - (-10.0)) / (20.0)  # [0,1]

def qnn_forward(x: np.ndarray) -> tuple[float, float]:
    # QNN "simulada": proyección + no lineal + acoplos (ligero y determinista)
    rng = np.random.default_rng(42)  # semilla fija
    W = rng.normal(0, 0.3, (x.shape[0], 32))
    A = x @ W
    # "bloques" trig y acoplo circular
    A = np.tanh(A) + 0.05 * np.roll(A, 1, axis=0)
    q_out = float(A.mean())
    # cabeza sigmoide
    score = 1.0 / (1.0 + np.exp(-3.0 * q_out))
    return max(0.0, min(1.0, score)), q_out

@app.get("/healthz")
def healthz():
    return {"ok": True, "ts": int(time.time())}

@app.post("/infer", response_model=InferResponse)
def infer(req: InferRequest):
    t0 = time.time()
    x = np.array(req.features, dtype=np.float64)
    xn = normalize(x)
    score, q_out = qnn_forward(xn)

    # transcript simple (compromisos de entrada+salida)
    commits = {
        "input_norm_hash": hashlib.blake2b(xn.tobytes(), digest_size=16).hexdigest(),
        "output_hash": hashlib.blake2b(f"{score:.6f}|{q_out:.6f}".encode(), digest_size=16).hexdigest(),
    }
    transcript = hashlib.blake2b(
        f"{commits['input_norm_hash']}|{commits['output_hash']}|qnn-v0.1".encode(), digest_size=32
    ).hexdigest()

    return {
        "score": score,
        "q_out": q_out,
        "model_version": "qnn-v0.1",
        "transcript_hash": transcript,
        "commits": commits,
        "runtime_ms": int((time.time() - t0) * 1000),
    }

# --- BASELINE LOGÍSTICO DETERMINISTA COMO FALLBACK (ChatGPT Plus) ---
class BaselineReq(BaseModel):
    features: List[float]

class BaselineResp(BaseModel):
    prob: float
    z: float
    used_mean: List[float]
    used_std: List[float]
    model: str

# parámetros fijos (16 dims) para estabilidad
BASE_MEAN = np.zeros(16, dtype=np.float64)
BASE_STD = np.ones(16, dtype=np.float64)
RNG = np.random.default_rng(0)
W = RNG.normal(0, 0.35, 16).astype(np.float64)
B = 0.0

def safe_scale(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float64)
    # recorta extremos, luego estandariza
    x = np.clip(x, -10.0, 10.0)
    z = (x - BASE_MEAN) / np.where(BASE_STD == 0.0, 1.0, BASE_STD)
    return z

def logistic(z):  # sigmoide numéricamente estable
    z = np.clip(z, -30.0, 30.0)
    return float(1.0 / (1.0 + np.exp(-z)))

@app.post("/baseline/infer", response_model=BaselineResp)
def baseline_infer(req: BaselineReq):
    x = np.array(req.features, dtype=np.float64)
    if x.size < 16:
        x = np.pad(x, (0, 16 - x.size))
    else:
        x = x[:16]
    zvec = safe_scale(x)
    z = float(zvec @ W + B)
    p = logistic(z)
    return {
        "prob": p,
        "z": z,
        "used_mean": BASE_MEAN.tolist(),
        "used_std": BASE_STD.tolist(),
        "model": "logistic-v0.1"
    }

@app.get("/selftest")
def selftest():
    # Caso fijo estilo "Predicting a New Result" para health-check
    demo = [30.0, 87000.0] + [0.0]*14
    r = baseline_infer(BaselineReq(features=demo))
    return {"ok": True, "expected_shape": 1, "prob": r["prob"], "model": r["model"]}

@app.get("/analytics")
def analytics():
    # números mockeados pero estables
    return {
        "quantumNeurons": 32,
        "totalValidations": 1250,
        "accuracy": 98.7,
        "zkProofs": 156,
        "circuitDepth": 2,
        "classicalLayers": 3,
        "updatedAt": int(time.time()*1000)
    }