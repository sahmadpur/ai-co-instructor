import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
    <main className="relative flex flex-1 items-stretch overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-40 h-[36rem] w-[36rem] rounded-full opacity-40 blur-3xl"
             style={{ background: "radial-gradient(closest-side, oklch(from var(--marker) l c h / 0.18), transparent)" }} />
        <div className="absolute -bottom-48 -right-24 h-[40rem] w-[40rem] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(closest-side, oklch(from var(--gold) l c h / 0.18), transparent)" }} />
      </div>

      <section className="relative hidden flex-1 flex-col justify-between p-14 md:flex">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono-num small-caps text-foreground/70">
            est.&nbsp;mmxxvi
          </span>
          <span className="h-px w-12 bg-rule-strong/80" />
          <span className="tracking-eyebrow text-foreground/60">No.&nbsp;01</span>
        </div>

        <div className="space-y-10">
          <div className="space-y-1">
            <p className="tracking-eyebrow text-foreground/60">a private workshop for</p>
            <h1 className="font-display text-[clamp(3.4rem,7.5vw,6.5rem)] leading-[0.95] tracking-tight">
              <span className="block">The thoughtful</span>
              <span className="block italic font-light">teacher&rsquo;s</span>
              <span className="block">feedback,</span>
              <span className="block italic font-light marker-underline">
                rewritten
              </span>
              <span className="block">by hand.</span>
            </h1>
          </div>

          <div className="flex max-w-md items-start gap-4 border-l-2 border-foreground/30 pl-5 text-[0.95rem] leading-relaxed text-foreground/75">
            <p>
              <span className="font-display italic">
                &ldquo;What if the quiet hours after class became the most
                important ones?&rdquo;
              </span>
              <br />
              An assistive desk for reading every submission, choosing your
              words, and signing them as your own.
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 text-xs text-foreground/55">
          <div className="space-y-1">
            <p className="tracking-eyebrow">vol. one</p>
            <p className="font-mono-num">classroom · drive · claude</p>
          </div>
          <div className="font-display text-2xl italic">— S.A.</div>
        </div>
      </section>

      <aside className="relative flex w-full flex-col justify-center p-8 md:w-[42rem] md:border-l md:border-rule/70 md:bg-card md:p-14">
        <div className="anim-fade-up mx-auto flex w-full max-w-md flex-col gap-10">
          <header className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="block h-px flex-1 bg-rule-strong/70 anim-draw-rule" />
              <span className="tracking-eyebrow text-foreground/60">colophon</span>
              <span className="block h-px flex-1 bg-rule-strong/70 anim-draw-rule" />
            </div>
            <h2 className="font-display text-3xl leading-tight">
              AI&nbsp;Co-Instructor
            </h2>
            <p className="text-sm leading-relaxed text-foreground/70">
              Sign in with your Google&nbsp;Workspace account. We&rsquo;ll fetch
              classes and submissions read-only — no writes back to Classroom,
              no scores, no rubrics.
            </p>
          </header>

          <ul className="space-y-2 text-sm text-foreground/75">
            {[
              ["i", "Pick a class, pick an assignment"],
              ["ii", "Set the focus for your feedback"],
              ["iii", "Edit each line, then confirm"],
            ].map(([n, label]) => (
              <li key={n} className="flex items-baseline gap-3">
                <span className="font-display italic w-6 text-foreground/45">
                  {n}.
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
            className="space-y-4"
          >
            <Button
              type="submit"
              size="lg"
              className="group relative h-12 w-full justify-between overflow-hidden text-base"
            >
              <span className="font-display text-lg italic">Begin</span>
              <span className="font-mono-num text-xs tracking-widest opacity-80 transition-transform group-hover:translate-x-1">
                google&nbsp;→
              </span>
            </Button>
            <p className="text-center font-mono-num text-[0.7rem] uppercase tracking-[0.2em] text-foreground/45">
              read-only · classroom + drive
            </p>
          </form>

          {session?.error === "RefreshTokenError" ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Your session expired — please sign in again.
            </div>
          ) : null}
        </div>

        <p className="mt-12 text-center font-display text-xs italic text-foreground/45">
          a single-teacher edition
        </p>
      </aside>
    </main>
  );
}
