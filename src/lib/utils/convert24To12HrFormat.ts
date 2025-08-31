
export default function to12HourFormat(time24: string): string {
  //you can add the second to the line 4 and add it on return statement
  const [hourStr, minute] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
  return `${hour.toString().padStart(2, "0")}:${minute} ${ampm}`;
}