/**
 * Convert build/icon.png → build/icon.ico (multi-size).
 * Usage: node scripts/make-icon.js
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const png = path.join(root, "build", "icon.png");
  const ico = path.join(root, "build", "icon.ico");
  if (!fs.existsSync(png)) {
    console.error("Missing build/icon.png — place your icon there first.");
    process.exit(1);
  }
  const pngToIco = require("png-to-ico");
  const buf = await pngToIco(png);
  fs.writeFileSync(ico, buf);
  console.log("Wrote", ico);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
