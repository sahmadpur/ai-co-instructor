import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.error) redirect("/");

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">AI Co-Instructor</CardTitle>
          <CardDescription>
            Sign in with your Google Workspace for Education account to pull
            assignments from Google Classroom and generate feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Sign in with Google
            </Button>
          </form>
          {session?.error === "RefreshTokenError" ? (
            <p className="mt-4 text-sm text-destructive">
              Your session expired. Please sign in again.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
