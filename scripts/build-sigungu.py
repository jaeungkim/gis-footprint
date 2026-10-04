"""Builds data/admin/sigungu.geojson by dissolving 행정동 boundaries into 시군구 and simplifying them.

Source: vuski/admdongkor ver20260701 (CC BY 4.0, based on 통계청 SGIS boundaries, KOGL Type 1).
https://github.com/vuski/admdongkor

    curl -L -o /tmp/hjd.geojson https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
    .venv/bin/pip install shapely
    .venv/bin/python scripts/build-sigungu.py /tmp/hjd.geojson
"""

import json
import os
import re
import sys
from collections import defaultdict

from shapely import set_precision
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

TOLERANCE = 0.0005  # degrees, roughly 50 m. Plenty for picking an AOI, small enough to ship in the repo.

src = json.load(open(sys.argv[1]))
groups = defaultdict(list)
names = {}
for f in src["features"]:
    p = f["properties"]
    groups[p["sgg"]].append(shape(f["geometry"]))
    # 일반구 comes glued to its city ("수원시장안구"); split it so search by "장안구" works.
    names[p["sgg"]] = (p["sidonm"], re.sub(r"^(.+?시)(.+구)$", r"\1 \2", p["sggnm"]))

features = []
for code in sorted(groups):
    sido, sigungu = names[code]
    geom = unary_union(groups[code]).simplify(TOLERANCE, preserve_topology=True)
    geom = set_precision(geom, 1e-6)
    features.append({
        "type": "Feature",
        "properties": {"code": code, "sido": sido, "sigungu": sigungu, "name": f"{sido} {sigungu}"},
        "geometry": mapping(geom),
    })

os.makedirs("data/admin", exist_ok=True)
with open("data/admin/sigungu.geojson", "w") as out:
    json.dump({
        "type": "FeatureCollection",
        "attribution": "통계청 SGIS 행정구역 경계(공공누리 제1유형), vuski/admdongkor ver20260701 (CC BY 4.0) 가공",
        "features": features,
    }, out, ensure_ascii=False)
    out.write("\n")
print(f"data/admin/sigungu.geojson: {len(features)} 시군구, {os.path.getsize('data/admin/sigungu.geojson') // 1024} KB")
