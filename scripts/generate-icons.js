#!/usr/bin/env node
/**
 * Script to generate app icons in multiple sizes for all platforms
 * Run: node scripts/generate-icons.js
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT_DIR = path.join(__dirname, "..");
const BUILD_DIR = path.join(ROOT_DIR, "build");
const BUILD_ICONS_DIR = path.join(BUILD_DIR, "icons");

const SOURCE_ICON_PNG = path.join(ROOT_DIR, "icon.png");
const SOURCE_ICON_ICO = path.join(ROOT_DIR, "icon.ico");
const SOURCE_ICON_ICNS = path.join(ROOT_DIR, "icon.icns");

// Linux requires these specific sizes
const LINUX_SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

async function generateIcons() {
    console.log("Generating app icons...");

    // Ensure the build and build/icons directories exist
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }
    if (!fs.existsSync(BUILD_ICONS_DIR)) {
        fs.mkdirSync(BUILD_ICONS_DIR, { recursive: true });
    }

    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON_PNG)) {
        console.error(`Source icon not found: ${SOURCE_ICON_PNG}`);
        process.exit(1);
    }

    const sourceBuffer = fs.readFileSync(SOURCE_ICON_PNG);

    // Generate PNG icons for each size (Linux)
    for (const size of LINUX_SIZES) {
        const outputPath = path.join(BUILD_ICONS_DIR, `${size}x${size}.png`);
        
        try {
            await sharp(sourceBuffer)
                .resize(size, size, {
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(outputPath);
            
            console.log(`✓ Generated ${size}x${size}.png`);
        } catch (error) {
            console.error(`✗ Failed to generate ${size}x${size}.png:`, error.message);
        }
    }

    // Copy icon.png to build/icons/ and build/
    const iconPngDestIcons = path.join(BUILD_ICONS_DIR, "icon.png");
    const iconPngDestBuild = path.join(BUILD_DIR, "icon.png");
    fs.copyFileSync(SOURCE_ICON_PNG, iconPngDestIcons);
    fs.copyFileSync(SOURCE_ICON_PNG, iconPngDestBuild);
    console.log("✓ Copied icon.png to build/");

    // Copy icon.ico for Windows
    if (fs.existsSync(SOURCE_ICON_ICO)) {
        const iconIcoDest = path.join(BUILD_DIR, "icon.ico");
        fs.copyFileSync(SOURCE_ICON_ICO, iconIcoDest);
        console.log("✓ Copied icon.ico to build/");
    } else {
        console.warn("⚠ icon.ico not found in root directory (needed for Windows builds)");
    }

    // Copy icon.icns for macOS
    if (fs.existsSync(SOURCE_ICON_ICNS)) {
        const iconIcnsDest = path.join(BUILD_DIR, "icon.icns");
        fs.copyFileSync(SOURCE_ICON_ICNS, iconIcnsDest);
        console.log("✓ Copied icon.icns to build/");
    } else {
        console.warn("⚠ icon.icns not found in root directory (needed for macOS builds)");
    }

    console.log("\nIcon generation complete!");
    console.log(`Icons saved to: ${BUILD_DIR}`);
}

generateIcons().catch(console.error);

