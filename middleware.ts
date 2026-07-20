import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const configured = Boolean(
    process.env.NEXT_PUBLIC_INSFORGE_URL && process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  );
  if (!configured) return response;

  const session = await updateSession({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    requestCookies: {
      get: (name: string) => request.cookies.get(name),
    },
    responseCookies: {
      get: (name: string) => response.cookies.get(name),
      set: (name: string, value: string, options?: any) =>
        response.cookies.set(name, value, options),
      delete: (name: string) => response.cookies.delete(name),
    } as any,
  });

  if (["/library", "/activity"].some((path) => request.nextUrl.pathname.startsWith(path)) && !session.accessToken) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(authUrl);
  }
  return response;
}

export const config = {
  matcher: ["/library/:path*", "/activity/:path*", "/auth/:path*"],
};
