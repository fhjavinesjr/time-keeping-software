"use client";

import React, { useState, useEffect } from "react";
import { GetCountries, GetState } from "react-country-state-city";
import { Country, State } from "react-country-state-city/dist/esm/types";
import styles from "@/styles/Accounts.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import ProfileStyles from "@/styles/Profile.module.scss";
import Form from "@/styles/AddressForm.module.scss";
import { FaPenSquare } from "react-icons/fa";

export default function Address() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [postalCode, setPostalCode] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");

  

  useEffect(() => {
    const fetchCountries = async () => {
      const fetchedCountries = await GetCountries();
      setCountries(fetchedCountries);
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    const fetchStates = async () => {
      if (selectedCountry) {
        const countryId = Number(selectedCountry);
        if (!isNaN(countryId)) {
          const fetchedStates = await GetState(countryId);
          setStates(fetchedStates);
        }
      }
    };
    fetchStates();
  }, [selectedCountry]);

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setPostalCode(value);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Form submitted");
  };

  return (
    <div className={modalStyles.Modal}>
      <div className={ProfileStyles.profileContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Address</h2>
          <button className={styles.editButton} type="button" onClick={() => setIsModalOpen(true)}>
            Edit <FaPenSquare />
          </button>
        </div>
        <div className={styles.p1}>
          <p>Country</p>
          <p>City/Province</p>
          <p>Postal</p>
          <p>Contact</p>
        </div>
      </div>

      {isModalOpen && (
        <div className={Form.modalOverlay}>
          <div className={Form.modalContent}>
            <div className={Form.mainTitle}>
              <h2>Edit Address</h2>
            </div>
            <div className={Form.Labelcolumn}>
              <label>Country</label>
              <select className={Form.dropdown1} value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)}>
                <option value="">Select</option>
                {countries.map((country) => (
                  <option key={country.iso2} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={Form.Labelcolumn}>
              <label>State/Province</label>
              <select className={Form.dropdown2} value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="">Select</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={Form.Labelcolumn}>
              <label>Zip Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={handleZipCodeChange}
                placeholder="Enter ZIP code"
                className={Form.inputField}
                maxLength={12}
              />
            </div>
            <div className={Form.buttonSpacing}>
              <button className={Form.closeButton} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className={Form.submitButton} type="submit" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
