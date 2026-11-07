import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule } from 'node:vm';

async function load() {
  const module = new SourceTextModule(stripTypeScriptTypes(await readFile('netlify/lib/keep-signed-in.ts', 'utf8')));
  await module.link(() => { throw new Error('no imports expected'); });
  await module.evaluate();
  return module.namespace;
}
function jar(initial = {}) {
  const sent = [];
  return { sent, get: (name) => initial[name], set(input) { sent.push(input); }, delete() {} };
}

test('auth cookies set during login get an expiry date', async () => {
  const { keepSignedIn } = await load();
  const cookies = jar(); globalThis.Netlify = { context: { cookies } };
  keepSignedIn();
  cookies.set({ name: 'nf_jwt', value: 'a', path: '/' });
  cookies.set({ name: 'other', value: 'b' });
  assert.ok(cookies.sent[0].expires instanceof Date);
  assert.ok(cookies.sent[0].expires.getTime() > Date.now() + 50 * 86_400_000);
  assert.equal(cookies.sent[1].expires, undefined);
});

test('existing session cookies are renewed, refreshed ones are not overwritten', async () => {
  const { keepSignedIn, renewSignIn } = await load();
  const cookies = jar({ nf_jwt: 'old-jwt', nf_refresh: 'r' }); globalThis.Netlify = { context: { cookies } };
  keepSignedIn();
  cookies.set({ name: 'nf_jwt', value: 'new-jwt' });
  renewSignIn();
  assert.deepEqual(cookies.sent.map((c) => [c.name, c.value]), [['nf_jwt', 'new-jwt'], ['nf_refresh', 'r']]);
  assert.ok(cookies.sent.every((c) => c.expires instanceof Date));
});

test('does nothing outside the Netlify runtime', async () => {
  const { keepSignedIn, renewSignIn } = await load();
  delete globalThis.Netlify;
  keepSignedIn(); renewSignIn();
});
