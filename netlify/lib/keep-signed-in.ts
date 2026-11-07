// Netlify Identity writes its auth cookies (nf_jwt, nf_refresh) without an expiry date.
// Browsers treat those as session cookies and drop them when the browser or app closes,
// so players had to sign in again every time. These helpers make the cookies persistent.
const AUTH_COOKIES = ['nf_jwt', 'nf_refresh'];
const DAYS = 60;

type CookieInput = { name: string; value: string; expires?: unknown; maxAge?: unknown; [key: string]: unknown };

const store = () => (globalThis as any).Netlify?.context?.cookies;

// Call once per request before login/refresh: every auth cookie set afterwards gets an expiry date.
export function keepSignedIn(): void {
  const cookies = store();
  if (!cookies || typeof cookies.set !== 'function' || cookies.__keepSignedIn) return;
  const set = cookies.set.bind(cookies);
  const touched = new Set<string>();
  cookies.set = (input: string | CookieInput, value?: string) => {
    if (typeof input === 'object' && AUTH_COOKIES.includes(input.name)) {
      touched.add(input.name);
      if (input.expires === undefined && input.maxAge === undefined) {
        input = { ...input, expires: new Date(Date.now() + DAYS * 86_400_000) };
      }
    }
    return set(input, value);
  };
  cookies.__keepSignedIn = touched;
}

// For sessions that already exist as session cookies: send them back once with an expiry date.
// Cookies that were refreshed in this request are left alone.
export function renewSignIn(): void {
  const cookies = store();
  const touched: Set<string> | undefined = cookies?.__keepSignedIn;
  if (!cookies || !touched || typeof cookies.get !== 'function') return;
  for (const name of AUTH_COOKIES) {
    const value = cookies.get(name);
    if (value && !touched.has(name)) cookies.set({ name, value, httpOnly: false, secure: true, path: '/', sameSite: 'Lax' });
  }
}
