import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getCourse,
  listCourseWork,
  type CourseWork,
} from "@/lib/google/classroom";
import { AssignmentList } from "@/components/assignment-list";

export const dynamic = "force-dynamic";

function dueTimestamp(cw: CourseWork): number {
  if (!cw.dueDate) return Number.POSITIVE_INFINITY;
  const { year, month, day } = cw.dueDate;
  return Date.UTC(year, month - 1, day);
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Missing Google access token. Try signing out and back in.
      </p>
    );
  }

  const [course, assignmentsRaw] = await Promise.all([
    getCourse(session.accessToken, courseId),
    listCourseWork(session.accessToken, courseId),
  ]);

  const assignments = [...assignmentsRaw].sort(
    (a, b) => dueTimestamp(a) - dueTimestamp(b),
  );

  const withDueDate = assignments.filter((a) => a.dueDate).length;

  return (
    <div className="space-y-12">
      <nav aria-label="breadcrumb" className="anim-fade">
        <Link
          href="/"
          className="group inline-flex items-baseline gap-2 font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55 hover:text-foreground"
        >
          <span aria-hidden className="font-display text-base italic transition-transform group-hover:-translate-x-1">
            ←
          </span>
          back to groups
        </Link>
      </nav>

      <header className="anim-fade-up grid gap-8 border-b border-rule-strong/60 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-4">
          <div className="tracking-eyebrow text-foreground/55">a group</div>
          <h1 className="font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] tracking-tight">
            {course.name}
          </h1>
          {course.section ? (
            <p className="font-display text-xl italic text-foreground/65">
              {course.section}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule-strong/60 bg-rule/60 lg:min-w-[18rem]">
          <Stat label="tasks" value={assignments.length} />
          <Stat label="dated" value={withDueDate} />
        </dl>
      </header>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-6 border-b border-rule pb-3">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-3xl italic text-foreground/30 leading-none">
              §
            </span>
            <h2 className="font-display text-2xl tracking-tight">
              Tasks
            </h2>
          </div>
          <p className="hidden text-right text-sm text-foreground/60 sm:block">
            sorted by due date · earliest first
          </p>
        </div>
        <AssignmentList assignments={assignments} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="tracking-eyebrow text-foreground/55">{label}</div>
      <div className="mt-1 font-display text-4xl leading-none tabular-nums">
        {value.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
