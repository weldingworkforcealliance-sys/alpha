// Read-only hosted-preview checks. Refuse production and arbitrary targets.
const base = new URL(process.env.STAGING_PREVIEW_URL ?? 'https://ltg-security-staging-20260925--livingtguide.netlify.app');
if (!['https://ltg-security-staging-20260925--livingtguide.netlify.app', 'http://127.0.0.1:3007'].includes(base.origin) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Refusing non-allowlisted staging preview');
const publicRoutes = ['/', '/login', '/account-setup', '/reset-password', '/training/login', '/demo'];
const protectedRoutes = ['/dashboard','/agenda','/resources','/classroom','/attendance','/time-clock','/reports','/school','/owner','/accounts','/training'];
const results = [];
let loginHtml = '';
for (const route of publicRoutes) {
  const response = await fetch(new URL(route, base), {redirect:'manual',signal:AbortSignal.timeout(30000)});
  const html = await response.text();
  const pass = response.status === 200 && html.includes('Staging environment');
  results.push({check:'public-page',route,status:response.status,pass});
  if(route === '/login') loginHtml = html;
}
for (const route of protectedRoutes) {
  const response = await fetch(new URL(route, base), {redirect:'manual',signal:AbortSignal.timeout(30000)});
  const location = response.headers.get('location');
  const target = location ? new URL(location,base) : null;
  results.push({check:'unauthenticated-redirect',route,status:response.status,pass:response.status >= 300 && response.status < 400 && target?.origin === base.origin && target?.pathname === (route === '/training' ? '/training/login' : '/login') && target?.searchParams.get('next') === route && (response.headers.get('cache-control') ?? '').includes('no-store')});
}
const scriptPaths = [...new Set([...loginHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))];
let stagingFound = false;
let foreignDatabaseFound = false;
const databaseHosts = new Set();
let sameOriginScripts = 0;
for (const path of scriptPaths) {
  const url = new URL(path,base);
  if(url.origin !== base.origin) continue;
  const response = await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Could not inspect preview script');
  const js = await response.text();
  sameOriginScripts++;
  for(const match of js.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)) {
    databaseHosts.add(match[1]);
    if(match[1] === 'ezlvivmeneefiiwqwgqd') stagingFound = true;
    else foreignDatabaseFound = true;
  }
}
results.push({check:'compiled-database-isolation',sameOriginScripts,databaseHosts:[...databaseHosts],pass:sameOriginScripts > 0 && stagingFound && !foreignDatabaseFound});
console.log(JSON.stringify({base:base.origin,checkedAt:new Date().toISOString(),results},null,2));
if(results.some(r=>!r.pass)) process.exitCode = 1;


