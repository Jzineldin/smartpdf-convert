import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySupabaseToken } from "../lib/supabase";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // First, try Supabase authentication via header
  const supabaseToken = opts.req.headers['x-supabase-auth'] as string | undefined;
  if (supabaseToken) {
    try {
      const supabaseUser = await verifySupabaseToken(supabaseToken);
      if (supabaseUser) {
        // Check if user exists in our database by Supabase ID (using openId field)
        let dbUser = await db.getUserByOpenId(supabaseUser.id);

        // If not exists, create user
        if (!dbUser) {
          await db.upsertUser({
            openId: supabaseUser.id,
            email: supabaseUser.email || null,
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
            loginMethod: 'supabase',
            lastSignedIn: new Date(),
          });
          dbUser = await db.getUserByOpenId(supabaseUser.id);
        } else {
          // Update last signed in
          await db.upsertUser({
            openId: supabaseUser.id,
            lastSignedIn: new Date(),
          });
        }

        if (dbUser) {
          user = dbUser;
        }
      }
    } catch (error) {
      console.error('[Auth] Supabase token verification failed:', error);
    }
  }

  // If Supabase auth didn't work, try SDK OAuth
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
