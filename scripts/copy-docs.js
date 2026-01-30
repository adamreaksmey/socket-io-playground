const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'docs');

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

function copyDir(from, to) {
  fs.readdirSync(from).forEach((name) => {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  });
}

copyDir(src, dest);
fs.writeFileSync(path.join(dest, '.nojekyll'), '');
console.log('Copied public/ to docs/ for GitHub Pages.');
console.log('Push to GitHub and set Pages source to: main branch, /docs folder.');
