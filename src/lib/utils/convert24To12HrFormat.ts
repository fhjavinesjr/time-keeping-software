
export default function to12HourFormat(time24: string): string {
  const [hourStr, minute, second] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
  return `${hour.toString().padStart(2, "0")}:${minute}:${second} ${ampm}`;
}