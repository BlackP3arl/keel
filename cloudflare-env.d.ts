interface CloudflareEnv {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first<T extends Record<string, unknown>>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
    };
  };
  AUTH_SECRET?: string;
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
  ALLOWED_EMAILS?: string;
  AUTH_URL?: string;
  AUTH_TRUST_HOST?: string;
}
