"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction"; // enables editable

import styles from "@/styles/WorkSchedule.module.scss";
import modalStyles from "@/styles/Modal.module.scss";

type ShiftEvent = {
  title: string;
  date: string;
};

const timeShifts = [
  {
    code: "1Q",
    timeIn: "08:00 AM",
    breakOut: "12:00 PM",
    breakIn: "01:00 PM",
    timeOut: "05:00 PM",
  },
  {
    code: "2Q",
    timeIn: "06:00 AM",
    breakOut: "-",
    breakIn: "-",
    timeOut: "02:00 PM",
  },
  {
    code: "NS",
    timeIn: "09:00 PM",
    breakOut: "-",
    breakIn: "-",
    timeOut: "05:00 AM",
  },
];

export default function WorkSchedule() {
  const [events, setEvents] = useState<ShiftEvent[]>([]);

  const handleDateClick = (arg: DateClickArg) => {
    const shiftCode = prompt(`Enter shift code for ${arg.dateStr} (e.g., 1Q):`);
    if (shiftCode) {
      setEvents((prev) => [
        ...prev.filter((event) => event.date !== arg.dateStr),
        { title: shiftCode, date: arg.dateStr },
      ]);
    }
  };

  return (
    <div id="workScheduleModal" className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Work Schedule</h2>
        </div>
        <div className={modalStyles.modalBody}>
          <div className={styles.legend}>
            <h3>Legend</h3>
            <div className={styles.legendGrid}>
              {timeShifts.map((shift) => (
                <div key={shift.code} className={styles.legendItem}>
                  <strong>{shift.code}</strong> – {shift.timeIn}
                  {shift.breakOut !== "-" && ` / ${shift.breakOut}`}
                  {shift.breakIn !== "-" && ` / ${shift.breakIn}`}
                  {shift.timeOut && ` / ${shift.timeOut}`}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.WorkSchedule}>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              events={events}
              dateClick={handleDateClick}
              editable={true}
              selectable={true}
              height="auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
