"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, UserPlus } from "lucide-react";
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

const signUpSchema = z.object({
  name: z.string().min(2, "Tell us your name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password should be at least 6 characters."),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter the full 6-digit code."),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type OtpValues = z.infer<typeof otpSchema>;

export default function SignUpPage() {
  const inviteOnly = process.env.NEXT_PUBLIC_PILOT_INVITE_ONLY !== "false";
  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  const otpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const currentEmail = signUpForm.watch("email");
  const verificationStep = Boolean(signUpForm.formState.isSubmitSuccessful);

  async function handleSignUp(values: SignUpValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name },
      },
    });

    if (error) {
      signUpForm.setError("root", { message: error.message });
      throw error;
    }
  }

  async function handleVerify(values: OtpValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: values.otp,
      type: "signup",
    });

    if (error) {
      otpForm.setError("root", { message: error.message });
      return;
    }

    window.location.href = "/app/dashboard";
  }

  async function handleResend() {
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: currentEmail,
    });
  }

  return (
    <div className="min-h-screen bg-paper-1 px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center justify-center">
        <Panel className="w-full rounded-neo-lg border-brutal-thick bg-paper-2 shadow-brutal">
          <PanelHeader className="border-b-0 pb-2">
            <div className="mb-4 grid size-16 place-items-center rounded-neo-md border-brutal-thick bg-mustard font-serif text-3xl font-black text-ink">
              V
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">
              {inviteOnly ? "Private pilot" : verificationStep ? "Verify email" : "Sign up"}
            </p>
            <PanelTitle>{inviteOnly ? "Vasoli is invite-only right now" : verificationStep ? `Enter the code sent to ${currentEmail}` : "Create your account"}</PanelTitle>
            <p className="text-sm leading-7 text-taupe">
              {inviteOnly
                ? "New account creation is paused during the private pilot. If you already have access, sign in with your invited account."
                : verificationStep
                ? "Finish verification to activate the workspace."
                : "Create a Vasoli account with email verification before entering the protected app."}
            </p>
          </PanelHeader>
          <PanelContent>
          {inviteOnly ? (
            <div className="rounded-neo border-brutal bg-paper-1 p-4 text-sm text-ink">
              Ask your pilot host for an invite. You can still sign in if you already have an account.
            </div>
          ) : !verificationStep ? (
            <>
              <Form {...signUpForm}>
                <form className="space-y-5" onSubmit={signUpForm.handleSubmit(handleSignUp)}>
                  <FormField
                    control={signUpForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <NeoInput {...field} placeholder="Ayush" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signUpForm.control}
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
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <NeoInput {...field} type="password" placeholder="At least 6 characters" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {signUpForm.formState.errors.root ? (
                    <NeoBadge variant="danger" className="w-full justify-center px-4 py-3 text-sm normal-case tracking-normal">
                      {signUpForm.formState.errors.root.message}
                    </NeoBadge>
                  ) : null}
                  <NeoButton type="submit" size="lg" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                    {signUpForm.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {signUpForm.formState.isSubmitting ? "Sending code..." : "Create account"}
                  </NeoButton>
                </form>
              </Form>
            </>
          ) : (
            <>
              <Form {...otpForm}>
                <form className="space-y-5" onSubmit={otpForm.handleSubmit(handleVerify)}>
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>6-digit code</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} value={field.value} onChange={field.onChange}>
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, index) => (
                                <InputOTPSlot key={index} index={index} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {otpForm.formState.errors.root ? (
                    <NeoBadge variant="danger" className="w-full justify-center px-4 py-3 text-sm normal-case tracking-normal">
                      {otpForm.formState.errors.root.message}
                    </NeoBadge>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <NeoButton type="submit" size="lg" className="flex-1" disabled={otpForm.formState.isSubmitting}>
                      {otpForm.formState.isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                      Verify and enter app
                    </NeoButton>
                    <NeoButton type="button" variant="secondary" size="lg" onClick={handleResend}>
                      Resend
                    </NeoButton>
                  </div>
                </form>
              </Form>
            </>
          )}
          <p className="mt-6 text-sm text-taupe">
            Already have an account?{" "}
            <Link href="/auth/signin" className="font-semibold text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
