import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
// Values already set by the platform win; .env only fills what is missing.
dotenv.config({ path: process.env.ENV_FILE || path.join(here, "..", "..", "backend", ".env"), quiet: true });
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true });
