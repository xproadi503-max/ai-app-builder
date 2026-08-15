import GitHubProvider from "next-auth/providers/github";

export const authOptions = {
  trustHost: true,
  providers: [
    GitHubProvider({
      clientId: process.env.GH_CLIENT_ID,
      clientSecret: process.env.GH_CLIENT_SECRET,
      authorization: { params: { scope: "read:user repo workflow" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.accessToken = account.access_token;
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
