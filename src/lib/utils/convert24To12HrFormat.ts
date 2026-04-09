
export default function to12HourFormat(time24: string): string {
  if (!time24) return "";

  const [hourStr = "00", minute = "00", second = "00"] = time24
    .trim()
    .split(":");

  let hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return time24;

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12; // Convert 0 to 12 for 12 AM

  return `${hour.toString().padStart(2, "0")}:${minute}:${second} ${ampm}`;
}