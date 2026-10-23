"use strict";

import { spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import referee from '@sinonjs/referee';
import { fileURLToPath } from 'url';

const assert = referee.assert;
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const tscBin = path.join(
  path.dirname(require.resolve('typescript/package.json')),
  require('typescript/package.json').bin.tsc
);

function runTsc(args, cwd) {
  return spawnSync(process.execPath, [tscBin, ...args], { cwd, encoding: 'utf8' });
}

describe('bagofcli - typescript', function () {
  this.timeout(60000);

  let tempDir;

  beforeEach(function () {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'bagofcli-typescript-'));
  });

  afterEach(function () {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should have lib/bagofcli.d.ts up to date with the JSDoc in lib/bagofcli.js (run `npm run types` when this fails)', function () {
    // run the same command as the types script, only into a temporary directory
    const args = pkg.scripts.types.split(/\s+/);
    assert.equals(args[0], 'tsc');
    const outDirIndex = args.indexOf('--outDir');
    assert.equals(args[outDirIndex + 1], 'lib');
    args[outDirIndex + 1] = tempDir;

    const result = runTsc(args.slice(1), repoRoot);

    assert.equals(result.stdout + result.stderr, '');
    assert.equals(result.status, 0);
    assert.equals(
      readFileSync(path.join(tempDir, 'bagofcli.d.ts'), 'utf8'),
      readFileSync(path.join(repoRoot, 'lib', 'bagofcli.d.ts'), 'utf8')
    );
  });

  it('should point package.json types to the declaration file', function () {
    assert.equals(pkg.types, './lib/bagofcli.d.ts');
  });

  it('should type-check a TypeScript consumer importing bagofcli under strict mode', function () {
    // the consumer resolves bagofcli via node_modules, just like an installed package,
    // so that package.json types is what points TypeScript to the declarations
    mkdirSync(path.join(tempDir, 'node_modules'));
    symlinkSync(repoRoot, path.join(tempDir, 'node_modules', 'bagofcli'), 'dir');
    copyFileSync(
      path.join(__dirname, 'fixtures', 'typescript', 'consumer.ts'),
      path.join(tempDir, 'consumer.ts')
    );
    writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'es2022',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        // check the published declarations too, not only the consumer
        skipLibCheck: false,
        types: ['node'],
        typeRoots: [path.join(repoRoot, 'node_modules', '@types')]
      },
      files: ['consumer.ts']
    }));

    const result = runTsc(['-p', tempDir], tempDir);

    assert.equals(result.stdout + result.stderr, '');
    assert.equals(result.status, 0);
  });

  it('should include the declaration files in the published package', function () {
    // --ignore-scripts skips prepack, which would regenerate lib/bagofcli.d.ts
    const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equals(result.status, 0);
    const packedFiles = JSON.parse(result.stdout)[0].files.map((file) => file.path);
    assert.isTrue(packedFiles.includes('lib/bagofcli.d.ts'));
    assert.isTrue(packedFiles.includes('lib/types.d.ts'));
    assert.isTrue(packedFiles.includes('lib/bagofcli.js'));
  });
});
