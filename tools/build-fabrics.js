const fs = require('fs');

// Codes read by me from the contact sheets, overriding/completing OCR
const CORRECTIONS = {
  'canvas-10_1': '0726', 'canvas-nature_0': 'KK47000',
  'capture_0': '4001', 'capture_1': '4101', 'capture_2': '4102',
  'capture-10_0': '6301', 'capture-10_1': '6302',
  'capture-11_0': '6501', 'capture-11_1': '6601', 'capture-11_2': '6602',
  'capture-12_0': '6701', 'capture-12_1': '6801',
  'capture-13_0': '7001', 'capture-13_2': '7201', 'capture-14_1': '7401',
  'capture-2_0': '4301', 'capture-2_1': '4401', 'capture-2_2': '4501',
  'capture-3_0': '4601', 'capture-3_1': '4702', 'capture-3_2': '4801',
  'capture-4_0': '4802', 'capture-4_1': '4803', 'capture-4_2': '4901',
  'capture-5_0': '4902', 'capture-5_1': '5001', 'capture-5_2': '5002',
  'capture-6_0': '5101', 'capture-6_1': '5102', 'capture-6_2': '5103',
  'capture-7_1': '5301', 'capture-8_0': '5402',
  'capture-9_0': '6101', 'capture-9_1': '6201', 'capture-9_2': '6202',
  'clara_0': '0144', 'clara_1': '0148', 'clara_2': '0184',
  'clara-2_0': '0188', 'clara-2_2': '0248',
  'clara-3_0': '0273', 'clara-3_1': '0277', 'clara-3_2': '0384',
  'clara-4_0': '0388', 'clara-4_1': '0423', 'clara-4_2': '0427',
  'clara-5_0': '0544', 'clara-5_1': '0548', 'clara-5_2': '0643',
  'clara-6_0': '0647', 'clara-7_0': '0933',
  'clara-8_0': '0884', 'clara-8_1': '0888',
  'divina-melange-11_0': '0777',
  'fiord_0': '0101', 'fiord_2': '0151',
  'fiord-11_1': '0821', 'fiord-11_2': '0862',
  'fiord-3_0': '0251', 'fiord-3_1': '0262', 'fiord-4_0': '0322',
  'fiord-5_1': '0422', 'fiord-7_1': '0571',
  'hallingdal_0': '0100', 'hallingdal_1': '0103', 'hallingdal_2': '0110',
  'hallingdal-12_2': '0840', 'hallingdal-15_1': '0526', 'hallingdal-16_2': '0590',
  'hallingdal-2_0': '0113', 'hallingdal-2_1': '0123', 'hallingdal-2_2': '0116',
  'hallingdal-3_0': '0126', 'hallingdal-3_1': '0130', 'hallingdal-4_1': '0166',
  'hallingdal-5_2': '0200', 'hallingdal-6_0': '0220', 'hallingdal-7_0': '0270',
  'hallingdal-7_2': '0368', 'hallingdal-9_0': '0407', 'hallingdal-9_1': '0420',
  'mood_0': '1101', 'mood_1': '1103', 'mood_2': '1104',
  'mood-2_0': '1105', 'mood-2_1': '1106', 'mood-4_2': '3101',
  'mood-7_1': '4105', 'mood-7_2': '4106',
  'rewool_0': '0108', 'rewool_1': '0128',
  'rewool-2_1': '0218', 'rewool-3_1': '0408',
  'rewool-5_0': '0628', 'rewool-5_1': '0648', 'rewool-5_2': '0658',
  'rewool-6_0': '0718', 'rewool-6_2': '0768',
  'rewool-7_0': '0828', 'rewool-7_1': '0858', 'rewool-7_2': '0868',
};

const META = {
  'canvas':         { name: 'Canvas 2', info: '90% ull i worsted-kvalitet, 10% nylon' },
  'canvas-nature':  { name: 'Canvas Natur', info: '100% naturlint' },
  'capture':        { name: 'Capture', info: '85% nyzeeländsk ull, 15% polyamid' },
  'clara':          { name: 'Clara 2', info: '92% ull i worsted-kvalitet, 8% nylon' },
  'divina-melange': { name: 'Divina Melange 3', info: '100% ny ull' },
  'fiord':          { name: 'Fiord 2', info: '92% ull i worsted-kvalitet, 8% nylon' },
  'hallingdal':     { name: 'Hallingdal 65', info: '70% ull, 30% viskos' },
  'mood':           { name: 'Mood', info: '92% nyzeeländsk ull, 8% polyamid' },
  'remix':          { name: 'Remix 3', info: '90% ny ull i worsted-kvalitet, 10% nylon' },
  'rewool':         { name: 'Re-wool', info: '45% ny ull i worsted-kvalitet, 45% återvunnen ull, 10% nylon' },
};
const ORDER = ['canvas', 'canvas-nature', 'capture', 'clara', 'divina-melange',
               'fiord', 'hallingdal', 'mood', 'remix', 'rewool'];

const unique = JSON.parse(fs.readFileSync('swatch-work/unique.json'));
for (const u of unique) {
  u.code = CORRECTIONS[u.id] || u.codeRaw;
  if (!u.code) throw new Error(`no code for ${u.id}`);
}

const outDir = '/home/user/sideways-colors/public/fabrics';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const fabrics = [];
for (const cat of ORDER) {
  const items = unique.filter(u => u.category === cat)
    .sort((a, b) => (parseInt(a.code.replace('KK', ''), 10)) - (parseInt(b.code.replace('KK', ''), 10)));
  const seen = {};
  const colors = items.map(u => {
    seen[u.code] = (seen[u.code] || 0) + 1;
    const id = seen[u.code] > 1 ? `${u.code}b` : u.code;
    if (seen[u.code] > 1) console.log(`NOTE: duplicate code in ${cat}: ${u.code} (${u.id}) -> id ${id}`);
    const file = `${cat}-${id}.jpg`;
    fs.copyFileSync(`swatch-work/${u.id}.jpg`, `${outDir}/${file}`);
    return { id, code: u.code, tile: `public/fabrics/${file}`, hex: u.hex };
  });
  fabrics.push({ id: cat, name: META[cat].name, info: META[cat].info, colors });
  console.log(cat, colors.length, ':', colors.map(c => c.id).join(' '));
}

const lines = [];
lines.push('const FABRICS = [');
for (const f of fabrics) {
  lines.push('  {');
  lines.push(`    id: ${JSON.stringify(f.id)},`);
  lines.push(`    name: ${JSON.stringify(f.name)},`);
  lines.push(`    info: ${JSON.stringify(f.info)},`);
  lines.push('    colors: [');
  for (const c of f.colors) {
    lines.push(`      { id: ${JSON.stringify(c.id)}, code: ${JSON.stringify(c.code)}, tile: ${JSON.stringify(c.tile)}, hex: ${JSON.stringify(c.hex)} },`);
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('];');
fs.writeFileSync('fabrics-snippet.js', lines.join('\n'));
console.log('total colors:', fabrics.reduce((s, f) => s + f.colors.length, 0));
