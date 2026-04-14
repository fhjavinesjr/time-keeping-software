
export type WorkScheduleDTO = {
  wsId: number;
  employeeNo: string;
  tsCode: string | null;
  wsDateTime: string; // backend datetime string
  isDayOff?: boolean;
};