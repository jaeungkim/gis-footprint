// 리포 루트 data/ 아래 파일. src/와 dist/ 둘 다 apps/api 바로 아래라 어느 쪽에서 돌아도 같은 곳을 가리킨다.
export function dataFile(path: string): URL {
  return new URL(`../../../data/${path}`, import.meta.url);
}
