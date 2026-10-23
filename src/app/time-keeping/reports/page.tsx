"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Main from "../main/Main";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import styles from "@/styles/TimekeepingReports.module.scss";

type Area = { areasId: number; areasName: string };
type BusinessUnit = { businessUnitsId: number; businessUnitsName: string; areasId: number };
type EmployeeOption = { employeeId: number | string; employeeNo: string; fullName: string };
type Signatory = { employee: EmployeeOption | null; input: string; position: string };
type SignatoryRole = "prepared" | "certified" | "verified";
type ReportId = "mra" | "tardiness" | "undertime" | "overtime" | "night-differential" | "incomplete-dtr";
type ReportOption = { id: ReportId; label: string; permission: string; description: string };

const REPORTS: ReportOption[] = [
  { id: "mra", label: "Monthly Report of Attendance", permission: "tk.reports.mra",
    description: "Daily DTR-derived attendance, leave, late, undertime, overtime, absence, and remarks." },
  { id: "tardiness", label: "Tardiness Summary", permission: "tk.reports.tardiness",
    description: "Dates and minutes of tardiness from employee DTRs." },
  { id: "undertime", label: "Undertime Summary", permission: "tk.reports.undertime",
    description: "Distinct undertime minutes, excluding tardiness already shown separately." },
  { id: "overtime", label: "Overtime Summary", permission: "tk.reports.overtime",
    description: "DTR-computed overtime minutes with the underlying DTR status for review." },
  { id: "night-differential", label: "Night Differential Summary", permission: "tk.reports.nightDifferential",
    description: "Recorded work minutes within 6 p.m.–6 a.m.; this is evidence, not a payable NSDP determination." },
  { id: "incomplete-dtr", label: "Incomplete DTR Review", permission: "tk.reports.incompleteDtr",
    description: "Review missing punches, incomplete breaks, absence, schedule gaps, and DTR conflicts against source records." },
];

const emptySignatory = (): Signatory => ({ employee: null, input: "", position: "" });
const api = (service: "administrative" | "hrm" | "timekeeping") =>
  runtimeConfig.getApiUrl(service).replace(/\/+$/, "");
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function TimekeepingReportsPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [fromDate, setFromDate] = useState(() => { const day = new Date(); day.setDate(day.getDate() - 30); return localDate(day); });
  const [toDate, setToDate] = useState(() => { const day = new Date(); day.setDate(day.getDate() - 1); return localDate(day); });
  const [areaId, setAreaId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [signatories, setSignatories] = useState<Record<SignatoryRole, Signatory>>({
    prepared: emptySignatory(), certified: emptySignatory(), verified: emptySignatory(),
  });
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reportId, setReportId] = useState<ReportId>("mra");
  const allowedReports = REPORTS.filter((report) => localStorageUtil.canAccess(report.permission));
  const selectedReport = allowedReports.find((report) => report.id === reportId) ?? allowedReports[0];
  const canAccess = allowedReports.length > 0;

  useEffect(() => {
    if (!canAccess) { setLoading(false); return; }
    let active = true;
    Promise.all([
      fetchWithAuth(`${api("administrative")}/api/areas/get-all`),
      fetchWithAuth(`${api("administrative")}/api/businessUnits/get-all`),
      fetchWithAuth(`${api("hrm")}/api/employees/basicInfo`),
    ]).then(async ([areaResponse, unitResponse, employeeResponse]) => {
      if (!areaResponse.ok || !unitResponse.ok || !employeeResponse.ok) {
        throw new Error("Unable to load Areas, Business Units, or employee signatories.");
      }
      const [areaData, unitData, employeeData] = await Promise.all([
        areaResponse.json() as Promise<Area[]>,
        unitResponse.json() as Promise<BusinessUnit[]>,
        employeeResponse.json() as Promise<EmployeeOption[]>,
      ]);
      if (active) {
        setAreas(areaData);
        setUnits(unitData);
        setEmployees(employeeData);
        setLoadError("");
      }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Report setup failed.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canAccess]);

  const filteredUnits = useMemo(
    () => units.filter((unit) => String(unit.areasId) === areaId),
    [units, areaId],
  );
  const employeeLabel = (employee: EmployeeOption) =>
    `[${employee.employeeNo}] ${employee.fullName}`;

  const selectSignatory = async (role: SignatoryRole, input: string) => {
    const employee = employees.find((candidate) => employeeLabel(candidate).toLowerCase() === input.toLowerCase()) ?? null;
    setSignatories((current) => ({ ...current, [role]: { employee, input, position: "" } }));
    if (!employee) return;
    try {
      const response = await fetchWithAuth(
        `${api("timekeeping")}/api/work-schedule/signatory-position?employeeId=${encodeURIComponent(String(employee.employeeId))}`,
      );
      if (!response.ok) return;
      const details: { position?: string } = await response.json();
      setSignatories((current) => current[role].employee?.employeeId === employee.employeeId
        ? { ...current, [role]: { ...current[role], position: details.position ?? "" } }
        : current);
    } catch {
      // The server resolves signatory details again before rendering the PDF.
    }
  };

  const print = async () => {
    if (!selectedReport) return;
    const incomplete = selectedReport.id === "incomplete-dtr";
    if ((!incomplete && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) ||
        (incomplete && (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate)) ||
        !areaId || !signatories.prepared.employee || !signatories.certified.employee) {
      await Swal.fire({ icon: "warning", title: "Complete the report fields", text: `Select ${incomplete ? "a valid date range" : "a calendar month"}, Area, Prepared by, and Certified by from the employee suggestions.` });
      return;
    }
    const viewer = window.open("", "_blank");
    setPrinting(true);
    try {
      const params = new URLSearchParams({ areaId,
        preparedById: String(signatories.prepared.employee.employeeId),
        certifiedById: String(signatories.certified.employee.employeeId) });
      if (incomplete) { params.set("from", fromDate); params.set("to", toDate); }
      else { params.set("year", month.slice(0, 4)); params.set("month", String(Number(month.slice(5, 7)))); }
      if (unitId) params.set("businessUnitId", unitId);
      if (signatories.verified.employee) params.set("verifiedById", String(signatories.verified.employee.employeeId));
      const route = incomplete ? "incomplete-dtr" : selectedReport.id === "mra" ? "monthly-attendance" : `summaries/${selectedReport.id}`;
      const response = await fetchWithAuth(`${api("timekeeping")}/api/timekeeping/reports/${route}?${params}`);
      if (!response.ok) {
        const body = await response.text();
        let message = `Unable to generate ${selectedReport.label} (${response.status}).`;
        try { message = (JSON.parse(body) as { message?: string }).message ?? message; }
        catch { if (body && body.length < 300) message = body; }
        throw new Error(message);
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      if (viewer) viewer.location.href = blobUrl;
      else {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${selectedReport.id}_${incomplete ? `${fromDate}_${toDate}` : month}.pdf`;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 300_000);
    } catch (error) {
      viewer?.close();
      await Swal.fire({ icon: "error", title: "Report could not be printed", text: error instanceof Error ? error.message : "Please try again." });
    } finally { setPrinting(false); }
  };

  if (!canAccess || !selectedReport) return <Main><section className={styles.reportPanel}><h1>Reports</h1><p>You do not have access to Timekeeping reports.</p></section></Main>;

  return <Main><div className={styles.layout}>
    <aside className={styles.reportList} aria-label="Timekeeping reports">
      <h2>Reports</h2>
      {allowedReports.map((report) => <button type="button" key={report.id}
        className={report.id === selectedReport.id ? styles.selectedReport : styles.reportChoice}
        aria-current={report.id === selectedReport.id ? "page" : undefined}
        onClick={() => setReportId(report.id)}>{report.label}</button>)}
    </aside>
    <main className={styles.reportPanel}>
      <h1>{selectedReport.label}</h1>
      <p>{selectedReport.description}</p>
      {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
      <div className={styles.fields}>
        {selectedReport.id === "incomplete-dtr" ? <>
          <label>Date from<input aria-label="Date from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>Date to<input aria-label="Date to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </> : <label>Calendar month<input aria-label="Calendar month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
        <label>Area<select aria-label="Area" value={areaId} onChange={(event) => { setAreaId(event.target.value); setUnitId(""); }}><option value="">Select Area</option>{areas.map((area) => <option key={area.areasId} value={area.areasId}>{area.areasName}</option>)}</select></label>
        <label>Business Unit<select aria-label="Business Unit" value={unitId} disabled={!areaId} onChange={(event) => setUnitId(event.target.value)}><option value="">All Business Units</option>{filteredUnits.map((unit) => <option key={unit.businessUnitsId} value={unit.businessUnitsId}>{unit.businessUnitsName}</option>)}</select></label>
      </div>
      <h2>Signatories</h2>
      <p>Select employees from the autocomplete list. Their current appointment positions are supplied by HRIS.</p>
      <datalist id="mra-signatory-employees">{employees.map((employee) => <option key={employee.employeeId} value={employeeLabel(employee)} />)}</datalist>
      <div className={styles.fields}>
        {(["prepared", "certified", "verified"] as const).map((role) => <label key={role}>{role === "prepared" ? "Prepared by" : role === "certified" ? "Certified by" : "Verified by (optional)"}
          <input type="text" list="mra-signatory-employees" value={signatories[role].input} onChange={(event) => { void selectSignatory(role, event.target.value); }} placeholder="Search employee number or name" />
          <small>{signatories[role].employee ? signatories[role].position || "Position not recorded" : "Choose a suggested employee"}</small>
        </label>)}
      </div>
      <button type="button" className={styles.printButton} onClick={() => { void print(); }} disabled={loading || printing || Boolean(loadError)}>{printing ? "Preparing PDF…" : `Print ${selectedReport.label}`}</button>
      <p className={styles.note}>Current-month attendance PDFs stop at today; Incomplete DTR review stops at yesterday. Employee membership uses the current Area/Business Unit assignment; review past transfers and source records before signing. Night-work minutes do not establish NSDP eligibility or pay. The MRA is an agency report, not a CSC-prescribed form.</p>
    </main>
  </div></Main>;
}
