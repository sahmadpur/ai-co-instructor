import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { ClassroomCourse } from "@/lib/google/classroom";

export function CourseList({ courses }: { courses: ClassroomCourse[] }) {
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground">
          No active courses found in your Google Classroom account.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <Card key={course.id} className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">{course.name}</CardTitle>
            {course.section ? (
              <p className="text-sm text-muted-foreground">{course.section}</p>
            ) : null}
          </CardHeader>
          <CardContent className="mt-auto">
            <Link
              href={`/courses/${course.id}`}
              className={buttonVariants({ className: "w-full" })}
            >
              Pick
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
