import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const root = process.cwd();
const artifactDir = path.join(root, "dist", "timekeeping");
const serverPath = path.join(artifactDir, "server.js");
const environmentPath = path.join(artifactDir, ".env");

for (const requiredPath of [
  serverPath,
  path.join(artifactDir, "server.next.js"),
  environmentPath,
  path.join(artifactDir, "package.json"),
  path.join(artifactDir, ".next", "static"),
  path.join(artifactDir, "node_modules"),
]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Production artifact is missing: ${requiredPath}`);
  }
}

const packagedEnvironment = Object.fromEntries(
  fs.readFileSync(environmentPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator);
      let value = line.slice(separator + 1);
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [key, value];
    })
);

const unexpectedKeys = Object.keys(packagedEnvironment).filter(
  (key) => !key.startsWith("NEXT_PUBLIC_") && key !== "PORT" && key !== "HOSTNAME"
);
if (unexpectedKeys.length > 0) {
  throw new Error(`The artifact contains non-public environment keys: ${unexpectedKeys.join(", ")}`);
}
if (packagedEnvironment.PORT !== "3083") {
  throw new Error("The packaged frontend port is incorrect.");
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: artifactDir,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: "3083" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  let pageResponse;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Packaged server exited with code ${server.exitCode}.\n${output}`);
    }
    try {
      pageResponse = await fetch("http://127.0.0.1:3083/time-keeping/login");
      break;
    } catch {
      await delay(500);
    }
  }

  if (!pageResponse?.ok) {
    throw new Error(`Packaged server did not return HTTP 200 for /time-keeping/login.\n${output}`);
  }

  const pageHtml = await pageResponse.text();
  const runtimeConfigIndex = pageHtml.indexOf("/runtime-config.js");
  const headEnd = pageHtml.toLowerCase().indexOf("</head>");
  if (runtimeConfigIndex < 0 || headEnd < 0 || runtimeConfigIndex > headEnd) {
    throw new Error("The runtime configuration loader is not inside the document head.");
  }

  const runtimeResponse = await fetch("http://127.0.0.1:3083/runtime-config.js");
  if (!runtimeResponse.ok) {
    throw new Error(`Runtime config returned HTTP ${runtimeResponse.status}.`);
  }
  if (!runtimeResponse.headers.get("cache-control")?.includes("no-store")) {
    throw new Error("Runtime config response is missing its no-store cache policy.");
  }

  const assignmentPrefix = "window.__ISOFT_RUNTIME_CONFIG__ = ";
  const runtimeBody = await runtimeResponse.text();
  if (!runtimeBody.startsWith(assignmentPrefix)) {
    throw new Error("Runtime config response has an unexpected format.");
  }
  const runtimeConfig = JSON.parse(
    runtimeBody.slice(assignmentPrefix.length).trim().replace(/;$/, "")
  );
  for (const [key, value] of Object.entries(packagedEnvironment)) {
    if (key.startsWith("NEXT_PUBLIC_") && runtimeConfig[key] !== value) {
      throw new Error(`Runtime config does not match the packaged value for ${key}.`);
    }
  }

  console.log("timekeeping production artifact smoke test passed:");
  console.log("- node server.js listened on port 3083");
  console.log("- GET /time-keeping/login returned HTTP 200");
  console.log("- runtime public configuration matched the packaged .env");
  console.log("- runtime configuration script rendered inside the document head");
} finally {
  server.kill();
}
