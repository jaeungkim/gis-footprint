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
