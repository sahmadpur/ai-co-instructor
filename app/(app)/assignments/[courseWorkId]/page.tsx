import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCourse,
  getCourseWork,
  listSubmissions,
} from "@/lib/google/classroom";
import { GenerateForm } from "@/components/generate-button";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseWorkId: string }>;
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseWorkId } = await params;
  const { courseId } = await searchParams;
  if (!courseId) notFound();

  const session = await auth();
  if (!session?.accessToken) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Missing Google access token. Try signing out and back in.
      </p>
    );
  }

  const [course, cw, submissions] = await Promise.all([
    getCourse(session.accessToken, courseId),
    getCourseWork(session.accessToken, courseId, courseWorkId),
    listSubmissions(session.accessToken, courseId, courseWorkId),
  ]);

  const turnedIn = submissions.filter(
    (s) => s.state === "TURNED_IN" || s.state === "RETURNED",
  ).length;
  const notTurnedIn = submissions.length - turnedIn;

  return (
    <div className="space-y-12">
      <nav aria-label="breadcrumb" className="anim-fade flex flex-wrap items-center gap-2 font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55">
        <Link href="/" className="hover:text-foreground">groups</Link>
        <span className="font-display text-base italic text-foreground/35">/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-foreground truncate max-w-[18rem]">
          {course.name}
        </Link>
        <span className="font-display text-base italic text-foreground/35">/</span>
        <span className="text-foreground">task</span>
      </nav>

      <header className="anim-fade-up space-y-6 border-b border-rule-strong/60 pb-10">
        <div className="flex items-center gap-3">
          <span className="tracking-eyebrow text-foreground/55">a task from</span>
          <span className="font-display italic text-foreground/65">
            {course.name}
          </span>
        </div>
        <h1 className="font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.05] tracking-tight">
          {cw.title}
        </h1>

        <dl className="flex flex-wrap items-center gap-x-10 gap-y-3 pt-2">
          <Pill label="ready" value={turnedIn} accent />
          <Pill label="not turned in" value={notTurnedIn} />
          <Pill label="total" value={submissions.length} />
        </dl>
      </header>

      <section className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <article className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="tracking-eyebrow text-foreground/55">
              task description
            </span>
            <span className="block h-px flex-1 bg-rule" />
          </div>
          {cw.description ? (
            <div className="paper-card relative rounded-lg p-6 text-[0.95rem] leading-[1.65] whitespace-pre-wrap">
              <span aria-hidden className="absolute -top-3 left-5 font-display text-5xl italic leading-none text-marker/60">
                &ldquo;
              </span>
              <div className="pt-2">{cw.description}</div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-rule-strong/60 bg-card/30 p-8 text-center">
              <p className="font-display italic text-foreground/55">
                No description in Classroom.
              </p>
              <p className="mt-1 font-mono-num text-xs uppercase tracking-[0.2em] text-foreground/40">
                the AI will use the title as the task description
              </p>
            </div>
          )}
        </article>

        <article className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="tracking-eyebrow text-foreground/55">
              start a run
            </span>
            <span className="block h-px flex-1 bg-rule" />
          </div>
          <div className="paper-card rounded-lg p-6">
            <GenerateForm
              courseId={courseId}
              courseName={course.name}
              courseWorkId={courseWorkId}
              assignmentTitle={cw.title}
              taskDescription={cw.description ?? cw.title}
              submissionsReady={submissions.length}
            />
          </div>
        </article>
      </section>
    </div>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={[
          "font-display text-3xl tabular-nums leading-none",
          accent ? "text-marker" : "text-foreground/85",
        ].join(" ")}
      >
        {value.toString().padStart(2, "0")}
      </span>
      <span className="font-mono-num text-[0.65rem] uppercase tracking-[0.22em] text-foreground/55">
        {label}
      </span>
    </div>
  );
}
