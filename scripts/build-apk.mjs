import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localProps = join(root, 'android', 'local.properties');
const sdkPath = process.env.ANDROID_HOME || 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk';

if (!existsSync(localProps)) {
  writeFileSync(localProps, `sdk.dir=${sdkPath.replace(/\\/g, '\\\\')}\n`);
}

const androidDir = join(root, 'android');
const res = spawnSync('gradlew.bat', ['assembleDebug'], {
  cwd: androidDir,
  shell: true,
  stdio: 'inherit'
});

process.exit(res.status ?? 1);