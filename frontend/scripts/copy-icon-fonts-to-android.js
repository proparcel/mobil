/**
 * Ionicons / MaterialCommunityIcons → android/app/src/main/assets/fonts
 * android/ gitignore'da oldugu icin postinstall + preandroid ile otomatik kopyalanir.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoFonts = path.join(root, 'assets', 'fonts');
const npmFonts = path.join(root, 'node_modules', 'react-native-vector-icons', 'Fonts');
const androidFonts = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'fonts');

const FONT_FILES = ['Ionicons.ttf', 'MaterialCommunityIcons.ttf'];

function copyFile(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function resolveSource(name) {
  const inRepo = path.join(repoFonts, name);
  if (fs.existsSync(inRepo)) return inRepo;
  const inNpm = path.join(npmFonts, name);
  if (fs.existsSync(inNpm)) return inNpm;
  return null;
}

if (!fs.existsSync(path.join(root, 'android'))) {
  process.exit(0);
}

let copied = 0;
for (const name of FONT_FILES) {
  const src = resolveSource(name);
  if (src && copyFile(src, path.join(androidFonts, name))) copied += 1;
}

if (copied === 0) {
  console.warn('[copy-icon-fonts] Uyari: hic font kopyalanmadi (npm install calisti mi?)');
} else if (process.env.CI !== 'true') {
  console.log(`[copy-icon-fonts] ${copied} font android/assets/fonts altina kopyalandi`);
}
