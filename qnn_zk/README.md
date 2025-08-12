# QNN + Halo2 (CPU) — Replit Pack

Este paquete crea un prototipo **híbrido cuántico-clásico** con 32 “neuronas cuánticas” simuladas en CPU,
un mini framework estilo Keras (**QFlow/QKeras**) y un circuito **Halo2** (Rust) para probar en CPU.
Incluye un pipeline que hace inferencia en Python, genera el *witness* y llama al CLI de Rust para
probar y verificar.

## Estructura
```
qnn_zk/
├─ qflow/
├─ qkeras/
├─ examples/run_pipeline.py
├─ halo2_tx_validator/ (Rust, Halo2)
└─ README.md
```

## Uso rápido (en Replit o local)
1) **Python** (crear witness y ejecutar pipeline completo):
   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install numpy
   python examples/run_pipeline.py
   ```

2) **Rust/Halo2** (compilar binario, puede requerir habilitar Nix en Replit o usar repl de Rust):
   ```bash
   cd halo2_tx_validator
   cargo build --release
   # volver a la raíz y ejecutar el pipeline:
   cd .. && python examples/run_pipeline.py
   ```

> Nota: El CLI Rust usa atajos para simplificar los “public inputs” y centrarse en la demo CPU.
  Si quieres commits públicos completos (Poseidon reales como instancias), pídelo y te paso
  la versión extendida.

