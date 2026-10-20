import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowlisted } from "@/lib/allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      return isAllowlisted(user.email);
    },
  },
});
