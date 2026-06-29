const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'core-js-compat');
const pairs = [
  ['data.js', 'data.json'],
  ['entries.js', 'entries.json'],
  ['modules.js', 'modules.json'],
];

for (const [jsFile, jsonFile] of pairs) {
  const jsPath = path.join(dir, jsFile);
  if (fs.existsSync(jsPath)) continue;
  if (!fs.existsSync(path.join(dir, jsonFile))) continue;
  fs.writeFileSync(jsPath, `module.exports = require('./${jsonFile}');\n`);
}
