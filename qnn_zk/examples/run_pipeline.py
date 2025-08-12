# examples/run_pipeline.py
import os, subprocess, json, numpy as np, shutil, sys
from qkeras.layers import Dense, QuantumNeuronLayer
from qkeras.model import Model
from qflow.core import to_q

# 1) Modelo: Dense -> 32 'neuronas cuánticas'
in_features = 16
model = Model([ Dense(units=in_features), QuantumNeuronLayer(width=32, depth=2) ])
model.build((None, in_features))
model.compile()

# 2) Batch de ejemplo (8 transacciones)
np.random.seed(0)
X = np.random.randn(8, in_features).astype(np.float64) * 0.5
y_pred = model.predict(X)               # [B,32] en [0,1]

# 'cabeza' simple para score
head_W = np.random.randn(32, 1).astype(np.float64) * 0.2
head_b = np.array([0.0], dtype=np.float64)
z = y_pred @ head_W + head_b
score = 1/(1+np.exp(-z))

# Seleccionamos una tx
tx_idx = 0
x = X[tx_idx:tx_idx+1]
q_out = y_pred[tx_idx:tx_idx+1].mean(axis=1)  # escalar
score_scalar = float(score[tx_idx,0])

# Pesos 'agregados' a 1D
w_dense = model.layers[0].W
b_dense = model.layers[0].b
alpha = np.array([0.5], dtype=np.float64)
W_aggr = w_dense.mean(axis=1)  # [in_features]
w_fixed = to_q(W_aggr).tolist()
x_fixed = to_q(x[0]).tolist()
b_fixed = int(to_q(b_dense.mean()))
alpha_fixed = int(to_q(alpha[0]))
q_out_fixed = int(to_q(q_out[0]))

def sigmoid_poly_q16(xq):
    Q = 16; SCALE = 1<<Q
    c0 = int(round(0.5*SCALE))
    c1 = int(round(0.25*SCALE))
    c3 = int(round(-0.0208333333333*SCALE))
    term1 = (c1 * xq) // SCALE
    term3 = (c3 * (xq*xq % (1<<62) * xq % (1<<62))) // (SCALE*SCALE)
    return c0 + term1 + term3

SCALE = 1<<16
z_acc = 0
for wi, xi in zip(w_fixed, x_fixed):
    z_acc += (wi*xi)//SCALE
z_acc += b_fixed
z_acc += (alpha_fixed * q_out_fixed)//SCALE
score_pub_fixed = sigmoid_poly_q16(z_acc)

witness = {
    "x": x_fixed,
    "w": w_fixed,
    "b": b_fixed,
    "alpha": alpha_fixed,
    "q_out": q_out_fixed,
    "score_pub": score_pub_fixed
}
os.makedirs("artifacts", exist_ok=True)
with open("artifacts/witness.json","w") as f: json.dump(witness, f, indent=2)

print("Inferencia CPU:")
print(f"  q_out ≈ {q_out[0]:.6f}  | score ≈ {score_scalar:.6f}")
print("Guardado artifacts/witness.json")

# Verifica si el binario existe
exe = os.path.join("halo2_tx_validator","target","release","halo2_tx_validator")
if not os.path.exists(exe):
    print("\n[INFO] No encontré el binario de Halo2. Compílalo con:")
    print("  cd halo2_tx_validator && cargo build --release && cd ..")
    sys.exit(0)

def run(cmd):
    print(">>", " ".join(cmd))
    subprocess.check_call(cmd)

if not os.path.exists("artifacts/params.kzg"):
    run([exe, "gen-params", "--k", "17", "--out", "artifacts/params.kzg"])

run([exe, "prove",
     "--params", "artifacts/params.kzg",
     "--witness", "artifacts/witness.json",
     "--proof", "artifacts/proof.bin",
     "--public", "artifacts/public.json"])

run([exe, "verify",
     "--params", "artifacts/params.kzg",
     "--proof", "artifacts/proof.bin",
     "--public", "artifacts/public.json"])

print("¡Prueba generada y verificada en CPU!")
