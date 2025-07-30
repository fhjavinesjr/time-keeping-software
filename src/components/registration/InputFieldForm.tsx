'use client'

import React, { ChangeEvent, useState } from "react";
import styles from "@/styles/RegistrationForm.module.scss";

export default function InputFieldForm() {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [formMessage, setFormMessage] = useState({
    confirmPassword: "",
    confirmPasswordBoolean: false,
  });


  const handleConfirmPassword = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData({ ...formData, confirmPassword: value });

    if (formData.password === value && value !== "") {
      setFormMessage({
        ...formMessage,
        confirmPassword: "Password match",
        confirmPasswordBoolean: true,
      });
    } else if (value === "") {
      setFormMessage({ ...formMessage, confirmPassword: "" });
    } else {
      setFormMessage({
        ...formMessage,
        confirmPassword: "Password does not match",
        confirmPasswordBoolean: false,
      });
    }
  };

  return (
    <div className={styles.inputField}>
      <label htmlFor="employeeNo" className={styles.label}>Employee No</label>
      <input
        id="employeeNo"
        type="text"
        name="employeeNo"
        className={styles.input}
        aria-label="Employee No"
        required
      />
      <label htmlFor="password" className="label">Password</label>
      <input
        id="password"
        type="password"
        name="password"
        className={styles.input}
        aria-label="Password"
        onChange={(event) => setFormData({ ...formData, password: event.target.value })}
        required
      />
      <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
      <input
        id="confirmPassword"
        type="password"
        name="confirmPassword"
        className={styles.input}
        aria-label="Confirm Password"
        onChange={handleConfirmPassword}
        required
      />
      {formMessage.confirmPassword !== "" ? (
        <span
          className={
            formMessage.confirmPasswordBoolean
              ? styles.confirmPasswordMatchMessage
              : styles.confirmPasswordNotMatchMessage
          }
        >
          {formMessage.confirmPassword}
        </span>
      ) : (
        <span></span>
      )}
      <label htmlFor="firstname" className={styles.label}>Firstname</label>
      <input
        id="firstname"
        type="text"
        name="firstname"
        className={styles.input}
        aria-label="Firstname"
        required
      />
      <label htmlFor="lastname" className={styles.label}>Lastname</label>
      <input
        id="lastname"
        type="text"
        name="lastname"
        className={styles.input}
        aria-label="Lastname"
        required
      />
      <label htmlFor="extensionName" className={styles.label}>Suffix</label>
      <input
        id="extensionName"
        type="text"
        name="extensionName"
        className={styles.input}
        aria-label="Suffix"
      />
      <label htmlFor="email" className={styles.label}>Email</label>
      <input
        id="email"
        type="text"
        name="email"
        className={styles.input}
        aria-label="Email"
        required
      />
      <label htmlFor="positionTitle" className={styles.label}>Position</label>
      <input
        id="positionTitle"
        type="text"
        name="positionTitle"
        className={styles.input}
        aria-label="Position"
        required
      />
      <label htmlFor="shortJobDescription" className={styles.label}>Short job description</label>
      <textarea
        id="shortJobDescription"
        name="shortJobDescription"
        className={styles.input}
        aria-label="Short job description"
      />

    </div>

  );
}