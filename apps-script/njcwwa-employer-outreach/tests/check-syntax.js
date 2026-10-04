'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root)
  .filter((name) => name.endsWith('.gs'))
  .sort();

let failed = false;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  try {
    new vm.Script(source, { filename: file });
    console.log(`PASS syntax ${file}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL syntax ${file}: ${error.stack}`);
  }
}

if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} Apps Script files.`);
