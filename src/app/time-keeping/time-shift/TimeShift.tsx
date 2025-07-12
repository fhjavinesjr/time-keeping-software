"use client";

import React, { useState } from "react";
import styles from "@/styles/TimeShift.module.scss";
import toolTipStyles from "@/styles/TooltipCustom.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCalendarAlt } from "react-icons/fa";
import TimePicker from '../../../components/timepicker/TimePicker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import WeekdayCheckboxes from "@/components/weekday_checkboxes/WeekDayCheckboxes";
import EmployeeAutoComplete from "@/components/employee_autosuggestion/EmployeeAutoSuggestion";
import Swal from "sweetalert2";

export default function TimeShift() {
  const [dateFromSelectedDate, setDateFromSelectedDate] = useState<Date | null>(null);
  const [dateToSelectedDate, setDateToSelectedDate] = useState<Date | null>(null);
  const [dateFromCalendarOpen, setDateFromCalendarOpen] = useState(false);
  const [dateToCalendarOpen, setDateToCalendarOpen] = useState(false);
  const [timeValues, setTimeValues] = useState({timeIn: '08:00', breakOut: '12:00', breakIn: '13:00', timeOut: '17:00'});
  const [applyToAllValue, setApplyToAllValue] = useState<boolean>(true);
  const [showEmployeeField, setShowEmployeeField] = useState<boolean>(false);
  
  const [query, setQuery] = useState("");
  
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

  const handleTimeChange = (name: string, time: string | null) => {
    setTimeValues((prevValues) => ({
        ...prevValues,
        [name]: time,
    }));
  }

  const handleApplyToAllChange = () => {
    if(applyToAllValue === false) {
      setApplyToAllValue(true);
      setShowEmployeeField(false);
      setQuery("");
    } else {
      setApplyToAllValue(false);
      setShowEmployeeField(true);
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    Swal.fire({
      title: "Are you sure?",
      text: "Do you want to save your changes?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, save it!",
      allowOutsideClick: false,
      cancelButtonText: "Cancel",
      backdrop: true,
    }).then((result) => {
      if(result.isConfirmed) {
        submitTimeShiftChanges(event);
      }
    });

  };

  const submitTimeShiftChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {

      const response = await fetch('/api/timeshift', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {

        Swal.fire({
          title: "Successful",
          text: "Successfully saved!",
          icon: "success",
          confirmButtonText: "OK",
          backdrop: true,
        });

      } else {
        Swal.fire({
          title: "Failed!",
          text: "There's a problem with the data",
          icon: "error",
          confirmButtonText: "OK"
        });
      }

    } catch(error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <form id="timeShiftModal" onSubmit={handleSubmit} className={modalStyles.Modal}>
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
                    <div className={styles.datePickerWrapper} onClick={toggleDateFromCalendar}>
                        <DatePicker
                            name="dateFrom"
                            selected={dateFromSelectedDate}
                            onChange={handleDateFromChange}
                            dateFormat="MM/dd/yyyy"
                            className={styles.input}
                            placeholderText="Select a date"
                            open={dateFromCalendarOpen}
                            onClickOutside={() => setDateFromCalendarOpen(false)} // close when clicked outside
                            readOnly
                            required
                        />
                        <button type="button" className={styles.iconButton}>
                            <FaCalendarAlt className={styles.icon} />
                        </button>
                    </div>
                </div>
                <div>
                    <div>
                        To
                    </div>
                    <div className={styles.datePickerWrapper} onClick={toggleDateToCalendar}>
                        <DatePicker
                            name="dateTo"
                            selected={dateToSelectedDate}
                            onChange={handleDateToChange}
                            dateFormat="MM/dd/yyyy"
                            className={styles.input}
                            placeholderText="Select a date"
                            open={dateToCalendarOpen}
                            onClickOutside={() => setDateToCalendarOpen(false)} // close when clicked outside
                            readOnly
                            required
                        />
                        <button type="button" className={styles.iconButton}>
                            <FaCalendarAlt className={styles.icon} />
                        </button>
                    </div>
                </div>
            </div>
            <div className={styles.timeInOut}>
              <div className={styles.timeIn}>
                  <div>
                    Time In
                  </div>
                  <TimePicker name="timeIn" value={timeValues.timeIn} onTimeChange={handleTimeChange} />
              </div>
              <div className={styles.breakOut}>
                  <div>
                    Break Out
                  </div>
                  <TimePicker name="breakOut" value={timeValues.breakOut} onTimeChange={handleTimeChange} />
              </div>
              <div className={styles.breakIn}>
                  <div>
                    Break In
                  </div>
                  <TimePicker name="breakIn" value={timeValues.breakIn} onTimeChange={handleTimeChange} />
              </div>
              <div className={styles.timeOut}>
                  <div>
                    Time Out
                  </div>
                  <TimePicker name="timeOut" value={timeValues.timeOut} onTimeChange={handleTimeChange} />
              </div>
            </div>
            <div className={styles.restDay}>
              <div>
                Rest Day
              </div>
              <WeekdayCheckboxes />
            </div>
            <div className={styles.applyToAllEmployeeGroup}>
              <div className={styles.applyToAll}>
                <label key="allApplyKey" className={toolTipStyles.tooltipContainer}>
                  <input name="applyToAll" type="checkbox" checked={applyToAllValue} onChange={handleApplyToAllChange} />
                  <span>Apply to ALL</span>
                  <span className={toolTipStyles.tooltipText}>Checked by default; If you want to add time shift to a specific employee, click to toggle off the checkbox.</span>
                </label>
              </div>
              <div className={styles.selectEmployeeTimeShift} style={{ display: showEmployeeField?"block":"none" }}>
                <div className={styles.selectEmployeeTimeShift_employeeField}>
                  Employee
                </div>
                <EmployeeAutoComplete query={query} setQuery={setQuery} />
              </div>
            </div>
            <div className={styles.buttonGroupTimeShift}>
                <button type="submit" className={styles.buttonGroupTimeShift_button} >
                    Proceed
                </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
