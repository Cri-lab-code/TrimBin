const { packager } = require('@electron/packager');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const APP_NAME = 'TrimBin';
const APP_VERSION = '1.0.1';

const PACKAGER_CONFIG = {
  dir: '.',
  name: APP_NAME,
  platform: 'darwin',
  arch: 'arm64',
  out: 'dist-packager',
  overwrite: true,
  prune: true,
  icon: path.join(__dirname, 'build', 'icon'),
  appBundleId: 'com.trimbin.app',
  appCategoryType: 'public.app-category.video',
  ignore: [
    /^\/frontend\/src/,
    /^\/frontend\/node_modules/,
    /^\/\.git/,
    /^\/docs/,
    /^\/release/,
    /^\/dist-packager/,
    /^\/scratch/,
  ],
};

function injectIcons(appPath) {
  const resDir = path.join(appPath, `${APP_NAME}.app`, 'Contents', 'Resources');
  const icnsSource = path.join(__dirname, 'build', 'icon.icns');

  if (fs.existsSync(resDir) && fs.existsSync(icnsSource)) {
    fs.copyFileSync(icnsSource, path.join(resDir, 'electron.icns'));
    fs.copyFileSync(icnsSource, path.join(resDir, 'TrimBin.icns'));
    fs.copyFileSync(icnsSource, path.join(resDir, 'icon.icns'));
  }

  const helperSource = path.join(__dirname, 'transcribe_helper.py');
  if (fs.existsSync(resDir) && fs.existsSync(helperSource)) {
    fs.copyFileSync(helperSource, path.join(resDir, 'transcribe_helper.py'));
  }
}

function buildDmg(appPath, releaseDir) {
  const dmgPath = path.join(releaseDir, `${APP_NAME}-${APP_VERSION}-arm64-mac.dmg`);
  if (fs.existsSync(dmgPath)) fs.unlinkSync(dmgPath);

  const stagingDir = path.join('/tmp', `trimbin-dmg-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });
  execSync(`cp -R "${path.join(appPath, `${APP_NAME}.app`)}" "${stagingDir}/"`);
  execSync(`ln -s /Applications "${stagingDir}/Applications"`);

  const bgDir = path.join(stagingDir, '.background');
  fs.mkdirSync(bgDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'build', 'dmg-background.png'), path.join(bgDir, 'dmg-background.png'));
  fs.copyFileSync(path.join(__dirname, 'build', 'dmg-background@2x.png'), path.join(bgDir, 'dmg-background@2x.png'));

  const tempDmg = path.join('/tmp', `trimbin-rw-${Date.now()}.dmg`);
  execSync(`hdiutil create -volname "${APP_NAME}" -srcfolder "${stagingDir}" -ov -format UDRW "${tempDmg}" > /dev/null`);

  try {
    const attachOutput = execSync(`hdiutil attach -readwrite -noverify -noautoopen "${tempDmg}"`).toString();
    const mountMatch = attachOutput.match(/\/Volumes\/(.*)/);
    const volumePath = mountMatch ? mountMatch[0].trim() : `/Volumes/${APP_NAME}`;
    const volumeName = mountMatch ? mountMatch[1].trim() : APP_NAME;

    const script = `
      tell application "Finder"
        tell disk "${volumeName}"
          open
          set current view of container window to icon view
          set toolbar visible of container window to false
          set statusbar visible of container window to false
          set the bounds of container window to {100, 100, 760, 500}
          set theViewOptions to the icon view options of container window
          set arrangement of theViewOptions to not arranged
          set icon size of theViewOptions to 120
          set background picture of theViewOptions to file ".background:dmg-background.png"
          set position of item "${APP_NAME}.app" of container window to {175, 195}
          set position of item "Applications" of container window to {485, 195}
          close
          open
          update without registering applications
          delay 1
        end tell
      end tell
    `;

    execSync(`osascript -e '${script}' > /dev/null 2>&1 || true`);
    execSync(`hdiutil detach "${volumePath}" -force > /dev/null 2>&1 || true`);
  } catch (appleScriptErr) {
    console.warn('Layout styling note:', appleScriptErr.message);
  }

  execSync(`hdiutil convert "${tempDmg}" -format UDZO -imagekey zlib-level=9 -o "${dmgPath}" > /dev/null`);
  if (fs.existsSync(tempDmg)) fs.unlinkSync(tempDmg);
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

function buildPkg(appPath, releaseDir) {
  const pkgPath = path.join(releaseDir, `${APP_NAME}-${APP_VERSION}-arm64-mac.pkg`);
  if (fs.existsSync(pkgPath)) fs.unlinkSync(pkgPath);

  const compPlist = path.join('/tmp', `trimbin-comp-${Date.now()}.plist`);
  const corePkg = path.join('/tmp', `trimbin-core-${Date.now()}.pkg`);

  execSync(`pkgbuild --analyze --root "${appPath}" "${compPlist}"`);
  let plistContent = fs.readFileSync(compPlist, 'utf-8');
  plistContent = plistContent
    .replace(/<key>BundleIsRelocatable<\/key>\s*<true\/>/g, '<key>BundleIsRelocatable</key><false/>')
    .replace(/<key>BundleOverwriteAction<\/key>\s*<string><\/string>/g, '<key>BundleOverwriteAction</key><string>upgrade</string>');
  fs.writeFileSync(compPlist, plistContent, 'utf-8');

  execSync(`pkgbuild --root "${appPath}" --component-plist "${compPlist}" --install-location /Applications "${corePkg}"`);
  execSync(`productbuild --package "${corePkg}" /Applications "${pkgPath}"`);

  if (fs.existsSync(compPlist)) fs.unlinkSync(compPlist);
  if (fs.existsSync(corePkg)) fs.unlinkSync(corePkg);
}

function buildZip(appPath, releaseDir) {
  const zipPath = path.join(releaseDir, `${APP_NAME}-${APP_VERSION}-arm64-mac.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`cd "${path.dirname(appPath)}" && zip -r -y -q "${zipPath}" "${path.basename(appPath)}/${APP_NAME}.app"`);
}

async function bundle() {
  console.log(`Packaging ${APP_NAME} for macOS (Apple Silicon arm64)...`);

  try {
    execSync('bash scripts/generate-icns.sh', { stdio: 'inherit' });
    execSync('bun scripts/generate-dmg-background.js', { stdio: 'inherit' });

    const distPackager = path.join(__dirname, 'dist-packager');
    if (fs.existsSync(distPackager)) {
      fs.rmSync(distPackager, { recursive: true, force: true });
    }

    const appPaths = await packager(PACKAGER_CONFIG);
    const appPath = appPaths[0];

    injectIcons(appPath);
    execSync(`codesign --force --deep --sign - "${path.join(appPath, `${APP_NAME}.app`)}"`);

    const releaseDir = path.join(__dirname, 'release');
    fs.mkdirSync(releaseDir, { recursive: true });

    buildDmg(appPath, releaseDir);
    buildPkg(appPath, releaseDir);
    buildZip(appPath, releaseDir);

    console.log(`Release artifacts generated in ${releaseDir}/`);
  } catch (err) {
    console.error('Packaging failed:', err);
    process.exit(1);
  }
}

bundle();
