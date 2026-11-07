import { getUser, login, signup, logout, confirmEmail, refreshSession,
  requestPasswordRecovery, recoverPassword, verifyRequestOrigin, AuthError } from '@netlify/identity';
import { keepSignedIn, renewSignIn } from '../lib/keep-signed-in.js';

export default async (req: Request) => {
  keepSignedIn();
  const reply = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  const safeUser = (user: Awaited<ReturnType<typeof getUser>>) => user ? { id: user.id, email: user.email } : null;
  try {
    if (req.method === 'GET') {
      await refreshSession();
      const user = await getUser();
      if (user) renewSignIn();
      return reply({ user: safeUser(user) });
    }
    if (req.method !== 'POST') return reply({ error: 'Methode nicht erlaubt.' }, 405);
    verifyRequestOrigin(req);
    if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'JSON erforderlich.' }, 415);
    if (Number(req.headers.get('content-length')) > 8192) return reply({ error: 'Anfrage zu groß.' }, 413);
    const body = await req.json();
    if (body.action === 'logout') { await logout(); return reply({ user: null }); }
    if (body.action === 'confirm' && typeof body.token === 'string') {
      await confirmEmail(body.token);
      return reply({ user: null, message: 'E-Mail bestätigt. Du kannst dich jetzt anmelden.' });
    }
    if (body.action === 'recover' && typeof body.email === 'string') {
      await requestPasswordRecovery(body.email.trim());
      return reply({ message: 'Prüfe dein Postfach auf den Link zum Zurücksetzen.' });
    }
    if (body.action === 'reset' && typeof body.token === 'string' && typeof body.password === 'string' && body.password.length >= 8) {
      await recoverPassword(body.token, body.password);
      return reply({ user: null, message: 'Passwort gespeichert. Melde dich mit deinem neuen Passwort an.' });
    }
    if (!['login', 'register'].includes(body.action) || typeof body.email !== 'string' || typeof body.password !== 'string'
      || body.password.length < 8 || body.password.length > 1024 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return reply({ error: 'Gültige E-Mail und Passwort mit mindestens 8 Zeichen erforderlich.' }, 400);
    }
    const email = body.email.trim().toLowerCase();
    if (body.action === 'register') {
      const user = await signup(email, body.password);
      return user.confirmedAt ? reply({ user: safeUser(user) }) : reply({ user: null, message: 'Bitte bestätige deine E-Mail über den Link in deinem Postfach. Danach kannst du dich anmelden.' });
    }
    return reply({ user: safeUser(await login(email, body.password)) });
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Ungültige Anfrage.' }, 400);
    if (error instanceof AuthError) return reply({ error: 'Anmeldung nicht möglich. Prüfe E-Mail, Passwort und E-Mail-Bestätigung oder versuche es später erneut.' }, error.status === 403 ? 403 : 400);
    return reply({ error: 'Kontodienst momentan nicht erreichbar. Bitte erneut versuchen.' }, 503);
  }
};
