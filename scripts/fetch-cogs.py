"""Cuts small sample COGs out of a few Sentinel-2 L2A scenes for the viewer (step 12) and order processing (step 8).

Reads straight from the public sentinel-cogs bucket over HTTPS (range requests, no AWS account, no cost).
Never point this at Sentinel-1 assets: that bucket is requester-pays.

    python3 -m venv .venv && .venv/bin/pip install rasterio
    .venv/bin/python scripts/fetch-cogs.py

Output: data/cogs/<item id>.tif, 4 bands uint16 in this order: red, green, blue, nir (B04, B03, B02, B08),
native UTM CRS, 10 m. True color = bands 1,2,3. NIR false color = bands 4,1,2.
"""

import json
import os

import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

# (site, lon/lat bbox, item ids). Two dates per site where a before/after comparison is interesting.
SAMPLES = [
    ("busan", (129.02, 35.07, 129.12, 35.13), ["S2C_52SED_20260722_0_L2A", "S2B_52SED_20260826_0_L2A"]),
    ("saemangeum", (126.50, 35.76, 126.62, 35.84), ["S2C_52SBE_20260715_0_L2A", "S2B_52SBE_20260908_0_L2A"]),
    ("pyeongtaek", (126.80, 36.94, 126.90, 37.00), ["S2B_52SCF_20260908_0_L2A"]),
    ("incheon_airport", (126.40, 37.43, 126.50, 37.49), ["S2B_52SBG_20260812_0_L2A"]),
]
BANDS = ["red", "green", "blue", "nir"]

items = {}
for path in ("data/catalog/items.json", "data/stac/items.json"):
    for f in json.load(open(path))["features"]:
        items[f["id"]] = f

os.makedirs("data/cogs", exist_ok=True)
env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", AWS_NO_SIGN_REQUEST="YES")
with env:
    for site, bbox, ids in SAMPLES:
        for item_id in ids:
            item = items[item_id]
            assert not item["assets"]["red"]["href"].startswith("s3://"), "expected https hrefs"
            out = f"data/cogs/{item_id}.tif"
            arrays = []
            for band in BANDS:
                with rasterio.open(item["assets"][band]["href"]) as src:
                    window = from_bounds(*transform_bounds("EPSG:4326", src.crs, *bbox), src.transform).round_offsets().round_lengths()
                    arrays.append(src.read(1, window=window))
                    profile = {
                        "driver": "COG",
                        "dtype": "uint16",
                        "count": len(BANDS),
                        "width": window.width,
                        "height": window.height,
                        "crs": src.crs,
                        "transform": src.window_transform(window),
                        "nodata": 0,
                        "compress": "deflate",
                        "predictor": 2,
                    }
            with rasterio.open(out, "w", **profile) as dst:
                for i, (band, arr) in enumerate(zip(BANDS, arrays), start=1):
                    dst.write(arr, i)
                    dst.set_band_description(i, band)
                dst.update_tags(site=site, item_id=item_id)
            print(f"{out}: {profile['width']}x{profile['height']} {os.path.getsize(out) // 1024} KB")
