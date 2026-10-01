import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { APP_MARK, APP_NAME } from "@/lib/brand";

/**
 * Static frame for the real screen at /login. Rendered without a form action so
 * it can sit in the mockup grid — the live page is the source of truth.
 */
export function LoginScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-card-muted px-5 py-10 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-[13px] font-semibold text-accent-ink">
            {APP_MARK}
          </div>
          <span className="text-[15px] font-semibold text-ink">{APP_NAME}</span>
        </div>

        <Card className="p-6">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink">
            Sign in
          </h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Use the email and password your dispatcher set up.
          </p>

          <div className="mt-5 space-y-4">
            <Field id="mockup-login-email" label="Email">
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  placeholder="you@company.com"
                  readOnly
                />
              )}
            </Field>

            <Field id="mockup-login-password" label="Password">
              {(control) => <Input {...control} type="password" readOnly />}
            </Field>

            <Button size="md" className="w-full">
              Sign in
            </Button>
          </div>

          <p className="mt-5 border-t border-hairline-soft pt-4 text-[12px] leading-relaxed text-ink-muted">
            No account yet?{" "}
            <span className="font-medium text-accent">Request access</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
