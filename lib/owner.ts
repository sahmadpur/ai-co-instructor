import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { db, schema } from "@/lib/db";

// JWT sub claims can drift across sign-ins (re-auth, prompt=consent re-grant,
// cookie loss, etc.), so a single Google account may end up owning records
// under multiple users.id values. Resolve the full set of ids that share the
// session's email so queries can `inArray()` against all of them.
export async function getOwnerUserIds(session: Session): Promise<string[]> {
  const ids = new Set<string>();
  if (session.user?.id) ids.add(session.user.id);
  if (session.user?.email) {
    const rows = await db.query.users.findMany({
      where: eq(schema.users.email, session.user.email),
    });
    for (const u of rows) ids.add(u.id);
  }
  return Array.from(ids);
}
