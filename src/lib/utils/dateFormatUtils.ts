
/**
 * Converts a date string from "MM-dd-yyyy HH:mm:ss" to "yyyy-MM-dd"
 * (Used to populate HTML date input fields)
 */
export const toDateInputValue = (customFormat: string): string => {
  const [month, day, year] = customFormat.split(" ")[0].split("-");
  return `${year}-${month}-${day}`;
};

export const toDateInputValueExplicit = (customFormat: string): string => {
  // Handle both MM-DD-YYYY and YYYY-MM-DD
  const parts = customFormat.split("-");
  const  month = parseInt(parts[0], 10);
  const  day = parseInt(parts[1], 10);
  const  year = parseInt(parts[2], 10);

  // Pad with leading zeros to always match input[type="date"]
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  
  console.log(`${year}-${mm}-${dd}`);
  return `${year}-${mm}-${dd}`;
};

/**
 * Converts a date string from "yyyy-MM-dd" to "MM-dd-yyyy HH:mm:ss"
 * - isStart: true => time = 00:00:00
 * - isStart: false => time = 23:59:59
 */
export const toCustomFormat = (inputValue: string, isStart: boolean): string => {
  const [year, month, day] = inputValue.split("-");
  const time = isStart ? "00:00:00" : "23:59:59";
  return `${month}-${day}-${year} ${time}`;
};

/**
 * Get the first date of month
 * Accepting numbers e.g month(1,2,3,4,5,6,7,8,9,10,11,12) and year(2025)
 */
export const getFirstDateOfMonth = (month: number, year: number): string => {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  return `${toCustomFormat(monthStart, true)}`;
};

/**
 * Get the last date of month
 * Accepting numbers e.g month(1,2,3,4,5,6,7,8,9,10,11,12) and year(2025)
 */
export const getLastDateOfMonth = (month: number, year: number): string => {
  const monthEnd = new Date(year, month, 0); // last day of the month
  const monthEndStr = `${year}-${String(month).padStart(2, "0")}-${String(
    monthEnd.getDate()
  ).padStart(2, "0")}`;
  return `${toCustomFormat(monthEndStr, false)}`;
};