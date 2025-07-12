"use client";

import React, { useState, useEffect } from "react";
import styles from "@/styles/Accounts.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import ProfileStyles from "@/styles/Profile.module.scss";
import Address from "./Address";
import { FaPenSquare } from "react-icons/fa";
import Form from "@/styles/AddressForm.module.scss";

export default function Accounts() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // Controls modal visibility
  const [formData, setFormData] = useState({
    employeeNo: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    role: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false); // Track submission status

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add("body-disable");
    } else {
      document.body.classList.remove("body-disable");
    }
  }, [isModalOpen]);

  // Handles input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Form submitted:", formData);
    setIsModalOpen(false); // Close modal after submission
    setIsSubmitted(true); // Mark as submitted
  };

  return (
    <div className={modalStyles.Modal}>
      <div className={ProfileStyles.profileContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Personal Information</h2>

          {/* Edit Button - Opens the Modal */}
          <button
            className={styles.editButton}
            type="button"
            onClick={() => setIsModalOpen(true)}
          >
            Edit <FaPenSquare />
          </button>
        </div>

        <div className={styles.p}>
          <div>
            <p className={Form.label}>Employee No:</p>
            <p>{isSubmitted ? formData.employeeNo : <span className={styles.placeholder}></span>}</p>
          </div>

          <div>
            <p className={Form.label}>First Name:</p>
            <p>{isSubmitted ? formData.firstName : <span className={styles.placeholder}></span>}</p>
          </div>

          <div>
            <p className={Form.label}>Last Name:</p>
            <p>{isSubmitted ? formData.lastName : <span className={styles.placeholder}></span>}</p>
          </div>

          <div>
            <p className={Form.label}>Date of Birth:</p>
            <p>{isSubmitted ? formData.dateOfBirth : <span className={styles.placeholder}></span>}</p>
          </div>

          <div>
            <p className={Form.label}>Email:</p>
            <p>{isSubmitted ? formData.email : <span className={styles.placeholder}></span>}</p>
          </div>

          <div>
            <p className={Form.label}>Role:</p>
            <p>{isSubmitted ? formData.role : <span className={styles.placeholder}></span>}</p>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className={Form.modalOverlay}>
            <div className={Form.modalContent}>
              <div className={Form.mainTitle}>
                <h2>Edit Personal Information</h2>
              </div>

              {/* Form Inside Modal */}
              <form onSubmit={handleSubmit}>
                <div className={Form.Labelcolumn}>
                  <label>Employee No:</label> 
                  <input
                    type="text"
                    name="employeeNo"
                    value={formData.employeeNo}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                <div className={Form.Labelcolumn}>
                  <label>First Name:</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                <div className={Form.Labelcolumn}>
                  <label>Last Name:</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                <div className={Form.Labelcolumn}>
                  <label>Date of Birth:</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                <div className={Form.Labelcolumn}>
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                <div className={Form.Labelcolumn}>
                  <label>Role:</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={Form.inputField}
                  />
                </div>

                {/* Buttons */}
                <div className={Form.buttonSpacing}>
                  {/* Close Button */}
                  <button
                    type="button"
                    className={Form.closeButton}
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>

                  {/* Submit Button */}
                  <button type="submit" className={Form.submitButton}>
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Address />
    </div>
  );
}
