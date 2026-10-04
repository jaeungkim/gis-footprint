# data

전부 한 번 받아서 커밋해 둔 스냅샷이다. 앱은 실행 중에 이걸 다시 받지 않는다.

| 경로 | 내용 | 출처 |
| --- | --- | --- |
| `catalog/items.json` | STAC ItemCollection, 2026년 7~8월(KST), Sentinel-2 L2A와 Sentinel-1 GRD 1천여 건 | Earth Search |
| `stac/items.json` | 같은 형식, 2026년 9월. mock STAC API만 내려준다(6단계 수집용) | Earth Search |
| `cogs/*.tif` | Sentinel-2 샘플 6장면을 사이트 크기로 자른 COG. 밴드 순서 red, green, blue, nir. UTM 52N, 10 m | Earth Search `sentinel-cogs` 공개 버킷 |
| `admin/sigungu.geojson` | 시군구 경계 256개, 50 m 정도로 단순화 | 통계청 SGIS, [vuski/admdongkor](https://github.com/vuski/admdongkor) ver20260701 |
| `aois.geojson` | 샘플 관심 영역 8개 | 직접 그림 |
| `seed/price-rules.json` | 가격 정책 seed | 직접 만듦 |

STAC Item은 받은 그대로고 용량 때문에 `-jp2` asset만 뺐다. 그래서 asset 링크(S3 https)는 살아 있다. 그렇다고 앱이 그 링크로 영상을 받아 오게 만들면 안 된다. 로컬에서만 돌리기로 했으니 영상은 `cogs/`에 있는 것만 쓴다. Sentinel-1 asset은 requester-pays 버킷이라 받으면 돈이 나간다.

샘플 영상이 있는 장면:

| 사이트 | Item |
| --- | --- |
| 부산 북항 | `S2C_52SED_20260722_0_L2A`, `S2B_52SED_20260826_0_L2A` |
| 새만금 | `S2C_52SBE_20260715_0_L2A`, `S2B_52SBE_20260908_0_L2A` (뒤쪽은 9월이라 수집 후에 카탈로그에 들어온다) |
| 평택당진항 | `S2B_52SCF_20260908_0_L2A` (9월) |
| 인천국제공항 | `S2B_52SBG_20260812_0_L2A` |

## 다시 만들기

```bash
node scripts/fetch-catalog.mjs
python3 -m venv .venv && .venv/bin/pip install rasterio shapely
.venv/bin/python scripts/fetch-cogs.py
curl -L -o /tmp/hjd.geojson https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
.venv/bin/python scripts/build-sigungu.py /tmp/hjd.geojson
```

## 출처 표시

- Sentinel 데이터: Contains modified Copernicus Sentinel data 2026. 메타데이터는 Element 84 Earth Search.
- 시군구 경계: 통계청 SGIS 행정구역 경계(공공누리 제1유형), vuski/admdongkor(CC BY 4.0)를 가공.
