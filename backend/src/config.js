const fs = require('fs');

function readSecret(name, { required = true } = {}) {
  const filePath = process.env[`${name}_FILE`];
  const value = filePath ? fs.readFileSync(filePath, 'utf8').trim() : process.env[name];
  if (required && !value) {
    throw new Error(`${name} não configurado. Use ${name} ou ${name}_FILE.`);
  }
  return value || '';
}

module.exports = { readSecret };
