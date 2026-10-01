import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh and optimistic route protection.
 *
 * Next.js 16 renamed `middleware` to `proxy`; the Supabase SSR refresh has to
 * run here because Server Components cannot write cookies. Without it the
 * access token expires and users are signed out at random.
 *
 * This is deliberately a *UX* gate, not the security boundary. It answers "is
 * there a session?" cheaply. Roles and data are enforced by RLS and by the
 * portal layout's own check — see docs/architecture/10-auth-and-permissions.md.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Every request passes through here, including the public mockups. An
  // unconfigured environment must fall through, not throw.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // The refreshed token has to reach both the Server Components rendering
        // this request (request cookies) and the browser (response cookies).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );

        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // getClaims() verifies the token's signature. getSession() would trust
  // whatever the cookie says, which anyone can forge.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;

  // Both consoles need a session. Roles are deliberately not checked here: the
  // role lives in `profiles`, not in the JWT, and a database query on every
  // request is the "full authorization in the proxy" the docs warn against.
  // Each console layout enforces its own role, and RLS enforces the data.
  const guarded =
    pathname.startsWith("/portal") || pathname.startsWith("/admin");

  if (!signedIn && guarded) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/login";
    signIn.search = "";
    signIn.searchParams.set("next", pathname);
    return redirectTo(signIn, response);
  }

  // /login is left alone: the page itself redirects a signed-in visitor to the
  // right console for their role, which the proxy cannot know without a query.
  return response;
}

/**
 * Redirect without dropping the cookies `setAll` just rotated — a fresh
 * NextResponse carries none of them, which would sign the user out.
 */
function redirectTo(destination: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(destination);

  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }

  return redirect;
}

export const config = {
  // Skip static assets and images: auth logic here would block CSS and JS.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
