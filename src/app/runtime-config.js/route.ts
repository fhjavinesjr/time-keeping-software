export const dynamic = "force-dynamic";

export function GET(): Response {
  const runtimeConfig = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key.startsWith("NEXT_PUBLIC_") && typeof value === "string"
    )
  );
  const serializedConfig = JSON.stringify(runtimeConfig).replace(/</g, "\\u003c");

  return new Response(`window.__ISOFT_RUNTIME_CONFIG__ = ${serializedConfig};\n`, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
