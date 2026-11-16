"""Download FASHN VTON 1.5 weights (~2 GB): try-on model, DWPose, human parser.

    python scripts/download_weights.py --weights-dir weights
"""

import argparse
import os

from huggingface_hub import hf_hub_download

ap = argparse.ArgumentParser()
ap.add_argument("--weights-dir", default="weights")
a = ap.parse_args()

print(hf_hub_download("fashn-ai/fashn-vton-1.5", "model.safetensors", local_dir=a.weights_dir))
for f in ("yolox_l.onnx", "dw-ll_ucoco_384.onnx"):
    print(hf_hub_download("fashn-ai/DWPose", f, local_dir=os.path.join(a.weights_dir, "dwpose")))
from fashn_human_parser import FashnHumanParser  # noqa: E402  downloads its weights to the HF cache on first use

FashnHumanParser(device="cpu")
print("human parser cached")
