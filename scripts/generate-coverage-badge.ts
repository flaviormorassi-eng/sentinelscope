import fs from 'fs';
import path from 'path';

function main() {
  const summaryPath = path.join('coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error('coverage-summary.json not found');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const pct: number = data.total?.lines?.pct ?? 0;
  const color = pct >= 90 ? '#4c1' : pct >= 80 ? '#97CA00' : pct >= 70 ? '#dfb317' : '#e05d44';
  const label = 'coverage';
  const value = pct.toFixed(1) + '%';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="140" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="70" height="20" fill="#555"/>
    <rect x="70" width="70" height="20" fill="${color}"/>
    <rect width="140" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="355" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="600">${label}</text>
    <text x="355" y="150" transform="scale(.1)" textLength="600">${label}</text>
    <text aria-hidden="true" x="1055" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="600">${value}</text>
    <text x="1055" y="150" transform="scale(.1)" textLength="600">${value}</text>
  </g>
</svg>`;
  fs.writeFileSync('coverage-badge.svg', svg, 'utf8');
  console.log(`Generated coverage-badge.svg (${value})`);
}

main();
