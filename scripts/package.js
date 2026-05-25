// Post-build: apply custom icon to exe and rebuild installer
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const RCEDIT = path.join(ROOT, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
const ICON = path.join(ROOT, 'assets', 'ico', 'ico_256x256.ico');
const EXE = path.join(ROOT, 'output', 'win-unpacked', 'TimeManager.exe');

try {
  console.log('• Packing app...');
  execSync('npx electron-builder', { cwd: ROOT, stdio: 'inherit' });

  console.log('• Applying custom icon...');
  const rceditPath = path.join(ROOT, 'scripts', 'tools', 'rcedit-x64.exe');
  if (!fs.existsSync(rceditPath)) {
    console.error('  rcedit not found at', rceditPath);
    process.exit(1);
  }
  execSync(`"${rceditPath}" "${EXE}" --set-icon "${ICON}"`, { stdio: 'inherit' });
  console.log('  Custom icon applied OK');

  // Remove old installer artifacts
  const oldSetup = path.join(ROOT, 'output', 'TimeManager Setup 1.0.0.exe');
  const oldBlockmap = oldSetup + '.blockmap';
  if (fs.existsSync(oldSetup)) fs.unlinkSync(oldSetup);
  if (fs.existsSync(oldBlockmap)) fs.unlinkSync(oldBlockmap);

  console.log('• Rebuilding installer with custom icon...');
  execSync(`npx electron-builder --prepackaged "${path.join(ROOT, 'output', 'win-unpacked')}" --win --x64`, { cwd: ROOT, stdio: 'inherit' });

  console.log('✓ Package complete!');
} catch (e) {
  console.error('Package failed:', e.message);
  process.exit(1);
}
