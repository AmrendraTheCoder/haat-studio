#!/usr/bin/env bash
# Base vs LoRA, end to end: catalogue -> pairs -> training -> evaluation -> numbers in the report and slides.
#
#   bash ml/run_lora_pipeline.sh <retail-folder> [run-name] [steps]
#
# <retail-folder> holds amazon/<category>/details/products_detail.jsonl and amazon/images/
# (sarees: add saree:saree to CATEGORIES below and --new-category saree:4 is passed for you).
# Needs a CUDA GPU with >= 16 GB for the training and evaluation steps (Kaggle/Colab/college server).
# Every step writes its own output, so a step that already finished is skipped on a re-run.
set -euo pipefail

RETAIL="${1:?usage: run_lora_pipeline.sh <retail-folder> [run-name] [steps]}"
RUN="${2:-indian-v1}"
STEPS="${3:-2000}"
CATEGORIES="${CATEGORIES:-tshirt:tops,top:tops}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
PY="${PY:-.venv/bin/python}"
NEWCAT=""
[[ "$CATEGORIES" == *saree* ]] && NEWCAT="--new-category saree:4"

echo "== 1/6 pairs with pose guardrails"
[ -f data/pairs/qc.json ] || $PY scripts/build_pairs.py --retail "$RETAIL" --out data/pairs --categories "$CATEGORIES"

echo "== 2/6 FASHN preprocessing"
[ -d data/prepared ] || $PY scripts/prepare_data.py --csv data/pairs/pairs.csv --out data/prepared $NEWCAT

echo "== 3/6 LoRA training ($STEPS steps)"
[ -f "runs/$RUN/train_summary.json" ] || $PY scripts/train_lora.py --data data/prepared --out "runs/$RUN" --steps "$STEPS"

echo "== 4/6 base vs LoRA on held-out garments"
[ -f "runs/$RUN/eval/eval.csv" ] || $PY scripts/evaluate.py --data data/prepared --lora "runs/$RUN/lora-best.safetensors" --out "runs/$RUN/eval"

echo "== 5/6 statistics and compute cost"
$PY scripts/compare_lora.py --run "runs/$RUN" --qc data/pairs/qc.json --out ../docs/mini-project-report/results/lora_comparison.json

echo "== 6/6 market analysis, report and slides"
cd ..
ml/.venv/bin/python analysis/market.py --retail "$RETAIL" --out analysis/results/market.json
ml/.venv/bin/python docs/mini-project-report/build.py --tests
echo "Slides: NODE_PATH=node_modules:<pptxgenjs dir> node docs/mini-project-report/build-final-deck.cjs \$PWD ../Mini-Project-Presentation.pptx <pptx skill dir>"
