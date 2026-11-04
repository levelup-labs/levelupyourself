import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function handler({ user = { id: 'player-a' }, rows = [], rejectOrigin = false } = {}) {
  let scope, values, accessed = false;
  const chain = {
    from() { return this; },
    where(value) { scope = value; return this; },
    values(value) { values = value; return this; },
    orderBy() { return this; },
    limit() { return this; },
    returning() { return this; },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  const db = { select: () => chain, insert: () => chain, delete: () => chain };
  const mocks = {
    '@netlify/identity': { getUser: async () => user, refreshSession: async () => null,
      verifyRequestOrigin: () => { if (rejectOrigin) throw Error(); } },
    'drizzle-orm': { eq: (column, value) => [column, value], and: (...args) => args, desc: (column) => column },
    '../../db/index.js': { database: () => { accessed = true; return db; } },
    '../../db/schema.js': { sharedGoals: { id: 'id', userId: 'user_id', createdAt: 'created_at' } },
  };
  const source = stripTypeScriptTypes(await readFile('netlify/functions/shared-goals.mts', 'utf8'));
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
const goal = { name: '10 km laufen', desc: 'Schritt für Schritt', quests: [{ title: 'Erster Lauf', xp: 100, attr: 'koerper', target: 3 }] };
const send = (method, body) => new Request('https://example.test/.netlify/functions/shared-goals', {
  method, headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' }, body: JSON.stringify(body),
});

test('shared goals require a signed-in user', async () => {
  const h = await handler({ user: null });
  assert.equal((await h.run(new Request('https://example.test/shared-goals'))).status, 401);
  assert.equal(h.accessed(), false);
});
test('cross-origin shares cannot reach the database', async () => {
  const h = await handler({ rejectOrigin: true });
  assert.equal((await h.run(send('POST', goal))).status, 403);
  assert.equal(h.accessed(), false);
});
test('the list never exposes author IDs and marks own goals', async () => {
  const h = await handler({ rows: [
    { id: 'g1', userId: 'player-a', name: 'A', description: '', quests: [], createdAt: 'x' },
    { id: 'g2', userId: 'player-b', name: 'B', description: '', quests: [], createdAt: 'y' },
  ] });
  const { goals } = await (await h.run(new Request('https://example.test/shared-goals'))).json();
  assert.deepEqual(goals.map((g) => g.mine), [true, false]);
  assert.ok(goals.every((g) => !('userId' in g) && !('user_id' in g)));
});
test('new shares are stored under the authenticated ID with cleaned fields', async () => {
  const h = await handler();
  const response = await h.run(send('POST', { ...goal, userId: 'player-b', name: '  10 km laufen  ', extra: 'x' }));
  assert.equal(response.status, 200);
  assert.equal(h.values().userId, 'player-a');
  assert.equal(h.values().name, '10 km laufen');
  assert.equal('extra' in h.values(), false);
});
test('invalid goals are rejected', async () => {
  const h = await handler();
  for (const bad of [{ ...goal, name: '' }, { ...goal, quests: [] }, { ...goal, quests: [{ ...goal.quests[0], xp: 9999 }] },
    { ...goal, quests: [{ ...goal.quests[0], attr: 'hacker' }] }, { ...goal, quests: Array(26).fill(goal.quests[0]) }]) {
    assert.equal((await h.run(send('POST', bad))).status, 400);
  }
});
test('players can only share a limited number of goals', async () => {
  const h = await handler({ rows: Array(30).fill({ id: 'x' }) });
  assert.equal((await h.run(send('POST', goal))).status, 429);
});
test('withdrawing is scoped to the author', async () => {
  const h = await handler({ rows: [{ id: 'g1' }] });
  assert.equal((await h.run(send('DELETE', { id: 'g1' }))).status, 200);
  assert.equal(JSON.stringify(h.scope()), JSON.stringify([['id', 'g1'], ['user_id', 'player-a']]));
});
test('withdrawing someone else\'s goal finds nothing', async () => {
  const h = await handler({ rows: [] });
  assert.equal((await h.run(send('DELETE', { id: 'g2' }))).status, 404);
});
