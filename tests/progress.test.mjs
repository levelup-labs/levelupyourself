import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule, Script } from 'node:vm';

async function handler({ user = { id: 'player-a' }, rows = [], rejectOrigin = false } = {}) {
  let scope, values, accessed = false;
  const chain = {
    from() { return this; },
    where(value) { scope = value; return this; },
    values(value) { values = value; return this; },
    set(value) { values = value; return this; },
    onConflictDoNothing() { return this; },
    returning() { return this; },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  const db = { select: () => chain, insert: () => chain, update: () => chain };
  const mocks = {
    '@netlify/identity': { getUser: async () => user, refreshSession: async () => null,
      verifyRequestOrigin: () => { if (rejectOrigin) throw Error(); } },
    'drizzle-orm': { eq: (column, value) => [column, value], and: (...args) => args },
    '../../db/index.js': { database: () => { accessed = true; return db; } },
    '../lib/keep-signed-in.js': { keepSignedIn: () => {} },
    '../../db/schema.js': { progress: { userId: 'user_id', version: 'version' } },
  };
  const source = stripTypeScriptTypes(await readFile('netlify/functions/progress.mts', 'utf8'));
  const module = new SourceTextModule(source);
  await module.link((name) => {
    const exports = mocks[name];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { run: module.namespace.default, scope: () => scope, values: () => values, accessed: () => accessed };
}
const state = { name: 'Alex', quests: [], goals: [], special: [] };
const put = (body) => new Request('https://example.test/.netlify/functions/progress', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' }, body: JSON.stringify(body),
});

test('unauthenticated requests cannot read the database', async () => {
  const h = await handler({ user: null });
  assert.equal((await h.run(new Request('https://example.test/progress'))).status, 401);
  assert.equal(h.accessed(), false);
});
test('cross-origin writes cannot reach the database', async () => {
  const h = await handler({ rejectOrigin: true });
  assert.equal((await h.run(put({ state, version: 0 }))).status, 403);
  assert.equal(h.accessed(), false);
});
test('reads are scoped to the authenticated user', async () => {
  const h = await handler({ rows: [{ state, version: 2 }] });
  const response = await h.run(new Request('https://example.test/progress?userId=player-b'));
  assert.deepEqual(h.scope(), ['user_id', 'player-a']);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).version, 2);
});
test('new saves use the authenticated ID instead of a client supplied ID', async () => {
  const h = await handler({ rows: [{ version: 1 }] });
  const response = await h.run(put({ userId: 'player-b', state, version: 0 }));
  assert.equal(response.status, 200);
  assert.equal(h.values().userId, 'player-a');
});
test('updates require matching account and revision', async () => {
  const h = await handler({ rows: [{ version: 3 }] });
  assert.equal((await h.run(put({ state, version: 2 }))).status, 200);
  assert.equal(JSON.stringify(h.scope()), JSON.stringify([['user_id', 'player-a'], ['version', 2]]));
});
test('stale progress returns a conflict instead of overwriting', async () => {
  const h = await handler();
  assert.equal((await h.run(put({ state, version: 2 }))).status, 409);
});
test('malformed progress is rejected', async () => {
  const h = await handler();
  assert.equal((await h.run(put({ state: {}, version: 0 }))).status, 400);
});
test('browser JavaScript parses', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Script(match[1]);
});
