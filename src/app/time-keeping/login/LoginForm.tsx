"use client";

import React from "react";
import styles from "@/styles/LoginForm.module.scss";
import InputFieldSetup from "../../../components/login/InputFieldSetup";
import ButtonSetup from "../../../components/login/SetupButton";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation"; //use next/navigation if the page is dynamic (server-rendered or client-rendered)
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { fetchWithAuth } from "@/pages/api/fetchWithAuth";
import { Employee } from '@/lib/types/Employee';

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const employeeNo = formData.get("employeeNo") as string;
      const employeePassword = formData.get("employeePassword") as string;

      // Login
      const response = await fetch("http://localhost:8084/api/employee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNo, employeePassword }),
      });

      if (!response.ok) {
        Swal.fire({
          title: "Login failed!",
          text: "Incorrect username or password",
          icon: "error",
          confirmButtonText: "OK",
        });
        return;
      }

      const token = await response.text();
      localStorageUtil.set(token); // Store authToken

      // Fetch employees
      const empRes = await fetchWithAuth(
        "http://localhost:8084/api/employees/basicInfo"
      );

      if (!empRes.ok) {
        throw new Error("Failed to fetch employee list");
      }

      const employees: Employee[] = await empRes.json();
      localStorageUtil.setEmployees(employees); //Store employees list to be used later in other module

      // Identify current employee
      const currentEmp = employees.find(emp => emp.employeeNo === employeeNo);

      if (currentEmp) {
        localStorageUtil.setEmployeeNo(currentEmp.employeeNo); // Store employeeNo
        localStorageUtil.setEmployeeFullname(currentEmp.fullName); // Store fullname
        localStorageUtil.setEmployeeRole(currentEmp.role);
      }

      // Success
      Swal.fire({
        title: "Login Successfully!",
        text: "Press OK to proceed",
        icon: "success",
        confirmButtonText: "OK",
        allowOutsideClick: false,
        backdrop: true,
      }).then((result) => {
        if (result.isConfirmed) {
          router.push("/time-keeping/dashboard");
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      Swal.fire({
        title: "Login failed!",
        text: "Unreachable backend service",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

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
