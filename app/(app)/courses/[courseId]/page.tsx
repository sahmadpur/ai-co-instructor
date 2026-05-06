import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCourse, listCourseWork } from "@/lib/google/classroom";
import { AssignmentList } from "@/components/assignment-list";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <p className="text-sm text-destructive">
        Missing Google access token. Try signing out and back in.
      </p>
    );
  }

  const [course, assignments] = await Promise.all([
    getCourse(session.accessToken, courseId),
    listCourseWork(session.accessToken, courseId),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Courses</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
        {course.section ? (
          <p className="text-sm text-muted-foreground">{course.section}</p>
        ) : null}
      </div>
      <AssignmentList assignments={assignments} />
    </div>
  );
}
