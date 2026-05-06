import Link from "next/link";
import type { ClassroomCourse } from "@/lib/google/classroom";

export function CourseList({ courses }: { courses: ClassroomCourse[] }) {
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-rule-strong/60 bg-card/40 p-12 text-center">
        <p className="font-display text-2xl italic text-foreground/55">
          No active classes found.
        </p>
        <p className="mt-2 font-mono-num text-xs uppercase tracking-[0.2em] text-foreground/45">
          check google classroom
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course, i) => (
        <Link
          key={course.id}
          href={`/courses/${course.id}`}
          className="paper-card paper-card-hover group relative flex flex-col rounded-xl p-6"
        >
          <div className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-rule-strong/60 bg-paper/80 font-mono-num text-[0.65rem] uppercase tracking-widest text-foreground/55">
            {(i + 1).toString().padStart(2, "0")}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="tracking-eyebrow text-foreground/55">class</div>
            <h3 className="font-display text-2xl leading-tight tracking-tight pr-12">
              {course.name}
            </h3>
            {course.section ? (
              <p className="font-display italic text-foreground/65">
                {course.section}
              </p>
            ) : (
              <p className="font-mono-num text-xs uppercase tracking-[0.18em] text-foreground/45">
                no section
              </p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-rule pt-4">
            <span className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/55 group-hover:text-foreground transition-colors">
              open ledger
            </span>
            <span
              aria-hidden
              className="font-display text-2xl italic text-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-marker"
            >
              →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
