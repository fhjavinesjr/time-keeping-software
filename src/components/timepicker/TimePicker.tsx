import React from 'react';
import TimePicker from 'react-time-picker';
import styles from "@/styles/TimeShift.module.scss";

interface TimePickerProps {
    name: string;
    value: string;
    onTimeChange: (name: string, time: string | null) => void;
}

export default function TimePickerComponent({name, value, onTimeChange}: TimePickerProps) {

    const handleChange = (time: string | null) => {
        onTimeChange(name, time);  // Pass both the name and time to onTimeChange
    };

    return (
        <div className={styles.customTimePickerWrapper}>
            <TimePicker
                className={styles.customTimePicker}
                name={name}
                value={value}
                onChange={handleChange}
                clockIcon={null} // Remove clock icon if not needed
                clearIcon={null} // Remove clear icon if not needed
            />
        </div>
    );
}