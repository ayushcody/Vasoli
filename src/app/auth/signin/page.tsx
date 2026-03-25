"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password should be at least 6 characters."),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const searchParams = useSearchParams();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignInValues) {
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

  return (
    <div className="min-h-screen bg-paper-1 px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="neo-surface hidden p-8 md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Welcome back</p>
          <h1 className="mt-3 text-4xl font-black">Open your financial workspace with clean auth gating.</h1>
          <p className="mt-4 text-sm leading-7 text-taupe">
            Sign in to access the protected app shell, command palette, receipts, obligations, and your latest monthly zine.
          </p>
        </div>
        <div className="neo-surface-lg p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Sign in</p>
            <h2 className="mt-3 text-3xl font-black">Access your account</h2>
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
                      <Input {...field} type="email" placeholder="you@example.com" />
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
                      <Input {...field} type="password" placeholder="••••••••" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root ? (
                <div className="rounded-neo border-brutal bg-red-50 px-4 py-3 text-sm text-danger">
                  {form.formState.errors.root.message}
                </div>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-sm text-taupe">
            New here?{" "}
            <Link href="/auth/signup" className="font-semibold text-ink underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
