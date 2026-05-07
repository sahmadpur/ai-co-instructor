import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.error) redirect("/login");

  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-rule/80 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link
            href="/"
            className="group flex items-baseline gap-3"
          >
            <span className="font-display text-2xl leading-none tracking-tight">
              <span className="italic">AI</span>{" "}
              <span className="text-foreground/85">Co-Instructor</span>
            </span>
            <span className="hidden font-mono-num text-[0.65rem] uppercase tracking-[0.22em] text-foreground/45 sm:block">
              · classroom comments
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 text-right sm:flex">
              <div className="leading-tight">
                <div className="font-display text-sm italic text-foreground/85">
                  {session.user.name ?? "Teacher"}
                </div>
                <div className="font-mono-num text-[0.7rem] uppercase tracking-widest text-foreground/55">
                  {session.user.email}
                </div>
              </div>
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-full border border-rule-strong/60 bg-card font-display text-xs italic text-foreground/80"
              >
                {initials}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm" className="font-mono-num text-[0.7rem] uppercase tracking-[0.2em]">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto h-px max-w-6xl ink-rule" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 anim-fade">
        {children}
      </main>

      <footer className="mt-16 border-t border-rule/70 bg-paper/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 text-xs text-foreground/55">
          <span className="font-mono-num uppercase tracking-[0.22em]">
            vol. one · {new Date().getFullYear()}
          </span>
          <span className="font-display italic">
            comments on student work, written with AI assistance
          </span>
          <span className="font-mono-num uppercase tracking-[0.22em] hidden sm:block">
            read-only
          </span>
        </div>
      </footer>
    </div>
  );
}
