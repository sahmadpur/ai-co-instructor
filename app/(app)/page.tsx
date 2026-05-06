import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { listCourses } from "@/lib/google/classroom";
import { CourseList } from "@/components/course-list";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) {
    return (
      <p className="text-sm text-destructive">
        Missing Google access token. Try signing out and back in.
      </p>
    );
  }

  const [coursesResult, pastRuns] = await Promise.all([
    listCourses(session.accessToken).then(
      (c) => ({ ok: true as const, courses: c }),
      (e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : String(e),
      }),
    ),
    db.query.runs.findMany({
      where: eq(schema.runs.userId, session.user.id),
      orderBy: [desc(schema.runs.createdAt)],
      limit: 20,
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Classroom Courses
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a course to see its assignments and generate feedback.
          </p>
        </div>
        {coursesResult.ok ? (
          <CourseList courses={coursesResult.courses} />
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load courses: {coursesResult.message}
          </div>
        )}
      </section>

      {pastRuns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Past runs</h2>
          <div className="divide-y rounded-md border">
            {pastRuns.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.assignmentTitle}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.courseName} ·{" "}
                    {new Date(r.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <Badge
                  variant={
                    r.status === "confirmed"
                      ? "default"
                      : r.status === "generating"
                      ? "outline"
                      : "secondary"
                  }
                >
                  {r.status}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
