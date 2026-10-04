# 스냅샷에 넣어 둔 문제들

1단계(카탈로그 적재)와 6단계(수집)를 끝낸 뒤에 연다.

목록은 [defects.tsv](defects.tsv)에 있다. `code` 앞 글자 뜻:

- D: 적재할 때 빼야 하는 Item. 사유를 로그로 남기고 요약 건수에 들어가야 한다.
- N: 적재는 하되 정규화하거나 판단이 필요한 Item. `decide`로 적힌 건 정답이 하나가 아니라서 decisions.md에 가정을 적었는지가 중요하다.
- U: 같은 id가 두 번 나온다. `properties.updated`가 늦은 쪽을 남긴다.
- I: 수집 피드(`data/stac/items.json`, mock STAC API)에만 있는 것. upsert와 중복 처리를 본다.

적재 요약은 대략 이렇게 나와야 한다: 전체 1262건 중 D 7건 제외, 중복 1건 병합, 1254건 적재. D7을 경고로만 남기기로 했다면 1255건.

다시 만들려면 `node scripts/fetch-catalog.mjs` 다음에 `python3 docs/answers/inject-defects.py`. Earth Search 쪽 데이터가 바뀌면 id는 달라질 수 있다.
