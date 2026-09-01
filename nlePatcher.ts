import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { shell } from 'electron';
import { pathToFileURL } from 'url';

export const getExportExtension = (exportFormat: string, inputPath: string): string => {
  switch (exportFormat) {
    case 'final-cut-pro':
    case 'resolve-fcpxml':
    case 'davinci-fcpxml':
      return '.fcpxml';
    case 'resolve':
    case 'resolve-fcp7':
    case 'davinci':
    case 'davinci-xml':
    case 'premiere':
      return '.xml';
    case 'kdenlive':
      return '.kdenlive';
    case 'shotcut':
      return '.mlt';
    case 'json':
      return '.json';
    case 'audio':
      return '.wav';
    case 'default':
    default: {
      const ext = path.extname(inputPath);
      return ext ? ext : '.mp4';
    }
  }
};

export const openTargetNLE = (exportFormat: string, filePath: string) => {
  if (!fs.existsSync(filePath)) return;

  if (process.platform === 'darwin') {
    let candidateBundleIds: string[] = [];
    let candidateApps: string[] = [];

    if (exportFormat === 'resolve' || exportFormat === 'davinci' || exportFormat === 'resolve-fcp7') {
      candidateBundleIds = [
        'com.blackmagic-design.DaVinciResolveLite',
        'com.blackmagic-design.DaVinciResolve',
        'com.blackmagic-design.DaVinciResolveStudio',
      ];
      candidateApps = [
        'DaVinci Resolve',
        'DaVinci Resolve Studio',
        '/Applications/DaVinci Resolve.app',
        '/Applications/DaVinci Resolve/DaVinci Resolve.app',
        '/Applications/DaVinci Resolve Studio.app',
      ];
    } else if (exportFormat === 'premiere') {
      candidateBundleIds = [
        'com.adobe.PremierePro.25',
        'com.adobe.PremierePro.24',
        'com.adobe.PremierePro',
      ];
      candidateApps = [
        'Adobe Premiere Pro',
        'Adobe Premiere Pro 2025',
        'Adobe Premiere Pro 2024',
        'Adobe Premiere Pro 2023',
        'Premiere Pro',
        '/Applications/Adobe Premiere Pro 2025/Adobe Premiere Pro 2025.app',
        '/Applications/Adobe Premiere Pro 2024/Adobe Premiere Pro 2024.app',
      ];
    } else if (exportFormat === 'final-cut-pro') {
      candidateBundleIds = [
        'com.apple.FinalCutApp',
        'com.apple.FinalCut',
      ];
      candidateApps = [
        'Final Cut Pro Creator Studio',
        'Final Cut Pro',
        '/Applications/Final Cut Pro Creator Studio.app',
        '/Applications/Final Cut Pro.app',
      ];
    } else if (exportFormat === 'shotcut') {
      candidateBundleIds = ['com.shotcut.Shotcut'];
      candidateApps = ['Shotcut', '/Applications/Shotcut.app'];
    } else if (exportFormat === 'kdenlive') {
      candidateBundleIds = ['org.kde.kdenlive'];
      candidateApps = ['kdenlive', 'Kdenlive', '/Applications/kdenlive.app'];
    }

    for (const bundleId of candidateBundleIds) {
      try {
        const run = spawnSync('open', ['-b', bundleId, filePath]);
        if (run.status === 0) return;
      } catch {}
    }

    for (const appName of candidateApps) {
      try {
        const run = spawnSync('open', ['-a', appName, filePath]);
        if (run.status === 0) return;
      } catch {}
    }
  }

  shell.openPath(filePath).catch((err) => {
    console.error('Error opening exported file with shell.openPath:', err);
  });
};

export const fixXmlForDaVinciAndPremiere = (xmlPath: string) => {
  try {
    if (!fs.existsSync(xmlPath)) return;
    let content = fs.readFileSync(xmlPath, 'utf8');

    const outMatches = [...content.matchAll(/<out>(\d+)<\/out>/g)].map((m) => parseInt(m[1], 10));
    const maxOut = outMatches.length > 0 ? Math.max(...outMatches) : 0;

    content = content.replace(/<pathurl>(.*?)<\/pathurl>/g, (match, p1) => {
      let rawPath = p1.trim();
      try {
        if (rawPath.startsWith('file://localhost/')) {
          rawPath = decodeURI(rawPath.replace('file://localhost', ''));
        } else if (rawPath.startsWith('file:///')) {
          rawPath = decodeURI(rawPath.replace('file://', ''));
        }
        const encoded = pathToFileURL(rawPath)
          .toString()
          .replace('file:///', 'file://localhost/')
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
        return `<pathurl>${encoded}</pathurl>`;
      } catch {
        return match;
      }
    });

    content = content.replace(/<duration>\s*<\/duration>/g, '');

    if (maxOut > 0) {
      content = content.replace(/(<file\s+id="[^"]+">)([\s\S]*?)(<\/file>)/g, (match, openTag, body, closeTag) => {
        let cleanBody = body.replace(/<duration>\d+<\/duration>/g, '');
        cleanBody = cleanBody.replace(/(<pathurl>[^<]+<\/pathurl>)/, `$1\n              <duration>${maxOut}</duration>`);
        return openTag + cleanBody + closeTag;
      });
    }

    content = content.replace(/<media-rep\s+src="([^"]+)"/g, (match, p1) => {
      let rawSrc = p1.trim();
      try {
        if (rawSrc.startsWith('file:///')) {
          rawSrc = decodeURI(rawSrc.replace('file://', ''));
        }
        const encoded = pathToFileURL(rawSrc)
          .toString()
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
        return `<media-rep src="${encoded}"`;
      } catch {
        return match;
      }
    });

    content = content.replace(/<fcpxml\s+version="1\.11">/g, '<fcpxml version="1.10">');

    content = content.replace(/<project name="([^"]+)">/g, (match, p1) => {
      if (!p1.includes('TrimBin')) {
        return `<project name="${p1} (TrimBin)">`;
      }
      return match;
    });

    fs.writeFileSync(xmlPath, content, 'utf8');
  } catch (err) {
    console.error('Error fixing XML/FCPXML for DaVinci/Premiere:', err);
  }
};

export const fixKdenliveProject = (kdenlivePath: string) => {
  try {
    if (!fs.existsSync(kdenlivePath)) return;
    let content = fs.readFileSync(kdenlivePath, 'utf8');

    let totalDuration = '00:00:00.000';
    const projMatch = content.match(/<tractor\s+[^>]*\bout="([0-9:.]+)"[^>]*>\s*<property\s+name="kdenlive:projectTractor">1<\/property>/) ||
                      content.match(/<property\s+name="kdenlive:projectTractor">1<\/property>[\s\S]*?<track\s+[^>]*\bout="([0-9:.]+)"/);
    if (projMatch) {
      totalDuration = projMatch[1];
    } else {
      const allOuts = [...content.matchAll(/out="(\d{2}:\d{2}:\d{2}\.\d+)"/g)].map(m => m[1]);
      if (allOuts.length > 0) {
        allOuts.sort();
        totalDuration = allOuts[allOuts.length - 1];
      }
    }

    if (totalDuration !== '00:00:00.000') {
      const uuidMatch = content.match(/<property\s+name="kdenlive:uuid">({[^}]+})<\/property>/) ||
                        content.match(/<property\s+name="kdenlive:docproperties\.uuid">({[^}]+})<\/property>/);
      if (uuidMatch) {
        const seqUuid = uuidMatch[1];
        const escapedUuid = seqUuid.replace(/[{}]/g, '\\$&');

        const tractorRegex = new RegExp(`(<tractor\\s+id="${escapedUuid}"\\s+out=")[0-9:.]+(\")`);
        content = content.replace(tractorRegex, `$1${totalDuration}$2`);

        const entryRegex = new RegExp(`(<entry\\s+producer="${escapedUuid}"\\s+out=")[0-9:.]+(\")`);
        content = content.replace(entryRegex, `$1${totalDuration}$2`);

        if (!content.includes('kdenlive:docproperties.activeTimeline')) {
          const activeProps = `    <property name="kdenlive:docproperties.activeTimeline">${seqUuid}</property>\n    <property name="kdenlive:docproperties.activetimeline">${seqUuid}</property>\n    <property name="kdenlive:docproperties.timelines">${seqUuid}</property>\n    <property name="kdenlive:docproperties.activeTrack">1</property>`;
          content = content.replace(
            new RegExp(`(<property\\s+name="kdenlive:docproperties\\.uuid">${escapedUuid}<\\/property>)`),
            `$1\n${activeProps}`
          );
        }

        if (!content.includes('kdenlive:sequenceproperties.activeTrack')) {
          const seqProps = `    <property name="kdenlive:sequenceproperties.activeTrack">1</property>\n    <property name="kdenlive:sequenceproperties.tracksCount">2</property>\n    <property name="kdenlive:sequenceproperties.hasAudio">1</property>\n    <property name="kdenlive:sequenceproperties.hasVideo">1</property>\n    <property name="kdenlive:timeline_active">1</property>\n    <property name="kdenlive:producer_type">17</property>`;
          content = content.replace(
            /(<property\s+name="kdenlive:clipname">Sequence 1<\/property>)/,
            `$1\n${seqProps}`
          );
        }
      }
    }

    fs.writeFileSync(kdenlivePath, content, 'utf8');
  } catch (err) {
    console.error('Error fixing Kdenlive project XML:', err);
  }
};

export const fixShotcutProject = (mltPath: string) => {
  try {
    if (!fs.existsSync(mltPath)) return;
    let content = fs.readFileSync(mltPath, 'utf8');

    const tractorMatch = content.match(/<tractor\s+id="([^"]+)"/);
    const mainTractor = tractorMatch ? tractorMatch[1] : 'tractor0';

    content = content.replace(/(<mlt\b[^>]*\bproducer=")main_bin(")/, `$1${mainTractor}$2`);
    content = content.replace(/<entry\s+producer="([^"]+)"([^>]*)>1<\/entry>/g, '<entry producer="$1"$2 />');

    const chains = [...content.matchAll(/<chain\s+id="([^"]+)"/g)].map((m) => m[1]);
    if (chains.length > 0) {
      const binEntries = chains.map((c) => `    <entry producer="${c}" />`).join('\n');
      content = content.replace(/(<playlist\s+id="main_bin">\s*<property\s+name="xml_retain">1<\/property>)(\s*<\/playlist>)/, `$1\n${binEntries}$2`);
    }

    fs.writeFileSync(mltPath, content, 'utf8');
  } catch (err) {
    console.error('Error fixing Shotcut MLT project XML:', err);
  }
};
