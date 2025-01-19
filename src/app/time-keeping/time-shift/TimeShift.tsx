"use client";

import React, { useState } from "react";
import styles from "@/styles/TimeShift.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCalendarAlt } from "react-icons/fa";

export default function TimeShift() {
  const [dateFromSelectedDate, setDateFromSelectedDate] = useState<Date | null>(null);
  const [dateToSelectedDate, setDateToSelectedDate] = useState<Date | null>(null);
  const [dateFromCalendarOpen, setDateFromCalendarOpen] = useState(false);
  const [dateToCalendarOpen, setDateToCalendarOpen] = useState(false);

  const toggleDateFromCalendar = () => {
    setDateFromCalendarOpen((prev) => !prev);
  };

  const toggleDateToCalendar = () => {
    setDateToCalendarOpen((prev) => !prev);
  };

  const handleDateFromChange = (dateFromData: Date | null) => {
    if (dateFromData instanceof Date && !isNaN(dateFromData.getTime())) {
        setDateFromSelectedDate(dateFromData);
    } else {
      console.error("Invalid date selected");
    }
  };

  const handleDateToChange = (dateToData: Date | null) => {
    if (dateToData instanceof Date && !isNaN(dateToData.getTime())) {
        setDateToSelectedDate(dateToData);
    } else {
      console.error("Invalid date selected");
    }
  };

  return (
    <div id="timeShiftModal" className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Time Shift</h2>
        </div>
        <div className={modalStyles.modalBody}>
          <div className={styles.TimeShift}>
            <div className={styles.dateFromTo}>
                <div>
                    <div>
                        From
                    </div>
                    <div className={styles.datePickerWrapper}>
                        <DatePicker
                            name="dateFrom"
                            selected={dateFromSelectedDate}
                            onChange={handleDateFromChange}
                            dateFormat="MM/dd/yyyy"
                            className={styles.input}
                            placeholderText="Select a date"
                            open={dateFromCalendarOpen}
                            onClickOutside={() => setDateFromCalendarOpen(false)} // close when clicked outside
                            disabled
                        />
                        <button type="button" className={styles.iconButton} onClick={toggleDateFromCalendar}>
                            <FaCalendarAlt className={styles.icon} />
                        </button>
                    </div>
                </div>
                <div>
                    <div>
                        To
                    </div>
                    <div className={styles.datePickerWrapper}>
                        <DatePicker
                            name="dateTo"
                            selected={dateToSelectedDate}
                            onChange={handleDateToChange}
                            dateFormat="MM/dd/yyyy"
                            className={styles.input}
                            placeholderText="Select a date"
                            open={dateToCalendarOpen}
                            onClickOutside={() => setDateToCalendarOpen(false)} // close when clicked outside
                            disabled
                        />
                        <button type="button" className={styles.iconButton} onClick={toggleDateToCalendar}>
                            <FaCalendarAlt className={styles.icon} />
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
