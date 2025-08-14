# SuperCore (import)

This repository contains the SuperCore app imported from Replit and prepared for professional workflows.

## Getting Started
- Copy .env.example to .env and fill your values (do not commit .env).
- Install dependencies and run build according to your stack:
  - Node: 
pm ci then 
pm run build and 
pm start.
  - Python: python -m venv .venv then pip install -r requirements.txt.

## CI
GitHub Actions runs lint, tests and build automatically on pushes and PRs. See .github/workflows/ci.yml.

## Deployment
Add provider-specific workflow or platform config (Vercel/Render/Railway/etc.).
Secrets should be added in GitHub repository Settings > Secrets and variables > Actions.
