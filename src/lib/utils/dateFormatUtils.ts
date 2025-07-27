
/**
 * Converts a date string from "MM-dd-yyyy HH:mm:ss" to "yyyy-MM-dd"
 * (Used to populate HTML date input fields)
 */
export const toDateInputValue = (customFormat: string): string => {
  const [month, day, year] = customFormat.split(" ")[0].split("-");
  return `${year}-${month}-${day}`;
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