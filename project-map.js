#!/usr/bin/env node

/**
 * project-map.js
 *
 * Prints a documentation-focused tree for the Pallinky repo.
 * Only includes source files from explicitly allowed folders and only when
 * they contain a meaningful top JSDoc header.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || ".");
const MAX_COMMENT_LINES = 6;

// Only search inside these folders.
const ALLOWED_ROOTS = [
  "apps/mobile/app",
  "apps/mobile/components",
  "apps/web/app",
  "apps/web/lib",
  "packages/core/src",
  "packages/ui/src",
];

// File types worth scanning.
const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

// Hard skip noisy / irrelevant files.
const SKIP_FILE_NAMES = new Set([
  "next-env.d.ts",
  "middleware.ts",
  "project-map.js",
  "docker-entrypoint.js",
]);

// Skip folders inside allowed roots if needed.
const SKIP_DIR_NAMES = new Set([
  "_backups",
  "assets",
  "public",
  "hooks", // remove this line if you want hooks included
]);

// Only keep headers that look like real file docs.
const USEFUL_HEADER_KEYS = [
  "Description:",
  "Version:",
  "Updated:",
  "Note:",
];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isUnderAllowedRoot(relativePath) {
  const rp = toPosix(relativePath);
  return ALLOWED_ROOTS.some((root) => rp === root || rp.startsWith(root + "/"));
}

function isAllowedExtension(filePath) {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function shouldSkipFile(fileName) {
  if (SKIP_FILE_NAMES.has(fileName)) return true;
  if (fileName.endsWith(".d.ts")) return true;
  return false;
}

function readDirSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function extractTopDocBlock(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    // Only match a doc block at the very top, allowing whitespace before it.
    const match = content.match(/^\s*\/\*\*([\s\S]*?)\*\//);
    if (!match) return null;

    const lines = match[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean);

    const usefulLines = lines.filter((line) =>
      USEFUL_HEADER_KEYS.some((key) => line.startsWith(key))
    );

    if (usefulLines.length === 0) return null;

    return usefulLines.slice(0, MAX_COMMENT_LINES);
  } catch {
    return null;
  }
}

function collectTree(dir, relativeDir = "") {
  const entries = readDirSafe(dir);
  const nodes = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const relPosix = toPosix(relPath);

    if (!isUnderAllowedRoot(relPosix)) {
      // Allow traversal only if this path could still lead into an allowed root.
      const couldContainAllowedRoot = ALLOWED_ROOTS.some(
        (root) => root.startsWith(relPosix + "/") || root === relPosix
      );
      if (!couldContainAllowedRoot) continue;
    }

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;

      const children = collectTree(fullPath, relPath);
      if (children.length > 0) {
        nodes.push({
          type: "dir",
          name: entry.name,
          children,
        });
      }
      continue;
    }

    if (!entry.isFile()) continue;
    if (!isAllowedExtension(entry.name)) continue;
    if (shouldSkipFile(entry.name)) continue;
    if (!isUnderAllowedRoot(relPosix)) continue;

    const header = extractTopDocBlock(fullPath);
    if (!header) continue;

    nodes.push({
      type: "file",
      name: entry.name,
      header,
    });
  }

  nodes.sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

function printNodes(nodes, prefix = "") {
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const branch = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    if (node.type === "dir") {
      console.log(prefix + branch + node.name + "/");
      printNodes(node.children, childPrefix);
      return;
    }

    console.log(prefix + branch + node.name);
    for (const line of node.header) {
      console.log(childPrefix + "» " + line);
    }
  });
}

console.log(path.basename(ROOT));
const tree = collectTree(ROOT);
printNodes(tree);