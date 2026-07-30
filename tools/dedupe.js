const fs = require('fs');
const all = JSON.parse(fs.readFileSync('swatch-work/index.json'));
const dist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

const unique = [];
for (const s of all) {
  const dup = unique.find(u => u.category === s.category && dist(u.hash, s.hash) < 4);
  if (dup) { dup.dups.push(s.id); continue; }
  unique.push({ ...s, dups: [] });
}
const byCat = {};
unique.forEach(u => { byCat[u.category] = (byCat[u.category] || 0) + 1; });
console.log('unique:', unique.length, JSON.stringify(byCat));
fs.writeFileSync('swatch-work/unique.json', JSON.stringify(unique, null, 1));
