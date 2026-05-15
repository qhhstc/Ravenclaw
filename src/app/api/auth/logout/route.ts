import { clearSessionCookie } from "@/lib/auth";

function redirectToLogin() {
  return new Response(null, {
    status: 303,
    headers: { Location: "/login" },
  });
}

export async function POST() {
  await clearSessionCookie();
  return redirectToLogin();
}

export async function GET() {
  await clearSessionCookie();
  return redirectToLogin();
}
