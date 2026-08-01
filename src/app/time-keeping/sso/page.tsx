"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSso } from "@/lib/utils/ssoBootstrap";

function SsoCallback() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setError("The single sign-on code is missing.");
      return;
    }

    void bootstrapSso(code, "timekeeping")
      .then(() => router.replace("/time-keeping/welcomepage"))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Single sign-on failed.");
      });
  }, [router]);

  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{error ? "Unable to sign in" : "Opening Timekeeping"}</h1>
        <p>{error || "Preparing your employee profile and permissions..."}</p>
        {error && <button type="button" onClick={() => router.replace("/time-keeping/login")}>Return to login</button>}
      </div>
    </main>
  );
}

export default function SsoPage() {
  return <SsoCallback />;
}
