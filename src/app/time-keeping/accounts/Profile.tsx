"use client";

import React, { useState } from "react";
import Styles from "@/styles/Profile.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { FaCamera } from "react-icons/fa";
import Accounts from "./Accounts";
import Image from "next/image";

export default function Profile() {
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const base64Image = e.target?.result?.toString();
        setUploadedFile(base64Image as string);
      };

      reader.readAsDataURL(file);
    } else {
      setUploadedFile(null);
    }
  };

  const handleCameraClick = () => {
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    fileInput.click(); // Trigger file input click when the camera icon is clicked
  };

  return (
    <div className={modalStyles.Modal}>
      <div className={Styles.profileContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Profile</h2>
        </div>
        <div className={Styles.ProfileWrapper}>
          {/* Profile Picture Section */}
          <div className={Styles.profilePictureContainer}>
            <Image
              src={uploadedFile || "/default-avatar.jpg"}
              width={100}
              height={100}
              alt="Profile"
              className={Styles.profilePicture}
            />

            <button
              className={Styles.uploadButton}
              onClick={handleCameraClick} // Trigger the file input
            >
              <FaCamera />
            </button>
            <input
              type="file"
              id="fileInput"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Profile Details Section */}
          <div className={Styles.profileDetails}>
            <h3>DanJo</h3>
            <p>Web Developer</p>
            <p>Tokyo Japan</p>
          </div>
        </div>
      </div>

      <Accounts />
    </div>
  );
}
