# 3단계 탐색 화면 설계

2026-10-04. 로드맵 3단계(탐색 화면, FE). 2단계 STAC API(`/api/stac/search`)를 쓴다.

## 목표

로드맵 3단계 필수 전부: 지도 + 필터 패널 + 결과 목록, 샘플 AOI 선택 시 이동·표시, footprint 표시와 목록↔지도 강조·스크롤, 항목 정보(썸네일, 위성, KST 촬영 시각, 운량, 커버리지), 조건의 URL 보존, 로딩·결과 없음·에러 상태, 무한 스크롤.

안 하는 것(심화): 썸네일 겹쳐 보기, 대량 footprint 성능, 모바일 전용 레이아웃(기존 반응형 그리드는 유지).

## 결정 사항

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 필터 | AOI, 기간, 센서, 최대 운량, 위성, 최대 GSD, 정렬 3종 | API가 지원하는 조건 전부. GSD는 지금 데이터가 전부 10m라 효과 없음 |
| AOI 없음 | 공간 조건 없이 전체 검색. 커버리지 표시 없음, 커버리지 정렬 비활성 | 첫 화면에도 결과가 보임 |
| 샘플 AOI | 서버 컴포넌트가 `data/aois.geojson`을 fs로 읽어 props로 | API 추가 없음. 저장소 파일이라 검증 생략 |
| URL 상태 | nuqs: `aoi`, `from`, `to`, `sensors`, `cloud`, `platforms`, `gsd`, `sort` | 새로고침·공유 시 같은 결과 |
| 지도·선택 상태 | zustand(hover id, 선택 id + 출처). viewport는 URL 밖 | URL 상태와 지도 상태 분리 |
| 서버 상태 | `useInfiniteQuery`, `POST /api/stac/search`, 다음 페이지는 `links[rel=next].body.token` | 2단계 스펙: FE는 `next.href`를 따라가지 않음(3001 origin) |
| 위성 조건 | 선택 있으면 다른 조건과 AND. 옵션은 `/api/stac/collections`의 `summaries.platform`, 켠 센서 것만 | STAC 의미 그대로 |
| 테스트 | 순수 변환 함수를 `node --test`(Node 22 타입 스트리핑) | 새 의존성 없음 |

## 조건 → STAC 본문 (`stac-search.ts`, 순수 함수)

- 센서: EO → `sentinel-2-l2a`, SAR → `sentinel-1-grd`. 둘 다 끄면 `null`(검색 안 함, 안내 표시).
- 기간(KST 날짜): `from` → `YYYY-MM-DDT00:00:00+09:00`, `to` → `YYYY-MM-DDT23:59:59.999+09:00`. 빈 쪽은 `..`, 둘 다 비면 생략. `from > to`면 `null` + 인라인 오류.
- 운량 `cloud` < 100일 때: EO+SAR → `or(collection = 'sentinel-1-grd', eo:cloud_cover <= X)`, EO만 → `eo:cloud_cover <= X`, SAR만 → 생략.
- 위성: 비어 있지 않으면 `or(platform = ...)`(하나면 `=` 하나).
- GSD: 있으면 `gsd <= X`.
- 조건이 여럿이면 `and`, 하나면 그대로, 없으면 `filter` 생략.
- 정렬: `latest` → `properties.datetime desc`, `coverage` → `properties.aoi:coverage_pct desc`(AOI 없으면 `latest`로), `cloud` → `properties.eo:cloud_cover asc`.
- `intersects`: AOI geometry. `limit: 20`.

## 화면

- 지도: GeoJSON source `scenes`(`promoteId: "id"`, 불러온 페이지 전부) + fill/line 레이어, hover·selected는 `feature-state`. AOI는 source `aoi` + line/fill. AOI 선택 시 `fitBounds`.
- 테마 전환 `setStyle`은 커스텀 레이어를 지운다. `style.load`마다 source와 레이어를 다시 넣는다.
- 목록 hover/클릭 → 지도 강조. 지도 클릭 → 선택 + 목록 `scrollIntoView`. 지도 hover → 강조 + 커서.
- 항목: 썸네일(`assets.thumbnail.href`가 https일 때만, 아니면 placeholder), 위성, KST 촬영 시각(`Intl.DateTimeFormat`, `Asia/Seoul`), 운량(EO), 커버리지 km²·%. 상단에 `numberMatched`.
- 무한 스크롤: 목록 끝 sentinel + IntersectionObserver.
- 상태: 로딩 스켈레톤, 결과 없음, 에러(Problem Details `detail` + 다시 시도), 센서 없음, 기간 역전.

## 그 외

- `gen:api`로 `schema.d.ts` 재생성. STAC 응답은 Swagger에 타입이 없어 FE에 최소 타입을 둔다.
- `POST /api/stac/search`가 201을 준다(STAC은 200). `@HttpCode(200)`.
- 문서: decisions.md에 3단계 가정, README 체크박스(1, 2, 3).
