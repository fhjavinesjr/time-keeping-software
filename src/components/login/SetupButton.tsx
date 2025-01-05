import React from 'react';
import styles from "@/styles/LoginForm.module.scss";

interface ButtonSetupProps {
    buttonType: 'button' | 'submit' | 'reset' | undefined;
    label: string;
}

const ButtonSetup: React.FC<ButtonSetupProps> = ({ buttonType, label }) => {
    return (
        <span>
            {   label === "Sign In" ? 
                <div className={styles.buttonGroup}>
                    <button type={buttonType} className={styles.signInButton} >
                        {label}
                    </button>
                </div> 
            :   label === "Sign Up" ?
                <div className={styles.buttonGroup}>
                    <button type={buttonType} className={styles.signUpButton} >
                        Create Account
                    </button>
                </div>
            :  
                <a href="#" className={styles.forgotPassword} >
                    {label}
                </a>
            }
        </span>
    );
};

export default ButtonSetup;