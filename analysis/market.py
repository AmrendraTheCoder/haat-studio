"""
Market intelligence from a retail catalogue: what sells, at what price, described how.

Input: the same catalogue build_pairs.py reads (<retail>/<source>/<category>/details/
products_detail.jsonl). Each listing has price, MRP, discount, star rating, number of
ratings, brand, title and attributes (colour, fabric, neck, sleeve, pattern, fit).

Output: one JSON file (results/market.json) that the report and the slides read.

How each number is made, and what it is NOT:
  demand            number of ratings is the demand signal. Units sold are not in the
                    data; an estimate = ratings ÷ rating-rate is given as a RANGE for an
                    assumed 1–3 % of buyers leaving a rating (an assumption, not a fact).
  cleaning          one listing per product family (colour/size variants share ratings),
                    prices outside 3×IQR flagged, attribute spellings normalised.
  attribute lift    share of demand ÷ share of listings: > 1 means buyers want more of it
                    than sellers offer.
  SEO keywords      title words and word pairs, weighted by log(1 + ratings) of the
                    listings that use them, brand names removed.
  engines           pricing, title (SEO), hashtags, positioning and location — run on a
                    worked example seller (example_seller.json). Every number they output
                    comes from this file's statistics, never from a language model.

    python analysis/market.py --retail <data/retail> --out analysis/results/market.json \
        [--categories tshirt,top] [--example analysis/example_seller.json] \
        [--app-out data/market/catalogue.json]

--app-out writes what the app needs and nothing else: per category the statistics above and a
fixed random sample of listings as numbers only (price, ratings, stars, discount, attribute
codes; no titles, brands, links or photos). The file is derived from scraped listings, so it
stays out of git (data/ is ignored); the app works without it and says so.
"""

import argparse
import collections
import json
import math
import os
import re
import random
import statistics
from datetime import date

ap = argparse.ArgumentParser()
ap.add_argument("--retail", required=True)
ap.add_argument("--categories", default="tshirt,top,saree,kurta-set")
ap.add_argument("--example", default=os.path.join(os.path.dirname(__file__), "example_seller.json"))
ap.add_argument("--out", required=True)
ap.add_argument("--app-out", help="also write the compact catalogue the app's market engines read (src/lib/market)")
ap.add_argument("--app-sample", type=int, default=6000, help="listings kept per category in --app-out")
a = ap.parse_args()

# ---------------------------------------------------------------- cleaning
FABRIC = [("art silk", "Art silk"), ("silk blend", "Silk blend"), ("pure silk", "Silk"), ("silk", "Silk"), ("chiffon", "Chiffon"), ("organza", "Organza"),
          ("chanderi", "Chanderi"), ("net", "Net"), ("tissue", "Tissue"), ("polyester", "Polyester"), ("polycotton", "Cotton blend"), ("blend", "Cotton blend"), ("rayon", "Rayon"), ("viscose", "Rayon"),
          ("linen", "Linen"), ("crepe", "Crepe"), ("satin", "Satin"), ("georgette", "Georgette"), ("lycra", "Lycra/stretch"), ("spandex", "Lycra/stretch"),
          ("cotton", "Cotton")]
COLOURS = ["black", "white", "red", "blue", "navy", "grey", "green", "pink", "yellow", "beige", "brown", "maroon", "purple", "orange", "olive", "cream", "lavender", "multicolour"]
STOP = set("a an and for the of with in on to by men men's mens women women's womens tshirt t-shirt t shirt tshirts top tops pack size sizes plus available fit regular | - & combo set saree sarees kurta kurtas sets".split())


def norm_fabric(v):
    v = (v or "").lower()
    if "cotton" in v and ("poly" in v or "%" in v and "polyester" in v):
        return "Cotton blend"
    return next((name for key, name in FABRIC if key in v), "Other") if v else None


def norm_colour(v):
    v = (v or "").lower()
    if not v:
        return None
    if "," in v or "multi" in v or " and " in v:
        return "Multicolour"
    return next((c.title() for c in COLOURS if c in v), "Other")


def norm_simple(v, mapping):
    v = (v or "").lower()
    if not v:
        return None
    for key, name in mapping:
        if key in v:
            return name
    return "Other"


NECK = [("v-neck", "V-neck"), ("v neck", "V-neck"), ("round", "Round/crew"), ("crew", "Round/crew"), ("collar", "Collared/polo"), ("polo", "Collared/polo"),
        ("turtle", "Turtle/high"), ("mandarin", "Mandarin"), ("square", "Square"), ("boat", "Boat"), ("henley", "Henley")]
SLEEVE = [("sleeveless", "Sleeveless"), ("3/4", "3/4 sleeve"), ("three", "3/4 sleeve"), ("long", "Long sleeve"), ("full", "Long sleeve"), ("half", "Short/half"),
          ("short", "Short/half"), ("cap", "Short/half"), ("raglan", "Raglan"), ("puff", "Puff")]
PATTERN = [("zari", "Zari/woven"), ("woven", "Zari/woven"), ("bandhani", "Bandhani"), ("ethnic motif", "Ethnic motifs"), ("embellish", "Embellished"), ("solid", "Solid"), ("plain", "Solid"), ("floral", "Floral"), ("stripe", "Striped"), ("check", "Checked"), ("plaid", "Checked"), ("embroid", "Embroidered"),
           ("graphic", "Graphic/print"), ("print", "Graphic/print"), ("letter", "Graphic/print"), ("cartoon", "Graphic/print"), ("geometric", "Geometric")]
FIT = [("oversize", "Oversized"), ("slim", "Slim"), ("loose", "Loose/relaxed"), ("relax", "Loose/relaxed"), ("regular", "Regular"), ("classic", "Regular"), ("fitted", "Slim")]


def attr(p, *keys):
    at = p.get("attributes") or {}
    for k in keys:
        if at.get(k):
            return at[k]
    return None


def clean(p):
    return {
        "id": p["product_id"], "family": p.get("parent_asin") or p["product_id"], "brand": (p.get("brand") or attr(p, "Brand Name") or "").strip().upper(),
        "title": p.get("title") or "", "price": p.get("price_current"), "mrp": p.get("price_original"), "discount": p.get("discount_pct"),
        "rating": p.get("rating_score"), "ratings": p.get("rating_count") or 0, "gender": p.get("gender") or DEFAULT_GENDER,
        "colour": norm_colour(attr(p, "Colour") or colour_in(p.get("title"))),
        "fabric": norm_fabric(attr(p, "Fabric Type", "Material type", "Material composition", "Saree Fabric", "Top Fabric", "Fabric")),
        "neck": norm_simple(attr(p, "Neck Style", "Neck style", "Neck"), NECK), "sleeve": norm_simple(attr(p, "Sleeve Type", "Sleeve type", "Sleeve Length"), SLEEVE),
        "pattern": norm_simple(attr(p, "Pattern", "Top Pattern", "Ornamentation", "Weave Pattern") or pattern_in(p.get("title")), PATTERN),
        "fit": norm_simple(attr(p, "Fit type", "Fitting type"), FIT),
        "border": first(attr(p, "Border")),
    }


DEFAULT_GENDER = "Women"


def first(v):
    return v.split(",")[0].strip().title() if isinstance(v, str) and v.strip() else None


def colour_in(title):
    t = (title or "").lower()
    return next((c for c in COLOURS if re.search(rf"\b{c}\b", t)), None)


def pattern_in(title):
    t = (title or "").lower()
    return next((k for k, _ in PATTERN if k in t), None)


def D(r):
    """Demand weight of a listing: log(1 + number of ratings). Raw counts are dominated by a
    handful of bestsellers (one listing can hold a third of all ratings), so shares and lifts
    use this damped weight; totals and the units estimate use the raw counts."""
    return math.log1p(r["ratings"])


def q(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def spearman(x, y):
    def rank(v):
        o = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[o[j + 1]] == v[o[i]]:
                j += 1
            for k in range(i, j + 1):
                r[o[k]] = (i + j) / 2
            i = j + 1
        return r
    if len(x) < 3:
        return None
    rx, ry = rank(x), rank(y)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((p - mx) * (s - my) for p, s in zip(rx, ry))
    den = math.sqrt(sum((p - mx) ** 2 for p in rx) * sum((s - my) ** 2 for s in ry))
    return round(num / den, 3) if den else None


# ---------------------------------------------------------------- analysis
SOURCES = {  # name: (file under --retail, url filter, label)
    "tshirt": ("amazon/tshirt/details/products_detail.jsonl", None, "Men's T-shirts (Amazon.in)"),
    "top": ("amazon/top/details/products_detail.jsonl", None, "Women's tops (Amazon.in)"),
    "saree": ("sarees/details/products_detail_V2.jsonl", "/sarees/", "Sarees (Myntra)"),
    "kurta-set": ("sarees/details/products_detail_V2.jsonl", "/kurta-sets/", "Kurta sets (Myntra)"),
}
out = {"source": f"retail catalogue at {a.retail}", "generated": date.today().isoformat(),
       "assumptions": {"rating_rate_low": 0.01, "rating_rate_high": 0.03, "outlier_rule": "price outside Q1-3*IQR .. Q3+3*IQR",
                       "demand_signal": "number of ratings (units sold are not in the data)",
                       "demand_weight": "log(1 + ratings) for shares and lifts; raw counts for totals"}, "categories": {}}
catalogues = {}
for cat in a.categories.split(","):
    rel, url_filter, label = SOURCES[cat]
    path = os.path.join(a.retail, rel)
    if not os.path.exists(path):
        continue
    raw = [p for p in (json.loads(l) for l in open(path) if l.strip()) if not url_filter or url_filter in p.get("url", "")]
    raw = [p for p in raw if not p.get("error")]
    rows = [clean(p) for p in raw]
    fams = {}
    for r in rows:  # one listing per family: the one with the most ratings
        if r["family"] not in fams or r["ratings"] > fams[r["family"]]["ratings"]:
            fams[r["family"]] = r
    items = [r for r in fams.values() if r["price"]]
    prices = [r["price"] for r in items]
    q1, q3 = q(prices, 0.25), q(prices, 0.75)
    lo, hi = q1 - 3 * (q3 - q1), q3 + 3 * (q3 - q1)
    outliers = [r for r in items if not lo <= r["price"] <= hi]
    items = [r for r in items if lo <= r["price"] <= hi]
    catalogues[cat] = items
    rated = [r for r in items if r["ratings"] > 0 and r["rating"]]
    total_ratings = sum(r["ratings"] for r in items)
    prices = [r["price"] for r in items]
    t1, t2 = q(prices, 1 / 3), q(prices, 2 / 3)

    def tier(p):
        return "value" if p < t1 else ("premium" if p > t2 else "mid")

    tiers = {}
    for name in ("value", "mid", "premium"):
        sel = [r for r in items if tier(r["price"]) == name]
        rr = [r for r in sel if r["rating"]]
        tiers[name] = {"listings": len(sel), "listing_share": round(len(sel) / len(items), 3),
                       "demand_share": round(sum(D(r) for r in sel) / max(1e-9, sum(D(r) for r in items)), 3),
                       "raw_rating_share": round(sum(r["ratings"] for r in sel) / max(1, total_ratings), 3),
                       "price_range": [round(min(r["price"] for r in sel)), round(max(r["price"] for r in sel))] if sel else None,
                       "mean_rating": round(statistics.mean(r["rating"] for r in rr), 2) if rr else None}

    attrs = {}
    for key in ("colour", "fabric", "neck", "sleeve", "pattern", "fit", "border"):
        have = [r for r in items if r[key]]
        dem = sum(D(r) for r in have) or 1
        groups = collections.defaultdict(list)
        for r in have:
            groups[r[key]].append(r)
        rowsA = []
        for v, g in groups.items():
            ls, ds = len(g) / len(have), sum(D(r) for r in g) / dem
            rowsA.append({"value": v, "listings": len(g), "listing_share": round(ls, 3), "demand_share": round(ds, 3),
                          "lift": round(ds / ls, 2) if ls else None, "median_price": round(q([r["price"] for r in g], 0.5))})
        attrs[key] = sorted([x for x in rowsA if x["listings"] >= 3], key=lambda x: -x["demand_share"])[:8]

    brands = collections.Counter()
    for r in items:
        brands[r["brand"]] += r["ratings"]
    shares = [v / max(1, total_ratings) for v in brands.values()]
    top10 = sum(sorted(shares, reverse=True)[:10])

    # SEO: words and word pairs in titles, weighted by demand; brand words removed
    brand_words = {w for b in brands for w in re.findall(r"[a-z]+", b.lower())}
    kw = collections.Counter()
    for r in items:
        words = [w for w in re.findall(r"[a-z0-9%]+", r["title"].lower()) if w not in STOP and w not in brand_words and len(w) > 2 and not w.isdigit()]
        weight = math.log1p(r["ratings"])
        for t in set(words) | {f"{x} {y}" for x, y in zip(words, words[1:])}:
            kw[t] += weight
    best = sorted(items, key=lambda r: -r["ratings"])[: max(5, len(items) // 4)]
    best_ids = {id(r) for r in best}
    rest = [r for r in items if id(r) not in best_ids]

    out["categories"][cat] = {
        "label": label, "listings_raw": len(raw), "families": len(fams), "after_cleaning": len(items), "price_outliers_removed": len(outliers),
        "with_ratings": len(rated), "gender": collections.Counter(r["gender"] for r in items).most_common(1)[0][0],
        "price": {k: round(q(prices, p)) for k, p in (("p10", 0.1), ("p25", 0.25), ("median", 0.5), ("p75", 0.75), ("p90", 0.9))},
        "mrp_median": round(q([r["mrp"] for r in items if r["mrp"]], 0.5) or 0),
        "discount": {"median": q([r["discount"] for r in items if r["discount"] is not None], 0.5),
                     "share_over_50": round(sum(1 for r in items if (r["discount"] or 0) >= 50) / len(items), 3)},
        "rating": {"mean": round(statistics.mean(r["rating"] for r in rated), 2) if rated else None,
                   "median_count": q([r["ratings"] for r in rated], 0.5), "total_ratings": total_ratings},
        "units_estimate_lifetime": [round(total_ratings / out["assumptions"]["rating_rate_high"]), round(total_ratings / out["assumptions"]["rating_rate_low"])],
        "demand_concentration": {"top10_brand_share": round(top10, 3), "top1_listing_share": round(max((r["ratings"] for r in items), default=0) / max(1, total_ratings), 3),
                                 "hhi": round(sum(s * s for s in shares) * 10000)},
        "correlations": {"price_vs_ratings": spearman([r["price"] for r in rated], [r["ratings"] for r in rated]),
                         "discount_vs_ratings": spearman([r["discount"] or 0 for r in rated], [r["ratings"] for r in rated]),
                         "price_vs_stars": spearman([r["price"] for r in rated], [r["rating"] for r in rated])},
        "tiers": tiers, "tier_cuts": [round(t1), round(t2)], "attributes": attrs,
        "seo_keywords": [{"term": t, "score": round(s, 1)} for t, s in kw.most_common(20)],
        "title_length": {"top_quartile_median": q([len(r["title"]) for r in best], 0.5), "rest_median": q([len(r["title"]) for r in rest], 0.5)},
        # a fixed random sample keeps the file small for the big catalogues
        "price_points": [[round(r["price"]), r["ratings"], r["rating"], round(r["discount"] or 0)] for r in random.Random(0).sample(items, min(len(items), 4000))],
    }
    print(cat, json.dumps({k: out["categories"][cat][k] for k in ("families", "after_cleaning", "with_ratings", "price", "tiers")}))

# ---------------------------------------------------------------- engines, on a worked example
MOMENTS = [("2026-11-27", "Black Friday", "blackfriday"), ("2026-12-25", "Christmas", "christmas"), ("2026-12-31", "New Year's Eve", "newyear"),
           ("2027-01-13", "Lohri", "lohri"), ("2027-01-14", "Makar Sankranti", "makarsankranti"), ("2027-01-26", "Republic Day sales", "republicdaysale"),
           ("2027-02-14", "Valentine's Day", "valentinesday"), ("2027-03-08", "Women's Day", "womensday")]

LABEL = {"Round/crew": "Round Neck", "Collared/polo": "Polo Collar", "V-neck": "V-Neck", "Turtle/high": "High Neck", "3/4 sleeve": "3/4 Sleeve",
         "Short/half": "Half Sleeve", "Long sleeve": "Full Sleeve", "Regular": "Regular Fit", "Slim": "Slim Fit", "Oversized": "Oversized Fit",
         "Loose/relaxed": "Relaxed Fit", "Graphic/print": "Printed"}
label = lambda v: LABEL.get(v, v)  # noqa: E731

if os.path.exists(a.example):
    ex = json.load(open(a.example))
    items = catalogues.get(ex["category"], [])
    c = out["categories"].get(ex["category"])
    if items and c:
        want = {k: ex["attributes"].get(k) for k in ("fabric", "neck", "sleeve", "pattern", "fit") if ex["attributes"].get(k)}
        def matches(r):
            return sum(r[k] == v for k, v in want.items())
        need = min(2, len(want))
        comp = [r for r in items if matches(r) >= need]
        if len(comp) < 15:
            comp = sorted(items, key=lambda r: -matches(r))[:30]
        cp = [r["price"] for r in comp]
        band = [round(q(cp, 0.4)), round(q(cp, 0.6))]
        cost = ex.get("cost")
        margin = lambda p: round(100 * (p - cost) / p) if cost else None  # noqa: E731
        t1, t2 = c["tier_cuts"]
        position = "value" if band[1] < t1 else ("premium" if band[0] > t2 else "mid")
        # pricing engine
        pricing = {"comparables": len(comp), "comparable_price": {"p25": round(q(cp, 0.25)), "median": round(q(cp, 0.5)), "p75": round(q(cp, 0.75))},
                   "recommended_band": band, "margin_at_band": [margin(band[0]), margin(band[1])] if cost else None,
                   "floor_for_30pct_margin": math.ceil(cost * 10 / 7) if cost else None,  # exact: cost / 0.7 has a float error
                   # informational only: we never suggest inflating an MRP to show a bigger discount
                   "category_median_discount": c["discount"]["median"],
                   "position": position,
                   "warning": ("thin" if cost and margin(band[0]) < 30 else None)}
        # SEO engine: title from demand-weighted keywords + the seller's real attributes
        terms = [k["term"] for k in c["seo_keywords"] if " " not in k["term"]]
        facts = [label(ex["attributes"].get(k)) for k in ("fabric", "pattern", "neck", "sleeve", "fit") if ex["attributes"].get(k)]
        title = f"{ex['shop']} {c['gender']}'s {' '.join(facts[:2])} {ex['product_noun'].title()} | {' | '.join(facts[2:])}".replace("  ", " ")
        # words that the best-selling COMPARABLE listings use and this title does not (use only if true)
        ck = collections.Counter()
        for r in comp:
            ws = [w for w in re.findall(r"[a-z]+", r["title"].lower()) if w not in STOP and len(w) > 3 and w not in r["brand"].lower()]
            for w in set(ws):
                ck[w] += D(r)
        missing = [w for w, _ in ck.most_common(25) if w not in title.lower()][:8]
        seo = {"title": title, "title_chars": len(title), "benchmark_title_chars": c["title_length"]["top_quartile_median"],
               "keywords_used": [t for t in terms[:12] if t in title.lower()], "keywords_to_consider": missing,
               "description_bullets": [f"{f}" for f in facts] + [f"Sizes {ex.get('sizes', 'S–XXL')}", "Easy returns / exchange (only if you offer it)"]}
        # location ("GEO") + calendar
        today = date.fromisoformat(ex.get("date", date.today().isoformat()))
        upcoming = [(d, n, tag) for d, n, tag in MOMENTS if 0 <= (date.fromisoformat(d) - today).days <= 75]
        city = re.sub(r"[^a-z]", "", ex["city"].lower())
        geo = {"city": ex["city"], "local_tags": [f"#{city}", f"#{city}fashion", f"#{city}shopping"],
               "moments": [{"date": d, "name": n, "days_away": (date.fromisoformat(d) - today).days} for d, n, _ in upcoming]}
        # hashtag engine: broad + niche (from demand keywords that describe THIS product) + local + occasion
        noun = re.sub(r"[^a-z]", "", ex["product_noun"].lower())
        niche = [f"#{re.sub(r"[^a-z0-9]", "", (f + noun).lower())}" for f in facts[:2]]
        # demand keywords become tags only as two-word phrases that match the seller's own facts
        kw_tags = [f"#{t.replace(' ', '')}" for t in c["seo_keywords"] and [k["term"] for k in c["seo_keywords"]] if " " in t and t in " ".join(facts).lower()]
        tags, seen = [], set()
        for t in [f"#{noun}", f"#{noun}s", "#shopsmall", "#smallbusinessindia", "#instashop"] + niche + kw_tags + geo["local_tags"] + [f"#{t}" for *_, t in upcoming[:2]]:
            if t not in seen and len(t) > 2:
                seen.add(t)
                tags.append(t)
        hashtags = {"tags": tags[:20], "rules": ["English letters only", "no fabric/size/stock claims the seller did not make", "max 30 (Instagram limit)"]}
        # positioning and demographics
        top_attr = {k: v[0]["value"] for k, v in c["attributes"].items() if v}
        lifts = sorted(((k, r["value"], r["lift"]) for k, v in c["attributes"].items() for r in v if r["lift"] and r["listings"] >= 5 and r["value"] != "Other"), key=lambda x: -x[2])[:5]
        positioning = {"audience": f"{c['gender']}, buying {ex['product_noun']}s on marketplaces and Instagram", "tier": position,
                       "statement": f"A {position}-tier {' '.join(facts[:2]).lower()} {ex['product_noun']} at ₹{band[0]}–₹{band[1]}, "
                                    f"where comparable listings sell at a median of ₹{pricing['comparable_price']['median']}.",
                       "most_demanded": top_attr, "under_supplied": [{"attribute": k, "value": v, "lift": l} for k, v, l in lifts]}
        hook_rules = ["Lead with the product and the occasion, not the brand", "Price in the caption (no 'DM for price')",
                      "One benefit the seller can prove (fabric, fit), never invented claims", "Call to action last"]
        out["example"] = {"input": ex, "pricing": pricing, "seo": seo, "hashtags": hashtags, "geo": geo, "positioning": positioning, "hook_rules": hook_rules}
        print("example", json.dumps(pricing))

if a.app_out:
    ATTRS = ("fabric", "neck", "sleeve", "pattern", "fit", "colour")
    app = {"version": 1, "generated": out["generated"], "assumptions": out["assumptions"], "attributes": list(ATTRS), "categories": {}}
    for cat, items in catalogues.items():
        c = out["categories"][cat]
        values = {k: sorted({r[k] for r in items if r[k]}, key=lambda v: -sum(1 for r in items if r[k] == v)) for k in ATTRS}
        values = {k: [v for v in vs if sum(1 for r in items if r[k] == v) >= 5][:24] for k, vs in values.items()}
        idx = {k: {v: i for i, v in enumerate(vs)} for k, vs in values.items()}
        sample = random.Random(0).sample(items, min(len(items), a.app_sample))
        app["categories"][cat] = {
            **{k: c[k] for k in ("label", "gender", "after_cleaning", "price", "mrp_median", "discount", "rating", "tiers", "tier_cuts", "demand_concentration", "correlations", "title_length")},
            "attributes": {k: v for k, v in c["attributes"].items() if k in ATTRS},
            "seo_keywords": c["seo_keywords"],
            "values": values,
            # [price, ratings, stars, discount, fabric, neck, sleeve, pattern, fit, colour]; -1 = unknown
            "items": [[round(r["price"]), r["ratings"], r["rating"] or 0, round(r["discount"] or 0)] + [idx[k].get(r[k], -1) for k in ATTRS] for r in sample],
        }
    os.makedirs(os.path.dirname(os.path.abspath(a.app_out)), exist_ok=True)
    json.dump(app, open(a.app_out, "w"), separators=(",", ":"), ensure_ascii=False)
    print("wrote", a.app_out, f"{os.path.getsize(a.app_out) / 1e6:.1f} MB")

os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
json.dump(out, open(a.out, "w"), indent=2, ensure_ascii=False)
print("wrote", a.out)
