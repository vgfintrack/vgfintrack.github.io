// Runs the AmrPotli tests against a checkout of the site (the main branch).
//
//   node run.mjs              everything
//   node run.mjs app          the app's browser tests
//   node run.mjs site         the website check
//   node run.mjs firebase     rules, dashboard and app counts, on local emulators
//   node run.mjs shop prof    single tests by name
//
// The site folder is AMRPOTLI_SITE, or ../vgfintrack.github.io next to this kit.
// Nothing here talks to the real Firebase project or Google Drive: the tests
// use local emulators, fake Google sign-in and made-up people and money.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const KIT = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(process.env.AMRPOTLI_SITE || join(KIT, '..', 'vgfintrack.github.io'));
const OUT = join(KIT, 'out'); // screenshots and the site copy; not kept in git
if (!existsSync(join(SITE, 'AmrPotli', 'index.html'))) {
  console.error(`No AmrPotli site at ${SITE}. Set AMRPOTLI_SITE to the main branch checkout.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const env = { ...process.env, AMRPOTLI_SITE: SITE };
const bin = (name) => join(KIT, 'node_modules', '.bin', name);

const free = (port) => new Promise((ok) => { const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true))).listen(port, '127.0.0.1'); });
const servers = [];
async function serve(dir, port, extra = []) {
  if (!(await free(port))) return console.log(`(port ${port} already serving, reusing it)`);
  servers.push(spawn(bin('http-server'), [dir, '-p', String(port), '-c-1', '-s', ...extra], { stdio: 'ignore' }));
  for (let i = 0; i < 50 && (await free(port)); i++) await new Promise((r) => setTimeout(r, 100));
}

// The offline test needs its own copy of the site, in demo mode, to change.
function siteCopy() {
  const copy = join(OUT, 'sitecopy');
  rmSync(copy, { recursive: true, force: true });
  mkdirSync(copy, { recursive: true });
  const files = execSync(`git -C "${SITE}" ls-files -co --exclude-standard -z`).toString().split('\0').filter(Boolean);
  for (const f of files) {
    if (!existsSync(join(SITE, f))) continue; // deleted, not yet committed
    mkdirSync(dirname(join(copy, f)), { recursive: true });
    copyFileSync(join(SITE, f), join(copy, f));
  }
  writeFileSync(join(copy, 'AmrPotli', 'js', 'config.js'), "export const googleClientId = 'REPLACE_ME';\n");
  return copy;
}

const run = (file, cmd = ['node', [file]]) =>
  new Promise((done) => {
    let out = '';
    const p = spawn(cmd[0], cmd[1], { cwd: OUT, env });
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => {
      const good = (out.match(/✅/g) || []).length;
      const bad = out.split('\n').filter((l) => l.includes('❌') || /Error|Timeout/.test(l)).slice(0, 4);
      console.log(`${code === 0 && !bad.length ? 'PASS' : 'FAIL'}  ${file.replace(KIT + '/', '')}: ${good} ok${bad.length ? '\n      ' + bad.join('\n      ') : ''}`);
      done(code === 0 && !bad.length);
    });
  });

const list = (dir) => readdirSync(join(KIT, dir)).filter((f) => f.endsWith('.test.mjs')).map((f) => join(KIT, dir, f));
const args = process.argv.slice(2);
const groups = { app: list('app'), site: list('site'), firebase: list('firebase') };
const want = !args.length ? ['app', 'site', 'firebase'] : args;
const picked = want.flatMap((a) => groups[a] || Object.values(groups).flat().filter((f) => f.endsWith(`/${a}.test.mjs`)));
if (!picked.length) { console.error('No tests match', args.join(' ')); process.exit(1); }

await serve(SITE, 8090);
if (picked.some((f) => f.endsWith('/offline.test.mjs'))) await serve(siteCopy(), 8091, []);
let failed = 0;
for (const f of picked.filter((f) => !f.includes('/firebase/'))) failed += !(await run(f));
const fb = picked.filter((f) => f.includes('/firebase/'));
if (fb.length) {
  // The emulators read the rules from the site, so a test sees the rules as they are now.
  copyFileSync(join(SITE, 'firebase', 'firestore.rules'), join(KIT, 'firestore.rules'));
  for (const f of fb)
    failed += !(await run(f, [bin('firebase'), ['emulators:exec', '--config', join(KIT, 'firebase.json'), '--only', 'firestore,auth', '--project', 'demo-amrpotli', `node ${f}`]]));
}
servers.forEach((s) => s.kill());
console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
