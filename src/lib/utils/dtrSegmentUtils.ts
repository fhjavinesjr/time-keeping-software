type SegmentLike = {
  timeIn?: string | null;
  timeOut?: string | null;
  isOvernightShift?: boolean | null;
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const parseTimeToSeconds = (time?: string | null): number | null => {
  if (!time) return null;

  const [hourStr = "", minuteStr = "", secondStr = "0"] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return hour * 3600 + minute * 60 + second;
};

// Fallback logic: explicit backend flag wins; otherwise infer from time ordering.
export const isOvernightSegment = (segment: SegmentLike): boolean => {
  if (segment.isOvernightShift !== undefined && segment.isOvernightShift !== null) {
    return segment.isOvernightShift;
  }

  const timeInSeconds = parseTimeToSeconds(segment.timeIn);
  const timeOutSeconds = parseTimeToSeconds(segment.timeOut);

  if (timeInSeconds === null || timeOutSeconds === null) {
    return false;
  }

  // Equality is intentionally NOT overnight unless explicitly flagged by backend.
  return timeOutSeconds < timeInSeconds;
};

export const hasOvernightSegments = (segments?: SegmentLike[] | null): boolean => {
  if (!segments || segments.length === 0) return false;
  return segments.some((segment) => isOvernightSegment(segment));
};

export const toWorkDateOnly = (workDate: string): string => {
  if (!workDate) return "";
  return workDate.split(" ")[0];
};

export const getNextWorkDate = (workDate: string): string => {
  const dateOnly = toWorkDateOnly(workDate);
  const [monthStr, dayStr, yearStr] = dateOnly.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);
  const year = Number(yearStr);

  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12
  ) {
    return dateOnly;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  date.setDate(date.getDate() + 1);
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${date.getFullYear()}`;
};
