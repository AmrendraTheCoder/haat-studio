# ml/ — tuning and fine-tuning FASHN VTON 1.5

The try-on model behind Haat Studio, opened up: run it locally, tune its sampler, and
fine-tune it with LoRA on our own garments. The full write-up, with how the model works,
where it fails and the plan, is [docs/model-report.md](../docs/model-report.md).

FASHN publishes inference code only (`fashn-vton` 1.5.0, commit `7c0f10a`). Everything
for training here is ours, reconstructed from that code and checked by tests.

```
haat_ft/
  data.py      FASHN's preprocessing, line for line, + training targets; PreparedDataset
  flow.py      rectified-flow loss (v = image − noise), condition dropout, checkpointing
  lora.py      LoRA layers: inject, save/load, merge, add a garment category (e.g. saree)
  train.py     training loop: AdamW, warm-up + cosine, grad accumulation, val loss, best adapter
  infer.py     generate() with all sampler knobs (incl. mu and skip-CFG the Space hides), + LoRA
  metrics.py   PSNR, SSIM, garment-pixel L1
scripts/
  download_weights.py   ~2 GB of weights
  prepare_data.py       photos + CSV → training samples (paired, and synthetic triplets)
  train_lora.py         fine-tune
  evaluate.py           base vs LoRA on held-out photos: numbers + side-by-side images
  sample.py             one try-on with any settings
  sweep.py              grid of sampler settings → contact sheet + timings
  check_real_model.py   checks on the real weights (equivalence, Space match, loss, a training step)
tests/test_finetune.py  12 fast tests on a tiny model (no weights, no GPU)
```

## Setup

```bash
cd ml
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python scripts/download_weights.py --weights-dir weights
.venv/bin/python -m pytest -q tests
```

On a Mac the scripts use the Apple GPU (MPS) automatically; on Linux, CUDA. `weights/`,
`runs/`, `data/` and `.venv/` are gitignored.

## Fine-tuning, end to end

1. **Collect photos** (the hard part): for each garment, one photo of a person wearing it
   and one of the garment alone. Write `data/pairs.csv` (format in `scripts/prepare_data.py`).
   Hold out ~15% as `val`, by garment, never by photo.
2. **Prepare:** `python scripts/prepare_data.py --csv data/pairs.csv --out data/prepared [--triplets]`
3. **Train** (CUDA GPU, 16 GB+):
   `python scripts/train_lora.py --data data/prepared --out runs/indian-v1 --steps 2000`
4. **Evaluate:** `python scripts/evaluate.py --data data/prepared --lora runs/indian-v1/lora-best.safetensors --out runs/indian-v1/eval`
5. **Use:** `python scripts/sample.py ... --lora runs/indian-v1/lora-best.safetensors`

For the app, the adapter would be served by our own Space (a copy of FASHN's Gradio app
plus `attach_lora`), then added as a new engine in `src/lib/tryon/` — one file.
