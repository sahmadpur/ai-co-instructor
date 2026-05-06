import Link from "next/link";
import type { CourseWork } from "@/lib/google/classroom";

function formatDue(cw: CourseWork) {
  if (!cw.dueDate) return null;
  const { year, month, day } = cw.dueDate;
  const d = new Date(Date.UTC(year, month - 1, day));
  return {
    full: d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleDateString(undefined, { month: "short" }).toLowerCase(),
  };
}

export function AssignmentList({ assignments }: { assignments: CourseWork[] }) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-rule-strong/60 bg-card/40 p-12 text-center">
        <p className="font-display text-2xl italic text-foreground/55">
          No assignments yet.
        </p>
        <p className="mt-2 font-mono-num text-xs uppercase tracking-[0.2em] text-foreground/45">
          this class is empty
        </p>
      </div>
    );
  }
  return (
    <ol className="paper-card overflow-hidden rounded-xl divide-y divide-rule">
      {assignments.map((cw, i) => {
        const due = formatDue(cw);
        return (
          <li key={cw.id}>
            <Link
              href={`/assignments/${cw.id}?courseId=${cw.courseId}`}
              className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-6 px-6 py-5 transition-colors hover:bg-paper-deep/50"
            >
              <span className="font-display text-3xl italic text-foreground/30 tabular-nums w-10 text-right">
                {(i + 1).toString().padStart(2, "0")}
              </span>

              <div className="min-w-0 space-y-1">
                <h3 className="font-display text-xl leading-tight tracking-tight">
                  {cw.title}
                </h3>
                {cw.workType ? (
                  <span className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/50">
                    {cw.workType.toLowerCase().replace(/_/g, " ")}
                  </span>
                ) : null}
              </div>

              <div className="hidden min-w-[6rem] items-baseline gap-1 sm:flex sm:flex-col sm:items-end">
                {due ? (
                  <>
                    <span className="font-mono-num text-[0.65rem] uppercase tracking-[0.2em] text-foreground/50">
                      due
                    </span>
                    <span className="font-display text-base leading-none">
                      <span className="text-2xl">{due.day}</span>{" "}
                      <span className="italic text-foreground/65">{due.month}</span>
                    </span>
                  </>
                ) : (
                  <span className="font-mono-num text-[0.65rem] uppercase tracking-[0.18em] text-foreground/40">
                    no due date
                  </span>
                )}
              </div>

              <span
                aria-hidden
                className="font-display text-2xl italic text-foreground/35 transition-all group-hover:translate-x-1 group-hover:text-marker"
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
