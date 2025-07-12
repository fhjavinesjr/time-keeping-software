import React, { useState } from "react";
import styles from "@/styles/EmployeeAutoSuggestion.module.scss";

type Employee = {
    employeeid: number; // or string, depending on your database schema
    lastname: string;
    firstname: string;
    suffix: string;
    employeeNo: string;
};

  interface EmployeeAutoSuggestionProps {
    query: string;
    setQuery: (query: string) => void;
  }

export default function EmployeeAutoComplete({query, setQuery}: EmployeeAutoSuggestionProps) {
    const [suggestions, setSuggestions] = useState<Employee[]>([]);

  const fetchSuggestions = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/employee_autocomplete?query=${searchTerm}`);
      const data = await response.json();

      if (response.ok) {
        setSuggestions(data);
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    fetchSuggestions(value);
  };

  return (
    <div className={styles.EmployeeAutosuggestion}>
      <input
        name="employeeFieldTimeShift"
        type="text"
        value={query}
        onChange={handleInputChange}
        className={styles.input}
        placeholder="Search employee by ID or Lastname..."
      />
      {suggestions.length > 0 && (
        <ul className={styles.suggestionsList}>
          {suggestions.map((employee) => (
            <li key={employee.employeeid} className={styles.suggestionsList_item}
              onClick={() => {
                setQuery(`[${employee.employeeNo}] ${employee.lastname}, ${employee.firstname} ${employee.suffix}`);
                setSuggestions([]);
              }}
            >
              [{employee.employeeNo}] {employee.lastname}, {employee.firstname} {employee.suffix}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}