import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

import {
  ALLOWED_EINSTEIN_FORMATS,
  ALLOWED_PENROSE_FORMATS,
  ALLOWED_SPECTRE_FORMATS,
  DEFAULT_COLORS,
  DEFAULT_FOUR_COLORS,
  DEFAULT_HTTP_HEIGHT,
  DEFAULT_HTTP_WIDTH,
  DEFAULT_ITERATIONS,
  DEFAULT_SCALE,
  EINSTEIN_SCALE_NORMALIZATION,
  GENERATORS_DIR,
  MAX_IMAGE_DIMENSION,
  MAX_ITERATIONS,
  MAX_PENROSE_ITERATIONS,
  MAX_SCALE,
  MAX_SPECTRE_ITERATIONS,
  PENROSE_SCALE_NORMALIZATION,
  P1_SCALE_NORMALIZATION,
  PROJECT_ROOT,
  SPECTRE_SCALE_NORMALIZATION,
  SRC_DIR,
} from "./config.js";
import { ApiError } from "./http.js";

function coerceInt(payload, key, fallback, { minimum = 1, maximum } = {}) {
  const value = Number.parseInt(payload[key] ?? fallback, 10);
  if (!Number.isFinite(value)) {
    throw new ApiError(`'${key}' must be an integer.`);
  }
  if (value < minimum) {
    throw new ApiError(`'${key}' must be at least ${minimum}.`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new ApiError(`'${key}' must be at most ${maximum}.`);
  }
  return value;
}

function coerceFloat(payload, key, fallback, { minimum, maximum } = {}) {
  const value = Number.parseFloat(payload[key] ?? fallback);
  if (!Number.isFinite(value)) {
    throw new ApiError(`'${key}' must be a number.`);
  }
  if (minimum !== undefined && value < minimum) {
    throw new ApiError(`'${key}' must be at least ${minimum}.`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new ApiError(`'${key}' must be at most ${maximum}.`);
  }
  return value;
}

function coerceFormat(payload, allowed, fallback) {
  const imageFormat = String(payload.format || fallback).toLowerCase();
  if (!(imageFormat in allowed)) {
    throw new ApiError(`'format' must be one of: ${Object.keys(allowed).sort().join(", ")}.`);
  }
  return imageFormat;
}

function coercePalette(payload) {
  if (payload.palette === undefined || payload.palette === null) {
    return null;
  }
  if (!Array.isArray(payload.palette) || payload.palette.length === 0) {
    throw new ApiError("'palette' must be a non-empty list of CSS-style color values.");
  }
  return payload.palette.map((color) => String(color));
}

function coerceColors(payload) {
  const colors = payload.colors || DEFAULT_COLORS;
  if (!Array.isArray(colors) || colors.length !== 5) {
    throw new ApiError("'colors' must be a list of exactly five CSS-style color values.");
  }
  return colors.map((color) => String(color));
}

function coerceFourColors(payload) {
  const colors = payload.four_colors || DEFAULT_FOUR_COLORS;
  if (!Array.isArray(colors) || colors.length !== 4) {
    throw new ApiError("'four_colors' must be a list of exactly four CSS-style color values.");
  }
  return colors.map((color) => String(color));
}

function coerceOneOf(payload, key, fallback, allowed) {
  const value = String(payload[key] || fallback);
  if (!allowed.includes(value)) {
    throw new ApiError(`'${key}' must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function coerceBoolean(payload, key, fallback = false) {
  const value = payload[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new ApiError(`'${key}' must be a boolean.`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function newestExisting(paths) {
  const candidates = [];
  for (const candidate of paths) {
    if (await exists(candidate)) {
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const withStats = await Promise.all(candidates.map(async (candidate) => ({ candidate, stat: await stat(candidate) })));
  withStats.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
  return withStats[0].candidate;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: {
        ...process.env,
        ...options.env,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new ApiError((stderr || stdout || `${command} failed.`).trim(), 500));
    });
  });
}

async function withTempFile(extension, callback) {
  const tempDir = await mkdir(path.join(os.tmpdir(), "aperiodos-"), { recursive: true }).then(() =>
    path.join(os.tmpdir(), `aperiodos-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`),
  );
  await mkdir(tempDir, { recursive: true });
  const outputPath = path.join(tempDir, `render.${extension}`);
  try {
    return await callback(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function svgToRequestedFormat(svgBuffer, imageFormat) {
  if (imageFormat === "svg") {
    return svgBuffer;
  }
  const image = sharp(svgBuffer);
  if (imageFormat === "jpg" || imageFormat === "jpeg") {
    return image.jpeg().toBuffer();
  }
  return image.png().toBuffer();
}

export async function renderEinstein(payload) {
  const imageFormat = coerceFormat(payload, ALLOWED_EINSTEIN_FORMATS, "png");
  const iterations = coerceInt(payload, "iterations", DEFAULT_ITERATIONS, { minimum: 1, maximum: MAX_ITERATIONS });
  const usesLegacyScalar = payload.scale === undefined && payload.scalar !== undefined;
  const requestedScale = coerceFloat(payload, "scale", DEFAULT_SCALE, { minimum: 1.0, maximum: MAX_SCALE });
  const scalar = usesLegacyScalar
    ? coerceFloat(payload, "scalar", 20.0, { minimum: 0.2, maximum: 200.0 })
    : requestedScale * EINSTEIN_SCALE_NORMALIZATION;
  const width = coerceInt(payload, "width", DEFAULT_HTTP_WIDTH, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const height = coerceInt(payload, "height", DEFAULT_HTTP_HEIGHT, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const centerX = coerceFloat(payload, "center_x", 0.0);
  const centerY = coerceFloat(payload, "center_y", 0.0);
  const colorMode = coerceOneOf(payload, "color_mode", "families", ["families", "four_color"]);
  const colors = coerceColors(payload);
  const fourColors = coerceFourColors(payload);
  const background = String(payload.background || "white");
  const outline = String(payload.outline || "black");
  const strokeWidth = coerceFloat(payload, "stroke_width", payload.no_outline ? 0 : 2, { minimum: 0.0, maximum: 20.0 });
  const seed = payload.seed;

  return withTempFile(imageFormat, async (outputPath) => {
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const args = [
      "-m",
      "generators.einstein",
      "--iterations",
      String(iterations),
      "--scalar",
      String(scalar),
      "--width",
      String(width),
      "--height",
      String(height),
      "--center-x",
      String(centerX),
      "--center-y",
      String(centerY),
      "--output",
      outputPath,
      "--colors",
      ...colors,
      "--color-mode",
      colorMode,
      "--four-colors",
      ...fourColors,
      "--background",
      background,
      "--outline",
      outline,
      "--stroke-width",
      String(strokeWidth),
    ];
    if (seed !== undefined && seed !== null && String(seed).trim() !== "") {
      args.push("--seed", String(coerceInt(payload, "seed", seed, { minimum: 1 })));
    }

    await runCommand(pythonBin, args, {
      cwd: PROJECT_ROOT,
      env: {
        PYTHONPATH: SRC_DIR,
      },
    });

    return {
      buffer: await readFile(outputPath),
      contentType: ALLOWED_EINSTEIN_FORMATS[imageFormat],
      filename: `aperiodic-pattern.${imageFormat}`,
    };
  });
}

export async function renderSpectre(payload) {
  const width = coerceInt(payload, "width", DEFAULT_HTTP_WIDTH, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const height = coerceInt(payload, "height", DEFAULT_HTTP_HEIGHT, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const iterations = coerceInt(payload, "iterations", payload.level ?? 5, {
    minimum: 1,
    maximum: MAX_SPECTRE_ITERATIONS,
  });
  const autoIterations = coerceBoolean(payload, "auto_iterations");
  const requestedScale = coerceFloat(payload, "scale", DEFAULT_SCALE, { minimum: 1.0, maximum: MAX_SCALE });
  const scale = requestedScale * SPECTRE_SCALE_NORMALIZATION;
  const centerX = coerceFloat(payload, "center_x", 0.0);
  const centerY = coerceFloat(payload, "center_y", 0.0);
  const background = String(payload.background || "#ffffff");
  const outline = String(payload.outline || "black");
  const strokeWidth = coerceFloat(payload, "stroke_width", 1.2, { minimum: 0.0, maximum: 20.0 });
  const palette = coercePalette(payload);
  const drawMode = coerceOneOf(payload, "draw_mode", "translation", ["generated", "translation"]);
  const shape = coerceOneOf(payload, "shape", "straight", ["straight", "curved"]);
  const imageFormat = coerceFormat(payload, ALLOWED_SPECTRE_FORMATS, "svg");

  return renderRustSvg({
    imageFormat,
    allowedFormats: ALLOWED_SPECTRE_FORMATS,
    filenameBase: "spectre",
    binaryEnv: "SPECTRE_BIN",
    releaseBinary: path.join(GENERATORS_DIR, "spectre", "target", "release", "spectre"),
    debugBinary: path.join(GENERATORS_DIR, "spectre", "target", "debug", "spectre"),
    cargoCwd: path.join(GENERATORS_DIR, "spectre"),
    args: [
      "--width",
      String(width),
      "--height",
      String(height),
      "--iterations",
      String(iterations),
      ...(autoIterations ? ["--auto-iterations"] : []),
      "--scale",
      String(scale),
      "--center-x",
      String(centerX),
      "--center-y",
      String(centerY),
      "--background",
      background,
      "--outline",
      outline,
      "--stroke-width",
      String(strokeWidth),
      "--draw-mode",
      drawMode,
      "--shape",
      shape,
      ...(palette ? ["--palette", palette.join(",")] : []),
    ],
  });
}

export async function renderPenrose(payload) {
  const width = coerceInt(payload, "width", DEFAULT_HTTP_WIDTH, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const height = coerceInt(payload, "height", DEFAULT_HTTP_HEIGHT, { minimum: 64, maximum: MAX_IMAGE_DIMENSION });
  const iterations = coerceInt(payload, "iterations", 4, { minimum: 0, maximum: MAX_PENROSE_ITERATIONS });
  const scale = coerceFloat(payload, "scale", DEFAULT_SCALE, { minimum: 1.0, maximum: MAX_SCALE });
  const centerX = coerceFloat(payload, "center_x", 0.0);
  const centerY = coerceFloat(payload, "center_y", 0.0);
  const background = String(payload.background || "#ffffff");
  const outline = String(payload.outline || "black");
  const strokeWidth = coerceFloat(payload, "stroke_width", 1.0, { minimum: 0.0, maximum: 20.0 });
  const palette = coercePalette(payload);
  let buildLogic = coerceOneOf(payload, "build_logic", "default", ["default", "cartwheel"]);
  const tileMode = coerceOneOf(payload, "tile_mode", "kite-dart", ["kite-dart", "rhombs", "p1"]);
  if (tileMode !== "kite-dart" && buildLogic === "cartwheel") {
    throw new ApiError("'build_logic' value 'cartwheel' is only supported when 'tile_mode' is 'kite-dart'.");
  }
  if (tileMode !== "kite-dart") {
    buildLogic = "default";
  }
  const seed = buildLogic === "default" ? "sun" : "star";
  const rendererScale = scale * (tileMode === "p1" ? P1_SCALE_NORMALIZATION : PENROSE_SCALE_NORMALIZATION);
  const imageFormat = coerceFormat(payload, ALLOWED_PENROSE_FORMATS, "svg");

  return renderRustSvg({
    imageFormat,
    allowedFormats: ALLOWED_PENROSE_FORMATS,
    filenameBase: "penrose",
    binaryEnv: "PENROSE_BIN",
    releaseBinary: path.join(GENERATORS_DIR, "penrose", "target", "release", "penrose"),
    debugBinary: path.join(GENERATORS_DIR, "penrose", "target", "debug", "penrose"),
    cargoCwd: path.join(GENERATORS_DIR, "penrose"),
    args: [
      "--width",
      String(width),
      "--height",
      String(height),
      "--iterations",
      String(iterations),
      "--scale",
      String(rendererScale),
      "--center-x",
      String(centerX),
      "--center-y",
      String(centerY),
      "--background",
      background,
      "--outline",
      outline,
      "--stroke-width",
      String(strokeWidth),
      "--seed",
      seed,
      "--tile-mode",
      tileMode,
      ...(palette ? ["--palette", palette.join(",")] : []),
    ],
  });
}

async function renderRustSvg({ imageFormat, allowedFormats, filenameBase, binaryEnv, releaseBinary, debugBinary, cargoCwd, args }) {
  return withTempFile("svg", async (outputPath) => {
    const configured = process.env[binaryEnv];
    const binaryPath = configured || (await newestExisting([releaseBinary, debugBinary]));
    const command = binaryPath || "cargo";
    const commandArgs = binaryPath
      ? ["--output", outputPath, ...args]
      : ["run", "--quiet", "--release", "--", "--output", outputPath, ...args];

    await runCommand(command, commandArgs, {
      cwd: binaryPath ? PROJECT_ROOT : cargoCwd,
    });

    const svgBuffer = await readFile(outputPath);
    const buffer = await svgToRequestedFormat(svgBuffer, imageFormat);
    return {
      buffer,
      contentType: allowedFormats[imageFormat],
      filename: `${filenameBase}.${imageFormat}`,
    };
  });
}
