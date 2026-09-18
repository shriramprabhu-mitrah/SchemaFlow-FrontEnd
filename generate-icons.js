const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const iconsDir = path.join(rootDir, 'src', 'assets', 'icons');
const outputFile = path.join(rootDir, 'src', 'app', 'core', 'component', 'icons', 'generated-icons.ts');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const svgFiles = fs
  .readdirSync(iconsDir)
  .filter((file) => file.endsWith('.svg'))
  .sort();

const iconEntries = svgFiles.map((file) => {
  const iconName = path.basename(file, '.svg');
  let content = fs.readFileSync(path.join(iconsDir, file), 'utf8').trim();
  content = content.replace(/<\?xml[\s\S]*?\?>\s*/g, '').trim();
  return `  ${JSON.stringify(iconName)}: ${JSON.stringify(content)}`;
});

const output = `export const iconRegistry: Record<string, string> = {\n${iconEntries.join(',\n')}\n};\n`;

fs.writeFileSync(outputFile, output);