import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getCourse,
  getCourseWork,
  listSubmissions,
} from "@/lib/google/classroom";
import { GenerateForm } from "@/components/generate-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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
      <p className="text-sm text-destructive">
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
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Courses</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/courses/${courseId}`} />}>
              {course.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{cw.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{cw.title}</h1>
        <p className="text-sm text-muted-foreground">
          {turnedIn} submission{turnedIn === 1 ? "" : "s"} ready · {notTurnedIn}{" "}
          not turned in
        </p>
      </div>

      {cw.description ? (
        <div className="rounded-md border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
          {cw.description}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          (no assignment description in Classroom)
        </div>
      )}

      <GenerateForm
        courseId={courseId}
        courseName={course.name}
        courseWorkId={courseWorkId}
        assignmentTitle={cw.title}
        taskDescription={cw.description ?? cw.title}
        submissionsReady={submissions.length}
      />
    </div>
  );
}
