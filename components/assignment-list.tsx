import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { CourseWork } from "@/lib/google/classroom";

function formatDue(cw: CourseWork) {
  if (!cw.dueDate) return null;
  const { year, month, day } = cw.dueDate;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssignmentList({ assignments }: { assignments: CourseWork[] }) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground">
          No assignments in this course yet.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {assignments.map((cw) => {
        const due = formatDue(cw);
        return (
          <Card key={cw.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{cw.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {due ? `Due ${due}` : "No due date"}
                {cw.workType ? ` · ${cw.workType.toLowerCase()}` : null}
              </p>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link
                href={`/assignments/${cw.id}?courseId=${cw.courseId}`}
                className={buttonVariants({
                  variant: "secondary",
                  className: "w-full",
                })}
              >
                Pick
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
