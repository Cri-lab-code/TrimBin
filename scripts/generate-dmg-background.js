const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const width = 660;
const height = 400;
const scale = 2; // Retina @2x (1320x800)

const svgPath = path.join(__dirname, '..', 'assets', 'dmg-background.svg');
let svg = '';
try {
  svg = fs.readFileSync(svgPath, 'utf8');
} catch (err) {
  console.error('Failed to read dmg-background.svg:', err);
  process.exit(1);
}

async function main() {
  const buildDir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const out2x = path.join(buildDir, 'dmg-background@2x.png');
  const out1x = path.join(buildDir, 'dmg-background.png');

  console.log('Rendering high-res DMG background image...');
  await sharp(Buffer.from(svg))
    .png()
    .toFile(out2x);

  await sharp(out2x)
    .resize(width, height)
    .png()
    .toFile(out1x);

  console.log('Generated:', out1x, 'and', out2x);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
