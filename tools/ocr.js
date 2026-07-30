const fs = require('fs');
const { createWorker } = require('tesseract.js');

(async () => {
  const unique = JSON.parse(fs.readFileSync('swatch-work/unique.json'));
  const worker = await createWorker('eng', 1, { langPath: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int', gzip: true });
  await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ' });
  let done = 0;
  for (const u of unique) {
    const { data } = await worker.recognize(`swatch-work/${u.id}-label.png`);
    const text = data.text.replace(/\s+/g, ' ').trim();
    const code = (text.match(/KK\s?(\d{4,6})/) || [])[1] != null
      ? 'KK' + text.match(/KK\s?(\d{4,6})/)[1]
      : (text.match(/\b(\d{3,4})\b(?!.*\b\d{3,4}\b)/) || [])[1] || null;
    u.ocrText = text;
    u.code = code;
    done++;
    if (done % 40 === 0) console.log(done, '/', unique.length);
  }
  await worker.terminate();
  fs.writeFileSync('swatch-work/unique.json', JSON.stringify(unique, null, 1));
  const missing = unique.filter(u => !u.code);
  console.log('done. missing code:', missing.length, missing.map(m => m.id).join(', '));
})();
