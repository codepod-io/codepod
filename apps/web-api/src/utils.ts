import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string(),
  // FIXME even if this is undefined, the token verification still works. Looks
  // like I only need to set client ID in the frontend?
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export const ENV = envSchema.parse(process.env);
