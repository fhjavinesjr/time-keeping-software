import React from 'react';
import Sidebar from '@/components/sidebar/Sidebar';

export default function Main({children}: {children: React.ReactNode}) {
    return (
        <div style={{ display: "flex" }}>
            <Sidebar />
            {children}
        </div>
    )
}