import React from 'react';


export default function Main({children}: {children: React.ReactNode}) {
    return (
        <div style={{ display: "flex" }}>
       
            {children}
        </div>
    )
}