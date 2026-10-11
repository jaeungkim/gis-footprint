// 날짜는 YYYY-MM-DD 문자열로 다닌다. Date는 달력 컴포넌트 경계에서만 쓴다.

// 달력은 로컬 자정 Date를 주고받는다.
export const dayToDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);

  return new Date(y, m - 1, d);
};

export const dateToDay = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

// 화면 표시는 전부 한국 시간
const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatKst = (iso: string) => kst.format(new Date(iso));

// ISO 시각 → 한국 시간 날짜 YYYY-MM-DD (en-CA가 이 형식으로 찍는다)
const kstDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

export const toKstDay = (iso: string) => kstDay.format(new Date(iso));

// from~to(YYYY-MM-DD) 안의 달을 최신 달부터 n개. 기간 빠른 선택용.
export function monthsBetween(from: string, to: string, n = 3) {
  const [fy, fm] = from.split("-").map(Number);
  let [y, m] = to.split("-").map(Number);
  const months: { label: string; from: string; to: string }[] = [];

  while (months.length < n && (y > fy || (y === fy && m >= fm))) {
    const mm = String(m).padStart(2, "0");
    const last = new Date(y, m, 0).getDate(); // 다음 달 0일 = 이번 달 말일
    months.push({
      label: `${m}월`,
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${last}`,
    });
    if (--m === 0) [y, m] = [y - 1, 12];
  }

  return months;
}
