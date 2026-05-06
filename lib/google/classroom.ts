const BASE = "https://classroom.googleapis.com/v1";

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  courseState?: string;
  enrollmentCode?: string;
  alternateLink?: string;
}

export interface CourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  workType?: string;
  maxPoints?: number;
}

export interface DriveFileRef {
  id: string;
  title?: string;
  alternateLink?: string;
  thumbnailUrl?: string;
}

export interface SubmissionAttachment {
  driveFile?: DriveFileRef;
  youTubeVideo?: { id?: string; title?: string };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
}

export interface StudentSubmission {
  id: string;
  courseId: string;
  courseWorkId: string;
  userId: string;
  state: "NEW" | "CREATED" | "TURNED_IN" | "RETURNED" | "RECLAIMED_BY_STUDENT";
  late?: boolean;
  draftGrade?: number;
  assignedGrade?: number;
  alternateLink?: string;
  assignmentSubmission?: { attachments?: SubmissionAttachment[] };
  shortAnswerSubmission?: { answer?: string };
  multipleChoiceSubmission?: { answer?: string };
}

export interface UserProfile {
  id: string;
  name: { givenName?: string; familyName?: string; fullName?: string };
  emailAddress?: string;
  photoUrl?: string;
}

class ClassroomError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Classroom API ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

async function classroomFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ClassroomError(res.status, text);
  }
  return res.json() as Promise<T>;
}

export async function listCourses(token: string): Promise<ClassroomCourse[]> {
  const courses: ClassroomCourse[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      teacherId: "me",
      courseStates: "ACTIVE",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await classroomFetch<{
      courses?: ClassroomCourse[];
      nextPageToken?: string;
    }>(token, `/courses?${params}`);
    if (data.courses) courses.push(...data.courses);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return courses;
}

export async function getCourse(
  token: string,
  courseId: string,
): Promise<ClassroomCourse> {
  return classroomFetch(token, `/courses/${courseId}`);
}

export async function listCourseWork(
  token: string,
  courseId: string,
): Promise<CourseWork[]> {
  const items: CourseWork[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      pageSize: "100",
      orderBy: "updateTime desc",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await classroomFetch<{
      courseWork?: CourseWork[];
      nextPageToken?: string;
    }>(token, `/courses/${courseId}/courseWork?${params}`);
    if (data.courseWork) items.push(...data.courseWork);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

export async function getCourseWork(
  token: string,
  courseId: string,
  courseWorkId: string,
): Promise<CourseWork> {
  return classroomFetch(
    token,
    `/courses/${courseId}/courseWork/${courseWorkId}`,
  );
}

export async function listSubmissions(
  token: string,
  courseId: string,
  courseWorkId: string,
): Promise<StudentSubmission[]> {
  const items: StudentSubmission[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await classroomFetch<{
      studentSubmissions?: StudentSubmission[];
      nextPageToken?: string;
    }>(
      token,
      `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?${params}`,
    );
    if (data.studentSubmissions) items.push(...data.studentSubmissions);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

export async function getUserProfile(
  token: string,
  userId: string,
): Promise<UserProfile> {
  return classroomFetch(token, `/userProfiles/${userId}`);
}
