import { getUser, refreshSession, verifyRequestOrigin } from '@netlify/identity';
import { and, desc, eq } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { sharedGoals } from '../../db/schema.js';
import { keepSignedIn } from '../lib/keep-signed-in.js';

// Public goal library: every signed-in player can read it, add goals and withdraw their own.
const SKILLS = ['geist', 'koerper', 'disziplin', 'kreativ', 'sozial'];
const XP = [50, 100, 175, 250];
const MAX_PER_USER = 30;
const LIST_LIMIT = 200;

type SharedQuest = { title: string; xp: number; attr: string; target: number };

function cleanGoal(body: any): { name: string; description: string; quests: SharedQuest[] } | null {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.desc === 'string' ? body.desc.trim() : '';
  if (!name || name.length > 70 || description.length > 240) return null;
  if (!Array.isArray(body.quests) || body.quests.length < 1 || body.quests.length > 25) return null;
  const quests: SharedQuest[] = [];
  for (const q of body.quests) {
    const title = typeof q?.title === 'string' ? q.title.trim() : '';
    if (!title || title.length > 80 || !XP.includes(q.xp) || !SKILLS.includes(q.attr)
      || !Number.isInteger(q.target) || q.target < 1 || q.target > 365) return null;
    quests.push({ title, xp: q.xp, attr: q.attr, target: q.target });
  }
  return { name, description, quests };
}

export default async (req: Request) => {
  const reply = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return reply({ error: 'Methode nicht erlaubt.' }, 405);
  if (req.method !== 'GET') {
    try { verifyRequestOrigin(req); } catch { return reply({ error: 'Zugriff verweigert.' }, 403); }
  }
  try {
    keepSignedIn();
    await refreshSession();
    const user = await getUser();
    if (!user) return reply({ error: 'Bitte erneut anmelden.' }, 401);
    const db = database();

    if (req.method === 'GET') {
      const rows = await db.select().from(sharedGoals).orderBy(desc(sharedGoals.createdAt)).limit(LIST_LIMIT);
      return reply({ goals: rows.map((r: any) => ({
        id: r.id, name: r.name, desc: r.description, quests: r.quests, mine: r.userId === user.id, created: r.createdAt,
      })) });
    }

    if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON erforderlich.' }, 415);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 20000) return reply({ error: 'Ziel ist zu groß.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Ungültiges Ziel.' }, 400); }

    if (req.method === 'DELETE') {
      if (typeof body?.id !== 'string') return reply({ error: 'Ungültiges Ziel.' }, 400);
      const rows = await db.delete(sharedGoals).where(and(eq(sharedGoals.id, body.id), eq(sharedGoals.userId, user.id)))
        .returning({ id: sharedGoals.id });
      if (!rows.length) return reply({ error: 'Dieses geteilte Ziel gibt es nicht mehr.' }, 404);
      return reply({ id: rows[0].id });
    }

    const goal = cleanGoal(body);
    if (!goal) return reply({ error: 'Ungültiges Ziel. Prüfe Name und Quests.' }, 400);
    const own = await db.select({ id: sharedGoals.id }).from(sharedGoals).where(eq(sharedGoals.userId, user.id)).limit(MAX_PER_USER);
    if (own.length >= MAX_PER_USER) return reply({ error: `Du kannst höchstens ${MAX_PER_USER} Ziele teilen.` }, 429);
    const id = crypto.randomUUID();
    await db.insert(sharedGoals).values({ id, userId: user.id, ...goal });
    return reply({ id });
  } catch {
    return reply({ error: 'Geteilte Ziele momentan nicht erreichbar. Bitte erneut versuchen.' }, 503);
  }
};
