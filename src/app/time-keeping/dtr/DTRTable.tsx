import React, { useState } from "react";
import styles from "@/styles/DTRTable.module.scss";
import to12HourFormat from "@/lib/utils/convert24To12HrFormat";
import {
  getNextWorkDate,
  hasOvernightSegments,
  isOvernightSegment,
  toWorkDateOnly,
} from "@/lib/utils/dtrSegmentUtils";

type DTRSegmentDTO = {
  dtrSegmentId: number;
  segmentNo: number;
  timeIn: string | null;
  breakOut: string | null;
  breakIn: string | null;
  timeOut: string | null;
  isOvernightShift?: boolean;
  workMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
};

type DTRDailyDTO = {
  dtrDailyId: number;
  employeeId: string;
  workDate: string;
  totalWorkMinutes: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
  attendanceStatus: string;
  segments: DTRSegmentDTO[];
  holidayDetails?: HolidayDetail[];
};

type HolidayDetail = {
  name: string;
  holidayType: string;
  holidayScope: string;
  category: "regular" | "special" | "working";
};

type ScheduledTimes = {
  tsCode: string;
  tsName: string;
  timeIn: string;
  breakOut: string | null;
  breakIn: string | null;
  timeOut: string;
};

type OverlayDetail =
  | { kind: "PASS_SLIP"; purpose: string; departureTime: string; arrivalTime: string }
  | { kind: "TIME_CORRECTED"; correctedTimeIn: string; correctedTimeOut: string; correctedBreakOut?: string | null; correctedBreakIn?: string | null }
  | { kind: "OFFICIAL_ENGAGEMENT"; officialType: string; startDate: string; startTime: string; endDate: string; endTime: string };

type Props = {
  records: DTRDailyDTO[];
  scheduleMap?: Map<string, ScheduledTimes>;
  overlayDetailMap?: Map<string, OverlayDetail>;
  userRole?: string | null;
  onEditSegment?: (record: DTRDailyDTO, segment: DTRSegmentDTO) => void;
  onDeleteSegment?: (record: DTRDailyDTO, segment: DTRSegmentDTO) => void;
};

const formatDate = (dateStr: string) => {
  // Expects MM-dd-yyyy HH:mm:ss, returns MM-dd-yyyy
  return toWorkDateOnly(dateStr);
};
const formatTime = (timeStr: string) => {
  // Expects HH:mm:ss, returns HH:mm:ss AM/PM
  return timeStr ? to12HourFormat(timeStr) : "";
};

const getStatusClass = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("holiday")) return styles.statusHoliday;
  if (normalized.includes("present")) return styles.statusPresent;
  if (normalized.includes("late")) return styles.statusLate;
  if (normalized.includes("rest")) return styles.statusRestDay;
  if (normalized === "cto") return styles.statusCto;
  if (normalized.includes("pass slip")) return styles.statusPassSlip;
  if (normalized.includes("official business") || normalized.includes("official time")) return styles.statusOfficialEngagement;
  if (normalized.includes("time corrected")) return styles.statusTimeCorrection;
  if (normalized.includes("leave")) return styles.statusLeave;
  if (normalized.includes("absent")) return styles.statusAbsent;

  return styles.statusDefault;
};

const formatHolidayType = (value: string) => value.replaceAll("_", " ");

export default function DTRTable({ records, scheduleMap = new Map(), overlayDetailMap = new Map(), userRole, onEditSegment, onDeleteSegment }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState<number | null>(null);

  const toIsoKey = (dateStr: string): string => {
    const [month, day, year] = dateStr.split(" ")[0].split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const handleExpand = (idx: number) => {
    setExpanded(expanded === idx ? null : idx);
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.holidayLegendRow}>
        <span className={styles.legendTitle}>Holiday Legend:</span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendRegular}`} />
          Regular
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSpecial}`} />
          Special
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendWorking}`} />
          Working
        </span>
      </div>
      <table className={styles.summaryTable}>
        <thead>
          <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Work Min</th>
              <th>Late</th>
              <th>Under</th>
              <th>Over</th>
              <th>Segments</th>
              <th>Schedule</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec, idx) => {
              const scheduled = scheduleMap.get(toIsoKey(rec.workDate));
              const overlayDetail = overlayDetailMap.get(toIsoKey(rec.workDate));
              return (
              <React.Fragment key={rec.dtrDailyId}>
                <tr>
                  <td>
                    <div className={styles.workDateCell}>
                      <span>{formatDate(rec.workDate)}</span>
                      {hasOvernightSegments(rec.segments) && (
                        <span className={styles.workDateHint}>
                          {`${formatDate(rec.workDate)} -> ${getNextWorkDate(
                            rec.workDate
                          )}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={styles.statusCell}>
                      <span
                        className={`${styles.statusBadge} ${getStatusClass(
                          rec.attendanceStatus
                        )}`}
                      >
                        {rec.attendanceStatus}
                      </span>
                      {rec.holidayDetails && rec.holidayDetails.length > 0 && (
                        <div className={styles.holidayDetailList}>
                          {rec.holidayDetails.map((holiday, index) => (
                            <div key={`${holiday.name}-${index}`} className={styles.holidayDetailItem}>
                              <span
                                className={`${styles.holidayTypeBadge} ${
                                  holiday.category === "regular"
                                    ? styles.holidayTypeRegular
                                    : holiday.category === "working"
                                    ? styles.holidayTypeWorking
                                    : styles.holidayTypeSpecial
                                }`}
                              >
                                {formatHolidayType(holiday.holidayType)}
                              </span>
                              <span className={styles.holidayDetailText}>
                                {holiday.name} ({holiday.holidayScope})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{rec.totalWorkMinutes}</td>
                  <td>{rec.totalLateMinutes}</td>
                  <td>{rec.totalUndertimeMinutes}</td>
                  <td>{rec.totalOvertimeMinutes}</td>
                  <td>
                    {rec.segments && rec.segments.length > 0 ? (
                      <button
                        className={styles.segmentToggleButton}
                        aria-label={expanded === idx ? "Hide segments" : "Show segments"}
                        onClick={() => handleExpand(idx)}
                      >
                        {expanded === idx ? "Hide" : "Show"}
                      </button>
                    ) : overlayDetail ? (
                      <button
                        className={styles.segmentToggleButton}
                        aria-label={expanded === idx ? "Hide details" : "Show details"}
                        onClick={() => handleExpand(idx)}
                      >
                        {expanded === idx ? "Hide" : "Show"}
                      </button>
                    ) : (
                      <span className={styles.noSegmentText}>-</span>
                    )}
                  </td>
                  <td>
                    {scheduled ? (
                      <button
                        className={styles.scheduleToggleButton}
                        aria-label={scheduleExpanded === idx ? "Hide schedule" : "Show schedule"}
                        onClick={() => setScheduleExpanded(scheduleExpanded === idx ? null : idx)}
                      >
                        {scheduleExpanded === idx ? "Hide" : "Show"}
                      </button>
                    ) : (
                      <span className={styles.noSegmentText}>-</span>
                    )}
                  </td>
                </tr>
                {expanded === idx && (
                  <tr>
                    <td className={styles.segmentCell} colSpan={8}>
                      {rec.segments && rec.segments.length > 0 ? (
                      <div className={styles.segmentPanel}>
                        <table className={styles.segmentTable}>
                          <thead>
                            <tr>
                              <th>Segment</th>
                              <th>Time In</th>
                              <th>Break Out</th>
                              <th>Break In</th>
                              <th>Time Out</th>
                              <th>
                                <span className={styles.headerWithHelp}>
                                  Type
                                  <span
                                    className={styles.helpIcon}
                                    title="Overnight means Time Out occurred on the next calendar day."
                                    aria-label="Overnight means Time Out occurred on the next calendar day."
                                  >
                                    i
                                  </span>
                                </span>
                              </th>
                              <th>Work</th>
                              <th>Late</th>
                              <th>Under</th>
                              <th>Over</th>
                              {userRole === "1" && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {rec.segments.map((seg) => {
                                const overnight = isOvernightSegment(seg);

                                return (
                                  <tr key={seg.dtrSegmentId}>
                                    <td>{seg.segmentNo}</td>
                                    <td>{formatTime(seg.timeIn ?? "")}</td>
                                    <td>{formatTime(seg.breakOut ?? "")}</td>
                                    <td>{formatTime(seg.breakIn ?? "")}</td>
                                    <td>
                                      <span className={styles.timeOutCell}>
                                        {formatTime(seg.timeOut ?? "")}
                                        {overnight && (
                                          <span className={styles.nextDayMarker}>
                                            (+1 day)
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td>
                                      {overnight ? (
                                        <span
                                          className={`${styles.segmentTypeBadge} ${styles.segmentTypeOvernight}`}
                                        >
                                          Overnight
                                        </span>
                                      ) : (
                                        <span
                                          className={`${styles.segmentTypeBadge} ${styles.segmentTypeSameDay}`}
                                        >
                                          Same day
                                        </span>
                                      )}
                                    </td>
                                    <td>{seg.workMinutes}</td>
                                    <td>{seg.lateMinutes}</td>
                                    <td>{seg.undertimeMinutes}</td>
                                    <td>{seg.overtimeMinutes}</td>
                                    {userRole === "1" && (
                                      <td className={styles.actionCell}>
                                        <button
                                          className={styles.editSegBtn}
                                          onClick={() => onEditSegment?.(rec, seg)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          className={styles.deleteSegBtn}
                                          onClick={() => onDeleteSegment?.(rec, seg)}
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      ) : overlayDetail ? (
                        <div className={styles.overlayPanel}>
                          {overlayDetail.kind === "PASS_SLIP" && (
                            <table className={styles.overlayTable}>
                              <thead>
                                <tr>
                                  <th>Purpose</th>
                                  <th>Departure Time</th>
                                  <th>Arrival Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>{overlayDetail.purpose}</td>
                                  <td>{formatTime(overlayDetail.departureTime)}</td>
                                  <td>{formatTime(overlayDetail.arrivalTime)}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                          {overlayDetail.kind === "TIME_CORRECTED" && (
                            <table className={styles.overlayTable}>
                              <thead>
                                <tr>
                                  <th>Corrected Time In</th>
                                  <th>Break Out</th>
                                  <th>Break In</th>
                                  <th>Corrected Time Out</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>{formatTime(overlayDetail.correctedTimeIn)}</td>
                                  <td>{overlayDetail.correctedBreakOut ? formatTime(overlayDetail.correctedBreakOut) : "—"}</td>
                                  <td>{overlayDetail.correctedBreakIn ? formatTime(overlayDetail.correctedBreakIn) : "—"}</td>
                                  <td>{formatTime(overlayDetail.correctedTimeOut)}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                          {overlayDetail.kind === "OFFICIAL_ENGAGEMENT" && (
                            <table className={styles.overlayTable}>
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Start Date</th>
                                  <th>Start Time</th>
                                  <th>End Date</th>
                                  <th>End Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>{overlayDetail.officialType}</td>
                                  <td>{overlayDetail.startDate}</td>
                                  <td>{formatTime(overlayDetail.startTime)}</td>
                                  <td>{overlayDetail.endDate}</td>
                                  <td>{formatTime(overlayDetail.endTime)}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
                {scheduleExpanded === idx && scheduled && (
                  <tr>
                    <td className={styles.scheduleCell} colSpan={8}>
                      <div className={styles.schedulePanel}>
                        <table className={styles.scheduleTable}>
                          <thead>
                            <tr>
                              <th>Shift</th>
                              <th>Time In</th>
                              <th>Break Out</th>
                              <th>Break In</th>
                              <th>Time Out</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>{scheduled.tsName} ({scheduled.tsCode})</td>
                              <td>{formatTime(scheduled.timeIn)}</td>
                              <td>{scheduled.breakOut ? formatTime(scheduled.breakOut) : "\u2014"}</td>
                              <td>{scheduled.breakIn ? formatTime(scheduled.breakIn) : "\u2014"}</td>
                              <td>{formatTime(scheduled.timeOut)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
  );
}