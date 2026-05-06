import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
    user: {
      id?: string;
    } & DefaultSession["user"];
  }
}

interface AuthToken {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  sub?: string;
  error?: "RefreshTokenError";
  [key: string]: unknown;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error ?? `refresh failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    refreshToken: data.refresh_token ?? refreshToken,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      const t = token as AuthToken;
      if (account) {
        t.accessToken = account.access_token;
        t.refreshToken = account.refresh_token;
        t.expiresAt = account.expires_at;
        return t;
      }
      const expiresAt = t.expiresAt ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) {
        return t;
      }
      if (!t.refreshToken) {
        return { ...t, error: "RefreshTokenError" } as AuthToken;
      }
      try {
        const refreshed = await refreshGoogleAccessToken(t.refreshToken);
        return {
          ...t,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
          error: undefined,
        } as AuthToken;
      } catch (err) {
        console.error("token refresh failed", err);
        return { ...t, error: "RefreshTokenError" } as AuthToken;
      }
    },
    async session({ session, token }) {
      const t = token as AuthToken;
      session.accessToken = t.accessToken;
      session.error = t.error;
      if (t.sub && session.user) {
        session.user.id = t.sub;
      }
      return session;
    },
  },
});
