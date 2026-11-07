import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';
import { and, eq } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { progress } from '../../db/schema.js';
import { keepSignedIn } from '../lib/keep-signed-in.js';

export default async (req: Request) => {
  const reply = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  if (!['GET', 'PUT'].includes(req.method)) return reply({ error: 'Methode nicht erlaubt.' }, 405);
  if (req.method === 'PUT') {
    try { verifyRequestOrigin(req); } catch { return reply({ error: 'Zugriff verweigert.' }, 403); }
  }
  try {
    keepSignedIn();
    await refreshSession();
    const user = await getUser();
    if (!user) return reply({ error: 'Bitte erneut anmelden.' }, 401);
    const db = database();
    if (req.method === 'GET') {
      const [row] = await db.select().from(progress).where(eq(progress.userId, user.id));
      return reply({ state: row?.state ?? null, version: row?.version ?? 0 });
    }
    if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON erforderlich.' }, 415);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 1000000) return reply({ error: 'Spielstand ist zu groß.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Ungültiger Spielstand.' }, 400); }
    const { state, version } = body ?? {};
    if (!state || typeof state !== 'object' || Array.isArray(state) || typeof state.name !== 'string'
      || !Array.isArray(state.quests) || !Array.isArray(state.goals) || !Array.isArray(state.special)
      || !Number.isInteger(version) || version < 0) return reply({ error: 'Ungültiger Spielstand.' }, 400);
    const rows = version === 0
      ? await db.insert(progress).values({ userId: user.id, state, version: 1 }).onConflictDoNothing().returning({ version: progress.version })
      : await db.update(progress).set({ state, version: version + 1, updatedAt: new Date() })
        .where(and(eq(progress.userId, user.id), eq(progress.version, version))).returning({ version: progress.version });
    if (!rows.length) return reply({ error: 'Der Spielstand wurde auf einem anderen Gerät geändert. Lade die Seite neu, bevor du weiterspielst.' }, 409);
    return reply({ version: rows[0].version });
  } catch {
    return reply({ error: 'Spielstand momentan nicht erreichbar. Bitte erneut versuchen.' }, 503);
  }
};
