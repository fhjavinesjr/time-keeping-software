import fs from "fs";
import path from "path";

const root = process.cwd();
const distDir = path.join(root, "dist", "timekeeping");
const standaloneDir = path.join(root, ".next", "standalone");
const publicDir = path.join(root, "public");
const staticDir = path.join(root, ".next", "static");

function parseEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

function publicProductionEnvironment() {
  const fromFiles = [".env", ".env.production", ".env.local", ".env.production.local"]
    .map((file) => parseEnvironmentFile(path.join(root, file)))
    .reduce((combined, values) => ({ ...combined, ...values }), {});

  const publicKeys = [...new Set([...Object.keys(fromFiles), ...Object.keys(process.env)])]
    .filter((key) => key.startsWith("NEXT_PUBLIC_"))
    .sort();

  if (publicKeys.length === 0) {
    throw new Error(
      "No NEXT_PUBLIC_* values were found. Set the module's public production configuration before building."
    );
  }

  return Object.fromEntries(
    publicKeys.map((key) => [key, process.env[key] ?? fromFiles[key] ?? ""])
  );
}

function quoteEnvironmentValue(value) {
  return JSON.stringify(value);
}

for (const requiredPath of [standaloneDir, staticDir]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing Next.js standalone build output: ${requiredPath}`);
  }
}

console.log("Packaging timekeeping production build...");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(standaloneDir, distDir, { recursive: true, dereference: true });

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(distDir, "public"), { recursive: true });
}

fs.cpSync(staticDir, path.join(distDir, ".next", "static"), { recursive: true });

const environment = publicProductionEnvironment();
const packagedEnvironment = [
  ...Object.entries(environment).map(
    ([key, value]) => `${key}=${quoteEnvironmentValue(value)}`
  ),
  "PORT=3083",
  "HOSTNAME=0.0.0.0",
  "",
].join("\n");
fs.writeFileSync(path.join(distDir, ".env"), packagedEnvironment, "utf8");

fs.renameSync(
  path.join(distDir, "server.js"),
  path.join(distDir, "server.next.js")
);
fs.writeFileSync(
  path.join(distDir, "server.js"),
  `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\\r?\\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

process.env.PORT ||= "3083";
process.env.HOSTNAME ||= "0.0.0.0";
await import("./server.next.js");
`,
  "utf8"
);

console.log("");
console.log("Production package created successfully:");
console.log(distDir);
console.log(`Run it with: cd dist\\timekeeping && node server.js`);
