import { spawnSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const tscEntryPoint = path.join(
  rootDir,
  'node_modules',
  'typescript',
  'lib',
  'tsc.js'
);

await rm(path.join(rootDir, '.test-dist'), {
  force: true,
  recursive: true,
});

run(process.execPath, [tscEntryPoint, '-p', 'tsconfig.test.json']);

const testFiles = (await readdir(path.join(rootDir, 'tests')))
  .filter((fileName) => fileName.endsWith('.test.cjs'))
  .map((fileName) => path.join('tests', fileName));

run(process.execPath, ['--test', ...testFiles]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
