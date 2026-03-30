"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { NeoBadge } from "@/components/ui/neo-badge";
import { NeoButton } from "@/components/ui/neo-button";
import { NeoInput } from "@/components/ui/neo-input";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createClient } from "@/lib/supabase/browser";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password should be at least 6 characters."),
});

type SignInValues = z.infer<typeof signInSchema>;

const DEMO_CREDENTIALS = {
  email: "demo@vasoli.app",
  password: "demo123456",
};

export default function SignInPage() {
  const searchParams = useSearchParams();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password,
    },
  });

  async function signIn(values: SignInValues) {
    const supabase = createClient();
    const redirectedFrom = searchParams.get("redirectedFrom") || "/app/dashboard";

    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      form.setError("root", {
        message: error.message,
      });
      return;
    }

    window.location.href = redirectedFrom;
  }

  async function onSubmit(values: SignInValues) {
    await signIn(values);
  }

  async function handleDemoLogin() {
    form.clearErrors("root");
    form.setValue("email", DEMO_CREDENTIALS.email, { shouldDirty: true });
    form.setValue("password", DEMO_CREDENTIALS.password, { shouldDirty: true });
    setIsDemoLoading(true);
    try {
      await signIn(DEMO_CREDENTIALS);
    } finally {
      setIsDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-1 px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center justify-center">
        <Panel className="w-full rounded-neo-lg border-brutal-thick bg-paper-2 shadow-brutal">
          <PanelHeader className="border-b-0 pb-2">
            <div className="mb-4 grid size-16 place-items-center rounded-neo-md border-brutal-thick bg-mustard font-serif text-3xl font-black text-ink">
              V
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Sign in</p>
            <PanelTitle>Access your account</PanelTitle>
            <p className="text-sm leading-7 text-taupe">
              Use your existing Vasoli account to get back to the dashboard, ledger, and monthly review loop.
            </p>
          </PanelHeader>
          <PanelContent>
            <div className="mb-5 rounded-neo-md border-brutal bg-paper-1 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Demo Access</p>
                  <p className="mt-2 text-sm text-ink">
                    Use the shared demo user to enter the product instantly.
                  </p>
                </div>
                <NeoButton
                  type="button"
                  variant="mustard"
                  size="sm"
                  onClick={handleDemoLogin}
                  disabled={form.formState.isSubmitting || isDemoLoading}
                >
                  {isDemoLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {isDemoLoading ? "Opening Demo..." : "Demo Login"}
                </NeoButton>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Demo Email</p>
                  <p className="mt-1 rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm text-ink">
                    {DEMO_CREDENTIALS.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Demo Password</p>
                  <p className="mt-1 rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm text-ink">
                    {DEMO_CREDENTIALS.password}
                  </p>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <NeoInput {...field} type="email" placeholder="you@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <NeoInput {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.formState.errors.root ? (
                  <NeoBadge variant="danger" className="w-full justify-center px-4 py-3 text-sm normal-case tracking-normal">
                    {form.formState.errors.root.message}
                  </NeoBadge>
                ) : null}
                <NeoButton type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting || isDemoLoading}>
                  {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
                </NeoButton>
              </form>
            </Form>
            <p className="mt-6 text-sm text-taupe">
              New here?{" "}
              <Link href="/auth/signup" className="font-semibold text-ink underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
