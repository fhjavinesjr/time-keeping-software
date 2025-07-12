import React, { useState } from "react";

import styles from "@/styles/TimeShift.module.scss";

export default function WeekdayCheckboxes() {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const [selectedDays, setSelectedDays] = useState<string[]>([]);

    const handleCheckboxChange = (day: string) => {
        setSelectedDays((prevSelected) =>
            prevSelected.includes(day)
                ? prevSelected.filter((d) => d !== day) // Remove if already selected
                : [...prevSelected, day] // Add if not selected
        );
    };

    return (
        <div className={styles.restDayCheckboxes}>
            <div className={styles.weekDayCheckbox}>
                {days.map((day) => (
                    <label key={day} className={styles.weekDayCheckboxLabel}>
                        <input
                            name={day}
                            type="checkbox"
                            value={day}
                            checked={selectedDays.includes(day)}
                            onChange={() => handleCheckboxChange(day)}
                        />
                        <span>{day}</span>
                    </label>
                ))}
            </div>
            <div className={styles.weekDaySelectedDays}>
                <strong>Selected Days:</strong> {selectedDays.join(", ") || "None"}
            </div>
        </div>
    );
}
