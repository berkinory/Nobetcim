import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const commit = 'a07da7020810d3a975524daad2a544c9205ea65e';
const outputs = process.argv.slice(2);
if (!outputs.length) throw new Error('Pass the public/openanalytics-v0.8.0.js output paths.');
const temp = await mkdtemp(join(tmpdir(), 'openanalytics-tracker-'));
try {
  const response = await fetch(`https://github.com/OpenLabs-so/openanalytics/archive/${commit}.tar.gz`);
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
  const archive = join(temp, 'source.tgz');
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  const untar = Bun.spawn(['tar', '-xzf', archive, '-C', temp]);
  if (await untar.exited !== 0) throw new Error('Source extraction failed.');
  const root = join(temp, `openanalytics-${commit}`, 'apps/tracker');
  const entry = join(root, 'src/browser.ts');
  const original = await readFile(entry, 'utf8');
  const needle = '    ...options,\n    ...fetchDeps,';
  if (original.split(needle).length !== 2) throw new Error('Upstream bootstrap changed; review required.');
  // The upstream first pageview precedes the asynchronous settings fetch.
  const replacement = `    ...options,
    config: {
      redactQueryKeys: (script?.getAttribute('data-redact-query-keys') ?? '')
        .split(',').map((key) => key.trim().toLowerCase()).filter(Boolean),
      disabled: (() => {
        const domain = script?.getAttribute('data-domain');
        return domain ? !isHostAllowed(win.location.hostname, [new URL(domain).hostname]) : false;
      })(),
      features: { web_vitals: true, engagement: true, interactions: false, heartbeat: true },
    },
    ...fetchDeps,`;
  await writeFile(entry, original.replace(needle, replacement));
  const result = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'iife', minify: true });
  if (!result.success) throw new Error('Tracker compilation failed.');
  const license = await readFile(join(root, 'LICENSE'), 'utf8');
  const bundle = `/*! OpenAnalytics tracker v0.8.0 (${commit})\n${license}\nLocal change: initial query redaction, domain guard and disabled interactions.\nRebuild with scripts/build-openanalytics.mjs. */\n` + await result.outputs[0].text();
  for (const output of outputs) await Bun.write(output, bundle);
  console.log(`Built ${outputs.length} tracker assets (${Buffer.byteLength(bundle)} bytes each).`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
