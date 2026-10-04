"""Makes the clean Earth Search snapshot look like real-world data. Run after scripts/fetch-catalog.mjs.

    python3 docs/answers/inject-defects.py

Deterministic: picks Items by fixed positions, so re-running on a fresh fetch gives the same kinds of defects.
What each one is and how step 1 / step 6 should treat it: docs/answers/fixtures.md
"""

import copy
import json

CATALOG = "data/catalog/items.json"
INGEST = "data/stac/items.json"


def load(path):
    return json.load(open(path))


def save(path, fc):
    with open(path, "w") as f:
        json.dump(fc, f)
        f.write("\n")


def s2(features):
    return [f for f in features if f["collection"] == "sentinel-2-l2a"]


def s1(features):
    return [f for f in features if f["collection"] == "sentinel-1-grd"]


def ring(f):
    g = f["geometry"]
    return g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]


cat = load(CATALOG)
feats = cat["features"]
eo, sar = s2(feats), s1(feats)
log = []

# --- excluded at load (invalid) ---------------------------------------------------------------

f = eo[37]  # D1 open ring: last position != first
ring(f).pop()
log.append(("D1", f["id"], "exclude", "polygon ring not closed"))

f = eo[112]  # D2 lon/lat swapped
r = ring(f)
r[:] = [[lat, lon] for lon, lat in r]
log.append(("D2", f["id"], "exclude", "coordinates are [lat, lon]; latitude out of range"))

f = eo[205]  # D3 no datetime at all
f["properties"]["datetime"] = None
log.append(("D3", f["id"], "exclude", "datetime null without start/end_datetime"))

f = eo[298]  # D4 cloud cover out of range
f["properties"]["eo:cloud_cover"] = 135.2
log.append(("D4", f["id"], "exclude", "eo:cloud_cover > 100"))

f = eo[401]  # D5 self-intersecting (bow tie) ring
r = ring(f)
if len(r) >= 5:
    r[1], r[2] = r[2], r[1]
log.append(("D5", f["id"], "exclude", "self-intersecting ring"))

f = eo[502]  # D6 geometry missing
f["geometry"] = None
log.append(("D6", f["id"], "exclude", "geometry null; nothing to search on"))

f = sar[10]  # D7 SAR item with no polarization info
del f["properties"]["sar:polarizations"]
f["properties"]["sar:instrument_mode"] = ""
log.append(("D7", f["id"], "exclude or flag", "SAR item missing sar:polarizations; instrument_mode empty"))

# --- loaded, but must be normalized ------------------------------------------------------------

f = eo[60]  # N1 clockwise exterior ring (RFC 7946 says SHOULD be counterclockwise; parsers must not reject)
ring(f).reverse()
log.append(("N1", f["id"], "load", "exterior ring clockwise; keep, optionally re-orient"))

f = eo[150]  # N2 cloud cover as a string
f["properties"]["eo:cloud_cover"] = str(round(f["properties"]["eo:cloud_cover"], 2))
log.append(("N2", f["id"], "load", "eo:cloud_cover is a string; coerce to number"))

f = eo[250]  # N3 datetime without timezone
f["properties"]["datetime"] = f["properties"]["datetime"].replace("Z", "").split(".")[0]
log.append(("N3", f["id"], "decide", "datetime has no offset; STAC requires RFC 3339. Exclude, or assume UTC and record the assumption"))

f = eo[350]  # N4 no thumbnail
del f["assets"]["thumbnail"]
log.append(("N4", f["id"], "load", "thumbnail asset missing; UI needs a placeholder"))

f = eo[450]  # N5 bbox does not match geometry
f["bbox"] = [b + 0.5 for b in f["bbox"]]
log.append(("N5", f["id"], "load", "bbox shifted 0.5 deg from geometry; recompute bbox from geometry, never trust it for search"))

f = eo[550]  # N6 S2 item without eo:cloud_cover
del f["properties"]["eo:cloud_cover"]
log.append(("N6", f["id"], "decide", "EO item missing eo:cloud_cover; keep with null and exclude from max-cloud filters, or exclude"))

f = sar[20]  # N7 SAR item that carries eo:cloud_cover
f["properties"]["eo:cloud_cover"] = 0
log.append(("N7", f["id"], "load", "SAR item has eo:cloud_cover; ignore it, cloud filter must not apply to SAR"))

# --- duplicates ---------------------------------------------------------------------------------

orig = eo[600]  # U1 same id twice; second copy is the newer reprocessed one
dup = copy.deepcopy(orig)
dup["properties"]["updated"] = "2026-09-15T03:00:00.000Z"
dup["properties"]["eo:cloud_cover"] = round(min(100, orig["properties"]["eo:cloud_cover"] + 3.1), 4)
feats.insert(feats.index(orig) + 7, dup)
log.append(("U1", orig["id"], "dedupe", "id appears twice; keep the one with the later properties.updated"))

save(CATALOG, cat)

# --- ingest source (mock/stac-api, step 6) -------------------------------------------------------

ing = load(INGEST)
ifeats = ing["features"]

upd = copy.deepcopy(eo[700])  # I1 an Item already in the catalog comes back reprocessed
upd["properties"]["updated"] = "2026-09-20T10:00:00.000Z"
upd["properties"]["s2:processing_baseline"] = "05.12"
ifeats.insert(40, upd)
log.append(("I1", upd["id"], "upsert", "existing id with newer updated; ingest must update, not insert"))

f = s2(ifeats)[90]  # I2 invalid Item in the ingest feed
ring(f).pop()
log.append(("I2", f["id"], "exclude", "open ring in ingest feed; IngestRun counts it as excluded with reason"))

f = s2(ifeats)[200]  # I3 same Item served twice across pages
ifeats.insert(ifeats.index(f) + 150, copy.deepcopy(f))
log.append(("I3", f["id"], "dedupe", "same Item on two different pages; second must be a no-op"))

save(INGEST, ing)

with open("docs/answers/defects.tsv", "w") as out:
    out.write("code\tid\texpected\tnote\n")
    for row in log:
        out.write("\t".join(row) + "\n")
print(f"{len(log)} defects; catalog {len(feats)} entries, ingest {len(ifeats)} entries")
