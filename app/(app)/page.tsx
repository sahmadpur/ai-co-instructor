import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { listCourses } from "@/lib/google/classroom";
import { CourseList } from "@/components/course-list";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  generating: "in press",
  review: "in review",
  confirmed: "filed",
};

export default async function HomePage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.id) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Missing Google access token. Try signing out and back in.
      </div>
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

  const courseCount = coursesResult.ok ? coursesResult.courses.length : 0;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-16">
      <section className="anim-fade-up grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="tracking-eyebrow text-foreground/55">today</span>
            <span className="block h-px w-16 bg-rule-strong/70" />
            <span className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55">
              {today}
            </span>
          </div>
          <h1 className="font-display text-[clamp(2.6rem,5.5vw,4.5rem)] leading-[1.02] tracking-tight">
            <span className="block">Good day, editor.</span>
            <span className="block italic font-light text-foreground/75">
              your desk is ready.
            </span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-foreground/70">
            Choose a class to open its assignment ledger. Past dossiers are
            archived below — every edit, model run, and exported file remains
            yours.
          </p>
        </div>

        <dl className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule-strong/60 bg-rule/60 lg:w-auto lg:min-w-[20rem]">
          <Stat label="classes" value={courseCount} suffix={courseCount === 1 ? "class" : "classes"} />
          <Stat label="dossiers" value={pastRuns.length} suffix={pastRuns.length === 1 ? "run" : "runs"} />
        </dl>
      </section>

      <section className="space-y-6">
        <SectionHeader
          number="i"
          eyebrow="part one"
          title="Your classes"
          subtitle="Pick a class to see its assignments and begin a new dossier."
        />
        {coursesResult.ok ? (
          <CourseList courses={coursesResult.courses} />
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            <div className="font-display text-lg italic">Couldn&rsquo;t load classes</div>
            <div className="mt-1 font-mono-num text-xs">{coursesResult.message}</div>
          </div>
        )}
      </section>

      {pastRuns.length > 0 ? (
        <section className="space-y-6">
          <SectionHeader
            number="ii"
            eyebrow="part two"
            title="The archive"
            subtitle="Recent dossiers — chronologically, most recent on top."
          />
          <ol className="overflow-hidden rounded-lg border border-rule-strong/60 bg-card/40 paper-card divide-y divide-rule">
            {pastRuns.map((r, i) => (
              <li key={r.id}>
                <Link
                  href={`/runs/${r.id}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 px-5 py-4 transition-colors hover:bg-paper-deep/60"
                >
                  <span className="font-display text-3xl italic text-foreground/30 tabular-nums w-12 text-right">
                    {(pastRuns.length - i).toString().padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-lg leading-tight tracking-tight">
                      {r.assignmentTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono-num text-[0.7rem] uppercase tracking-[0.16em] text-foreground/55">
                      <span>{r.courseName}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                  <RunStatus status={r.status} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="tracking-eyebrow text-foreground/55">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-4xl leading-none tabular-nums">
          {value.toString().padStart(2, "0")}
        </span>
        <span className="font-display italic text-foreground/55 text-sm">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({
  number,
  eyebrow,
  title,
  subtitle,
}: {
  number: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-rule pb-3">
      <div className="flex items-baseline gap-5">
        <span className="font-display text-5xl italic text-foreground/25 leading-none">
          {number}.
        </span>
        <div>
          <div className="tracking-eyebrow text-foreground/55">{eyebrow}</div>
          <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        </div>
      </div>
      <p className="hidden max-w-sm text-right text-sm leading-snug text-foreground/65 sm:block">
        {subtitle}
      </p>
    </div>
  );
}

function RunStatus({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const isConfirmed = status === "confirmed";
  const isGenerating = status === "generating";
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono-num text-[0.65rem] uppercase tracking-[0.18em]",
          isConfirmed
            ? "border-foreground/80 bg-foreground text-background"
            : isGenerating
            ? "border-marker/50 bg-marker/10 text-marker"
            : "border-rule-strong text-foreground/70",
        ].join(" ")}
      >
        {isGenerating ? (
          <span className="anim-nib block h-1.5 w-1.5 rounded-full bg-marker" />
        ) : null}
        {label}
      </span>
      <span
        aria-hidden
        className="font-display text-xl italic text-foreground/40 transition-transform group-hover:translate-x-1"
      >
        →
      </span>
    </div>
  );
}
