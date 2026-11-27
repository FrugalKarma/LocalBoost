// Vercel Routing Middleware: a client's own domain (Custom Premium, e.g. cafeneaua.ro) shows their site.
// It runs before static files, so "/" on that domain is the site, not the app. Our own hosts pass through untouched.
// Same list as lib/domains.mjs OWN_HOST; add a host here if the app is ever served from another address.
const OWN_HOST = /^((www\.)?arcton\.site|.+\.vercel\.app|localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i;

export default function middleware(request) {
  const url = new URL(request.url);
  if (OWN_HOST.test(url.host) || url.pathname.startsWith('/api/') || url.pathname.startsWith('/fonts/')) return undefined;
  const to = new URL(`/api/site?op=host&p=${encodeURIComponent(url.pathname)}`, url);
  return new Response(null, { headers: { 'x-middleware-rewrite': to.toString() } });
}
