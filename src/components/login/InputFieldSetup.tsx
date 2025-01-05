import React from 'react';
import styles from "@/styles/LoginForm.module.scss";

interface InputFieldProperties {
  label: string;
  inputType: string;
  id: string;
  name: string;
  required: string;
}

const InputFieldSetup: React.FC<InputFieldProperties> = ({ label, inputType, id, name, required }) => {
  return (
    <div className={styles.inputField}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        name={name}
        type={inputType}
        id={id}
        className={styles.input}
        aria-label={label}
        required={required === "true" ? true : false}
      />
    </div>
  );
};

export default InputFieldSetup;