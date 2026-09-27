// Reemplaza el placeholder __BUILD_ID__ de out/sw.js por un valor único en
// cada build (postbuild, corre después de `next build`). Así el archivo
// cambia de contenido en cada deploy, el navegador detecta el service worker
// nuevo y dispara install/activate — que vacía el caché viejo y precachea el
// shell actualizado. Sin esto, un usuario que ya tiene la app instalada
// puede quedar viendo el HTML/JS/íconos de un deploy anterior indefinidamente.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "out", "sw.js");
const buildId = Date.now().toString(36);

const content = fs.readFileSync(file, "utf8");
if (!content.includes("__BUILD_ID__")) {
  throw new Error("sw.js no tiene el placeholder __BUILD_ID__ — ¿se editó a mano?");
}
fs.writeFileSync(file, content.replaceAll("__BUILD_ID__", buildId));
console.log(`[stamp-sw] boveda-cache-${buildId}`);
