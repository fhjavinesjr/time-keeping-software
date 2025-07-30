"use client";

export const dynamic = "force-dynamic"; //It ensures the page is always rendered dynamically (server-rendered or client-rendered) and skips static generation during build time.

import React from "react";
import styles from "@/styles/RegistrationForm.module.scss";
import InputFieldForm from "../../../components/registration/InputFieldForm";
import { useRouter } from "next/navigation"; //use next/navigation if the page is dynamic (server-rendered or client-rendered)
import Swal from "sweetalert2";

export default function Registration() {
  const router = useRouter();

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
      Swal.fire({
        title: "Failed",
        text: "Password does not match!",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    const payload = {
      employeeNo: formData.get("employeeNo") as string,
      employeePassword: password as string,
      firstname: formData.get("firstname") as string,
      lastname: formData.get("lastname") as string,
      suffix: formData.get("extensionName") as string,
      email: formData.get("email") as string,
      position: formData.get("positionTitle") as string,
      shortJobDesc: formData.get("shortJobDescription") as string,
    };

    try {
      const response = await fetch(
        "http://localhost:8084/api/employee/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Backend errors:", errorBody);
        throw new Error("Failed to submit form");
      }

      Swal.fire({
        title: "Successful",
        text: "Information was saved",
        icon: "success",
        confirmButtonText: "OK",
        allowOutsideClick: false,
        backdrop: true,
      }).then((result) => {
        if (result.isConfirmed) {
          router.push("/time-keeping");
        }
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      Swal.fire({
        title: "Failed Registration",
        text: "Please check fields",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.Registration}>
      <InputFieldForm />

      <div className={styles.buttonGroup}>
        <button type="submit" className={styles.button}>
          Register
        </button>
      </div>
    </form>
  );
}
