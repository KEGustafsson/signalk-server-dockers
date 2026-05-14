#!/usr/bin/env node
// Regenerate the workflow_dispatch.inputs block of each workflow YAML from
// .github/build-matrix.json. The block to replace is delimited by BEGIN/END
// marker comments — see MARKERS below. The indent of the BEGIN line and the
// file's existing line ending (LF or CRLF) are preserved.
//
// Usage:
//   node .github/scripts/sync-dispatch-inputs.mjs            regenerate in place
//   node .github/scripts/sync-dispatch-inputs.mjs --check    exit 1 if any drift

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { argv, exit } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const matrixPath = resolve(repoRoot, '.github', 'build-matrix.json');

const WORKFLOWS = [
  '.github/workflows/build sk docker container all.yml',
  '.github/workflows/build sk docker container 24h.yml',
  '.github/workflows/build docker base container all.yml',
];

const BEGIN = '# >>> BEGIN auto-generated dispatch inputs (from build-matrix.json — run .github/scripts/sync-dispatch-inputs.mjs to update)';
const END   = '# <<< END auto-generated dispatch inputs';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function osDisplay(os) {
  // ubuntu-24.04 -> "Ubuntu 24.04", alpine -> "Alpine"
  const [head, ...tail] = os.id.split('-');
  return [head[0].toUpperCase() + head.slice(1), ...tail].join(' ');
}

function nodeDisplay(os, node) {
  return os.family === 'ubuntu' ? `Node ${node.id}.x` : `Node ${node.id}`;
}

function keyFor(os, node) {
  return `${os.id.replace(/[-.]/g, '_')}_node_${node.id}`;
}

function buildBlock(matrix, indent) {
  const lines = [];
  for (const os of matrix.os_variants) {
    for (const node of matrix.node_versions) {
      const key = keyFor(os, node);
      const desc = `${osDisplay(os)} + ${nodeDisplay(os, node)}`;
      const def = (os.default_enabled && node.default_enabled) ? 'true' : 'false';
      lines.push(`${indent}${key}:`);
      lines.push(`${indent}  description: '${desc}'`);
      lines.push(`${indent}  type: boolean`);
      lines.push(`${indent}  default: ${def}`);
    }
  }
  return lines;
}

const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
const check = argv.includes('--check');
let drift = false;
let missingMarkers = false;

const beginRe = new RegExp(`^([ \\t]*)${escapeRegExp(BEGIN)}[^\\r\\n]*(\\r?\\n)`, 'm');
const endRe   = new RegExp(`^[ \\t]*${escapeRegExp(END)}`, 'm');

for (const rel of WORKFLOWS) {
  const path = resolve(repoRoot, rel);
  const original = readFileSync(path, 'utf8');

  const beginMatch = original.match(beginRe);
  const endMatch = original.match(endRe);

  if (!beginMatch || !endMatch || endMatch.index <= beginMatch.index) {
    console.error(`! ${rel}: BEGIN/END markers missing or malformed.`);
    console.error(`  Expected, on their own lines, inside 'workflow_dispatch.inputs:':`);
    console.error(`    ${BEGIN}`);
    console.error(`    ${END}`);
    missingMarkers = true;
    continue;
  }

  const indent = beginMatch[1];
  const eol = beginMatch[2];
  const beginEnd = beginMatch.index + beginMatch[0].length;
  const endStart = endMatch.index;

  const block = buildBlock(matrix, indent).join(eol) + eol;
  const updated = original.slice(0, beginEnd) + block + original.slice(endStart);

  if (updated === original) {
    console.log(`= ${rel}: up to date`);
    continue;
  }

  if (check) {
    console.error(`x ${rel}: out of sync with build-matrix.json — run 'node .github/scripts/sync-dispatch-inputs.mjs'`);
    drift = true;
  } else {
    writeFileSync(path, updated);
    console.log(`> ${rel}: regenerated`);
  }
}

if (missingMarkers) exit(2);
if (check && drift) exit(1);
