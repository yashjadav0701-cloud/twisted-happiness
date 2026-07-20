const fs = require("fs");
const path = require("path");

console.log("Starting isolated build process for Twisted Happiness...");

const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");

// 1. Remove previous dist folder
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}

// 2. Create a clean dist folder
fs.mkdirSync(distDir, { recursive: true });

// 3. Files/folders that must NOT be copied to production
const excludedItems = new Set([
    "dist",
    "build.js",
    "build.sh",
    "node_modules",
    ".git",
    ".env",
    ".gitignore",
    "netlify.toml"
]);

// 4. Copy all project files into dist
const items = fs.readdirSync(rootDir);

for (const item of items) {
    if (excludedItems.has(item)) {
        continue;
    }

    const sourcePath = path.join(rootDir, item);
    const destinationPath = path.join(distDir, item);

    fs.cpSync(sourcePath, destinationPath, {
        recursive: true
    });
}

// 5. Generate unique deployment version
const deployVersion = Math.floor(Date.now() / 1000);

console.log(`Generated deployment version: ${deployVersion}`);

// 6. Replace placeholder only inside dist/index.html
const distIndexPath = path.join(distDir, "index.html");

if (!fs.existsSync(distIndexPath)) {
    console.error("ERROR: index.html was not found inside dist.");
    process.exit(1);
}

let indexHtml = fs.readFileSync(distIndexPath, "utf8");

if (!indexHtml.includes("__VERSION__")) {
    console.warn("WARNING: No __VERSION__ placeholder was found in dist/index.html.");
} else {
    indexHtml = indexHtml.replaceAll("__VERSION__", deployVersion.toString());
    fs.writeFileSync(distIndexPath, indexHtml, "utf8");
    console.log("Version placeholder successfully injected.");
}

console.log("Build complete. dist directory is ready for Netlify.");