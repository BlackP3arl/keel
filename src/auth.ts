import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { resolveSessionAccess } from "@/lib/access";
import { isAppRole } from "@/lib/roles";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const access = await resolveSessionAccess(user.email);
      return access.ok;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? (typeof token.email === "string" ? token.email : null);
      if (!email) {
        token.role = undefined;
        return token;
      }
      const access = await resolveSessionAccess(email);
      token.email = email;
      token.role = access.ok ? access.role : undefined;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = isAppRole(token.role) ? token.role : undefined;
      }
      return session;
    },
  },
});
