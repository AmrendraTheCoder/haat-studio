"""
Inputs exactly as FASHN's pipeline builds them, for both training and inference.

`preprocess` is pipeline.TryOnPipeline.__call__ (fashn-vton 1.5.0, commit
7c0f10a) up to the sampler, line for line, plus the training-only target. Keeping
one copy means a fine-tuned model is trained on the same inputs it will see.

What the model receives (all 864 × 576, padded, values in [−1, 1]):
  ca            the person — whole photo in segmentation-free mode, or with the
                old garment region greyed out ("clothing-agnostic") in masked mode
  person_pose   DWPose skeleton of the person, drawn in grey on black
  garment       the garment photo (a worn garment is cut out by the human parser;
                a flat-lay is used as is)
  garment_pose  skeleton of whoever wears the garment (blank for a flat-lay)
  category      1 tops, 2 bottoms, 3 one-pieces (0 is reserved for "no condition")
"""

import json
import os
from dataclasses import dataclass
from typing import Dict, Optional

import cv2
import numpy as np
import torch
from fashn_human_parser import CATEGORY_TO_BODY_COVERAGE
from fashn_vton.dwpose import draw_pose
from fashn_vton.preprocessing import (
    BODY_COVERAGE_TO_FASHN_LABELS,
    FASHN_LABELS_TO_IDS,
    AspectPreserveResize,
    ResizePad,
    create_clothing_agnostic_image,
    create_garment_image,
)
from fashn_vton.utils import get_dummy_dw_keypoints
from PIL import Image

# name → (model label, which garment class the human parser should look for)
CATEGORIES: Dict[str, tuple] = {"tops": (1, "tops"), "bottoms": (2, "bottoms"), "one-pieces": (3, "one-pieces")}


def add_category(name: str, label: int, parser_class: str = "one-pieces"):
    """Register a new garment type (see lora.extend_categories), e.g. add_category("saree", 4)."""
    CATEGORIES[name] = (label, parser_class)


@dataclass
class Prepared:
    arrays: Dict[str, np.ndarray]  # uint8, HxWxC or HxW
    category: int
    padding: tuple  # (left, top, right, bottom) of the person image, to crop the output


def preprocess(
    pipe,
    person: Image.Image,
    garment: Image.Image,
    category: str,
    photo_type: str = "flat-lay",
    segmentation_free: bool = True,
    target: Optional[Image.Image] = None,
) -> Prepared:
    """
    `pipe` is a loaded fashn_vton.TryOnPipeline (we use its pose and parser models).
    `target`, for training: the photo the model should produce. For a plain pair
    it is the person photo itself (use segmentation_free=False, or the model just
    learns to copy); for a triplet it is the real photo and `person` the same
    person wearing something else.
    """
    label, parser_class = CATEGORIES[category]
    h, w = pipe.tryon_model.input_shape
    pre = AspectPreserveResize(target_size=(max(h, w), max(h, w)), mode="fit", backend="pil")
    # A new ResizePad per call: the pipeline's own instance remembers the last padding.
    rp = ResizePad((w, h), backend="opencv")

    person = pre(person.convert("RGB"), allow_upsampling=False)
    garment = pre(garment.convert("RGB"), allow_upsampling=False)
    p = np.array(person)
    g = np.array(garment)

    p_pose = pipe.pose_model(p[..., ::-1])  # DWPose expects BGR
    g_pose = get_dummy_dw_keypoints() if photo_type == "flat-lay" else pipe.pose_model(g[..., ::-1])
    p_pose_img = draw_pose(p_pose, p.shape[0], p.shape[1], grayscale=True)
    g_pose_img = draw_pose(g_pose, g.shape[0], g.shape[1], grayscale=True)

    p_seg = pipe.hp_model.predict(p)
    g_seg = pipe.hp_model.predict(g)
    coverage = CATEGORY_TO_BODY_COVERAGE.get(parser_class)
    labels = [FASHN_LABELS_TO_IDS[x] for x in BODY_COVERAGE_TO_FASHN_LABELS.get(coverage)]

    ca = create_clothing_agnostic_image(
        img_np=p.copy(),
        seg_pred=p_seg.copy(),
        labels_to_segment_indices=labels.copy(),
        body_coverage=coverage,
        disable_masking=segmentation_free,
        logger=pipe.logger,
    )
    g_img = create_garment_image(img_np=g.copy(), seg_pred=g_seg, labels_to_segment_indices=labels.copy(), disable_masking=photo_type == "flat-lay")

    arrays = {"ca": rp(ca, mem_padding=True)}
    padding = rp.pad_fn.padding_mem
    arrays["garment"] = rp(g_img)
    arrays["person_pose"] = rp(p_pose_img, interpolation=cv2.INTER_NEAREST_EXACT)
    arrays["garment_pose"] = rp(g_pose_img, interpolation=cv2.INTER_NEAREST_EXACT)

    if target is not None:
        t = np.array(target.convert("RGB").resize(person.size, Image.LANCZOS))
        t_seg = pipe.hp_model.predict(t)
        arrays["target"] = rp(t)
        garment_mask = np.isin(t_seg, labels).astype(np.uint8) * 255
        arrays["garment_mask"] = rp(garment_mask, interpolation=cv2.INTER_NEAREST_EXACT)
        # Padding pixels carry no information: weight 0 in the loss.
        arrays["weight"] = rp(np.full(t.shape[:2], 255, np.uint8), interpolation=cv2.INTER_NEAREST_EXACT)

    return Prepared(arrays=arrays, category=label, padding=padding)


def to_tensors(prep: Prepared, device="cpu", dtype=torch.float32) -> Dict[str, torch.Tensor]:
    """uint8 arrays → batched tensors: images and poses in [−1, 1], masks in {0, 1}."""
    out = {}
    for k, a in prep.arrays.items():
        x = torch.from_numpy(np.ascontiguousarray(a))
        x = x.permute(2, 0, 1) if x.ndim == 3 else x.unsqueeze(0)
        x = x.float()
        x = x / 255.0 if k in ("garment_mask", "weight") else x / 127.5 - 1.0
        out[k] = x.unsqueeze(0).to(device=device, dtype=dtype)
    out["category"] = torch.tensor([prep.category], device=device)
    return out


def save_prepared(prep: Prepared, path: str, meta: dict):
    torch.save({"arrays": {k: torch.from_numpy(np.ascontiguousarray(v)) for k, v in prep.arrays.items()}, "category": prep.category, "padding": prep.padding, "meta": meta}, path)


def load_prepared(path: str) -> Prepared:
    d = torch.load(path, weights_only=False)
    return Prepared(arrays={k: v.numpy() for k, v in d["arrays"].items()}, category=d["category"], padding=tuple(d["padding"]))


class PreparedDataset(torch.utils.data.Dataset):
    """
    A folder of .pt files from scripts/prepare_data.py.

    No horizontal-flip augmentation: the grey pose drawing gives every limb its
    own grey level (fashn_vton/dwpose/utils.py draw_bodypose_gray), so a mirror
    would swap left and right; and a mirrored print or logo is a wrong product.
    """

    def __init__(self, folder: str, split: str):
        index = json.load(open(os.path.join(folder, "index.json")))
        self.files = [os.path.join(folder, e["file"]) for e in index if e["split"] == split]
        if not self.files:
            raise ValueError(f"No {split!r} samples in {folder}")

    def __len__(self):
        return len(self.files)

    def __getitem__(self, i):
        t = to_tensors(load_prepared(self.files[i]))
        return {k: v[0] for k, v in t.items()}


def crop_output(img: Image.Image, padding: tuple) -> Image.Image:
    left, top, right, bottom = padding
    return img.crop((left, top, img.width - right, img.height - bottom))
