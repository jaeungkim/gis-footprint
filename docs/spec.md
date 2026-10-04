# 스펙

## 역할

- `CUSTOMER`: 영상 탐색, 주문과 다운로드, 촬영 요청, 관심 영역 알림, AI 분석
- `OPERATOR`: 백오피스에서 주문, 상품, 촬영 요청 처리. 수집 실행과 대시보드
- `ADMIN`: OPERATOR 권한에 더해 사용자와 조직 관리, 가격 정책, 감사 로그

고객은 농작물 작황을 보는 농업 회사, 항만 선박을 보는 해운사, 공사 진척을 보는 건설사, 재해 피해를 산정하는 보험사 같은 곳을 생각하고 있다.

## 도메인 모델

| 엔티티 | 설명 |
| --- | --- |
| User | 계정. 역할과 상태(ACTIVE, SUSPENDED, DELETED) |
| Organization | 기업 고객. 멤버와 계약 단가 |
| Invitation | 일회용 초대 토큰 |
| Scene | 카탈로그 상품이고 STAC Item 하나에 대응한다. 센서, 촬영 시각, 운량, footprint, assets, 공개 여부 |
| IngestRun | 수집 한 번의 기록. 범위, 건수, 제외 사유 |
| Aoi | 사용자가 저장한 관심 영역 |
| CartItem | 장바구니 항목. Scene과 잘라낼 AOI |
| PriceRule | 센서와 해상도 등급별 km² 단가, 최소 면적, 유효 기간 |
| Order, OrderItem | 주문과 영상별 처리 단위. 주문할 때 가격을 스냅샷으로 남긴다 |
| TaskingRequest | 앞으로 찍어 달라는 촬영 요청 |
| SavedSearch | 저장한 검색 조건과 알림 구독 |
| Notification | 사용자 알림 |
| AnalysisJob | AI 분석 작업과 결과 |
| AuditLog | 운영자와 관리자가 바꾼 이력 |

## 상태 전이

```
Order           SUBMITTED -> APPROVED -> PROCESSING -> DELIVERED   (APPROVED는 대형 주문만)
                SUBMITTED -> REJECTED | CANCELED
                PROCESSING -> FAILED -> PROCESSING                 (재처리)

TaskingRequest  REQUESTED -> IN_REVIEW -> ACCEPTED -> SCHEDULED -> ACQUIRED
                IN_REVIEW -> REJECTED

AnalysisJob     QUEUED -> RUNNING -> SUCCEEDED | FAILED

User            ACTIVE <-> SUSPENDED
                ACTIVE | SUSPENDED -> DELETED                      (소프트 삭제)
```

## API 규칙

- 경로는 전부 `/api` 아래에 있다. 관리자 API는 `/api/admin/*`.
- 에러는 RFC 9457 Problem Details(`application/problem+json`)로 내려준다. 필드 오류는 `errors` 배열에 담는다.
- 목록은 커서 페이지네이션(`limit`, `cursor`, 응답의 `nextCursor`)을 쓴다. 백오피스 테이블만 페이지 번호(`page`, `pageSize`, `total`)를 쓴다.
- 시각은 UTC ISO 8601로 저장하고 응답한다. 사용자가 입력한 날짜는 한국 시간으로 해석한다.
- 두 번 만들어지면 안 되는 요청(`POST /api/orders`)은 `Idempotency-Key` 헤더를 받는다.
- 공간 데이터는 GeoJSON(RFC 7946, EPSG:4326)으로 주고받는다.
- web의 API 타입은 OpenAPI 명세에서 생성한다(`pnpm --filter @footprint/web gen:api`).

## 데이터

| 경로 | 내용 | 단계 |
| --- | --- | --- |
| `data/catalog/items.json` | 한반도 STAC 스냅샷. Sentinel-2 L2A(광학)와 Sentinel-1 GRD(SAR), 2026년 7~8월 | 1 |
| `data/stac/items.json` | 9월분. mock STAC API만 내려주고 수집하면 카탈로그에 들어온다 | 6 |
| `data/aois.geojson` | 샘플 관심 영역 | 2 |
| `data/seed/price-rules.json` | 초기 가격 정책 | 7 |
| `data/cogs/` | Sentinel-2 샘플 영상(COG) 6장면. 밴드 순서 red, green, blue, nir | 8, 12 |
| `data/admin/sigungu.geojson` | 시군구 경계 | 11 |
| `mock/stac-api` | STAC API 흉내. 수집 작업이 여기서 Item을 가져간다 | 6 |
| `mock/processing-system` | 영상 처리 시스템 흉내 | 8 |
| `mock/ai-model` | AI 분석 모델 흉내 | 15 |

출처와 다시 만드는 법은 [data/README.md](../data/README.md)에 있다. 메타데이터와 영상은 [Earth Search](https://earth-search.aws.element84.com/v1)에서 한 번 받아서 저장소에 넣어 둔 것이다. 앱이 돌아가는 동안 인터넷에서 받는 건 배경 지도 타일([OpenFreeMap](https://openfreemap.org), API 키 없음)뿐이다.

스냅샷은 실제 운영 데이터처럼 깨끗하지 않다.
