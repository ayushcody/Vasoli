"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
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

function safeRedirectPath(value: string | null) {
  const fallback = "/app/dashboard";
  if (!value) return fallback;

  try {
    const base = "https://vasoli.invalid";
    const target = new URL(value, base);
    if (target.origin !== base || !/^\/app(?:\/|$)/.test(target.pathname)) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export default function SignInPage() {
  const searchParams = useSearchParams();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function signIn(values: SignInValues) {
    const supabase = createClient();
    const redirectedFrom = safeRedirectPath(searchParams.get("redirectedFrom"));

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
                <NeoButton type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
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
