// parseAsIsoDate는 YYYY-MM-DD를 UTC 자정 Date로 읽는다. 다시 날짜 문자열로.
export const toDateString = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : null;

// 달력은 로컬 자정 Date를 쓴다. URL 값(UTC 자정)과 날짜만 맞춰 오간다.
export const utcToLocalDay = (d: Date) =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const localToUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});
export const formatKst = (iso: string) => kst.format(new Date(iso));
