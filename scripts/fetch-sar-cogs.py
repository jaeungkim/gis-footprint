"""Sentinel-1 샘플 COG. Microsoft Planetary Computer의 sentinel-1-rtc(무료, 계정 없음)에서 잘라 온다.

AWS의 S1 원본은 requester-pays라 쓰지 않는다. RTC는 지형 보정까지 끝난 COG라서 S2 샘플처럼 바로 지도에 올릴 수 있다.

    .venv/bin/pip install rasterio certifi
    .venv/bin/python scripts/fetch-sar-cogs.py

출력: data/cogs/<카탈로그 Item id>.tif, 2밴드 float32 (vv, vh), gamma0 선형 값, UTM, 10 m.
"""

import json
import os
import ssl
import urllib.request

import certifi
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

PC = "https://planetarycomputer.microsoft.com/api"
SAMPLES = [
    ("busan", (129.02, 35.07, 129.12, 35.13), [
        "S1C_IW_GRDH_1SDV_20260727T212357_20260727T212418_008734_0114F4",
        "S1C_IW_GRDH_1SDV_20260808T212357_20260808T212419_008909_011AC7",
    ]),
    ("pyeongtaek", (126.80, 36.94, 126.90, 37.00), [
        "S1C_IW_GRDH_1SDV_20260813T213146_20260813T213211_008982_011D2F",
        "S1C_IW_GRDH_1SDV_20260825T213139_20260825T213204_009157_012300",
    ]),
]
BANDS = ["vv", "vh"]
ctx = ssl.create_default_context(cafile=certifi.where())


def get(url):
    return json.load(urllib.request.urlopen(url, timeout=60, context=ctx))


token = get(f"{PC}/sas/v1/token/sentinel-1-rtc")["token"]

os.makedirs("data/cogs", exist_ok=True)
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
    for site, bbox, ids in SAMPLES:
        for item_id in ids:
            item = get(f"{PC}/stac/v1/collections/sentinel-1-rtc/items/{item_id}_rtc")
            arrays = []
            for band in BANDS:
                with rasterio.open(f"{item['assets'][band]['href']}?{token}") as src:
                    bounds = transform_bounds("EPSG:4326", src.crs, *bbox)
                    window = from_bounds(*bounds, src.transform).round_offsets().round_lengths()
                    arrays.append(src.read(1, window=window))
                    profile = {
                        "driver": "COG",
                        "dtype": "float32",
                        "count": len(BANDS),
                        "width": window.width,
                        "height": window.height,
                        "crs": src.crs,
                        "transform": src.window_transform(window),
                        "nodata": 0,
                        "compress": "deflate",
                        "predictor": 3,
                    }
            out = f"data/cogs/{item_id}.tif"
            with rasterio.open(out, "w", **profile) as dst:
                for i, (band, arr) in enumerate(zip(BANDS, arrays), start=1):
                    dst.write(arr, i)
                    dst.set_band_description(i, band)
                dst.update_tags(site=site, item_id=item_id, source="planetary-computer sentinel-1-rtc")
            print(f"{out}: {profile['width']}x{profile['height']} {os.path.getsize(out) // 1024} KB")
