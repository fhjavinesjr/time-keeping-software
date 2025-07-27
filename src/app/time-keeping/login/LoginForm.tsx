'use client'

import React from "react";
import styles from "@/styles/LoginForm.module.scss";
import InputFieldSetup from "../../../components/login/InputFieldSetup";
import ButtonSetup from "../../../components/login/SetupButton";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation"; //use next/navigation if the page is dynamic (server-rendered or client-rendered)
import { authToken } from "@/pages/api/authToken";

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {

      const employeeNo = formData.get("employeeNo") as string;
      const employeePassword = formData.get("employeePassword") as string;

      //Invoke Login API endpoint for Login
      const response = await fetch('http://localhost:8084/api/employee/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeNo: employeeNo,
          employeePassword: employeePassword,
        }),
      });
      
      if (response.ok) {

        //save/store the token from SB
        const token = await response.text(); //token as plain string
        authToken.set(token); //save to the utilities

        Swal.fire({
          title: "Login Successfully!",
          text: "Press OK to proceeed",
          icon: "success",
          confirmButtonText: "OK",
          allowOutsideClick: false,
          backdrop: true,
        }).then((result) => {
          if(result.isConfirmed) {
            router.push("/time-keeping/dashboard");
          }
        });

      } else {
        Swal.fire({
          title: "Login failed!",
          text: "Incorrect username or password",
          icon: "error",
          confirmButtonText: "OK"
        });
      }

    } catch(error) {
      console.error("Error submitting form:", error);
      Swal.fire({
          title: "Login failed!",
          text: "Unreachable backend service",
          icon: "error",
          confirmButtonText: "OK"
        });
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className={styles.Login} action="">
      <div className={styles.loginImageInput}>
        <div className={styles.loginImage}>
          <Image
            src="/sti-icon.png"
            width={500}
            height={500}
            alt="Picture of the author"
          />
        </div>
        <div className={styles.borderLeft}></div>
        <div className={styles.inputs}>
          <div className={styles.header}>
            <h2>Time Keeping</h2>
          </div>
          <InputFieldSetup
            name="employeeNo"
            label="Employee No"
            inputType="text"
            id="emailId"
            required="true"
          />
          <InputFieldSetup
            name="employeePassword"
            label="Password"
            inputType="password"
            id="passwordId"
            required="true"
          />

          <ButtonSetup buttonType="submit" label="Sign In" />
          <ButtonSetup buttonType={undefined} label="Forgot Password?" />
          <div className={styles.horizontalLine}></div>
          <Link href={"/time-keeping/registration"}>
            <ButtonSetup buttonType="button" label="Sign Up" />
          </Link>
        </div>
      </div>
    </form>
  );
}
