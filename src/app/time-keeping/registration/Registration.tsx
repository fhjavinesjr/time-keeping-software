'use client'

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
    event.preventDefault(); // Prevent the default form submission

    // Create a new FormData object from the form
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    
    try {

      const password = formData.get("password");
      const confirmPassword = formData.get("confirmPassword");

      if(password === confirmPassword) {
        const response = await fetch("/api/register", {
          method: "POST",
          body: formData, // Send FormData directly
        });
    
        if (!response.ok) {
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
          if(result.isConfirmed) {
            router.push("/time-keeping");
          }
        });

      } else {
        Swal.fire({
          title: "Failed",
          text: "Password does not match!",
          icon: "error",
          confirmButtonText: "OK"
        });
      }

    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.Registration} >

      <InputFieldForm />

      <div className={styles.buttonGroup}>
        <button type="submit" className={styles.button}>
          Register
        </button>
      </div>
    </form>
  );
}
