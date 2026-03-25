"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, UserPlus } from "lucide-react";
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
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="neo-surface hidden p-8 md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Create your workspace</p>
          <h1 className="mt-3 text-4xl font-black">Build a cleaner home for transactions, receipts, and obligations.</h1>
          <p className="mt-4 text-sm leading-7 text-taupe">
            Sign up uses standard form validation, email OTP verification, and the same protected routing rules as the rest of the product.
          </p>
        </div>
        <div className="neo-surface-lg p-8">
          {!verificationStep ? (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Sign up</p>
                <h2 className="mt-3 text-3xl font-black">Create your account</h2>
              </div>
              <Form {...signUpForm}>
                <form className="space-y-5" onSubmit={signUpForm.handleSubmit(handleSignUp)}>
                  <FormField
                    control={signUpForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ayush" />
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
                          <Input {...field} type="email" placeholder="you@example.com" />
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
                          <Input {...field} type="password" placeholder="At least 6 characters" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {signUpForm.formState.errors.root ? (
                    <div className="rounded-neo border-brutal bg-red-50 px-4 py-3 text-sm text-danger">
                      {signUpForm.formState.errors.root.message}
                    </div>
                  ) : null}
                  <Button type="submit" size="lg" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                    {signUpForm.formState.isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {signUpForm.formState.isSubmitting ? "Sending code..." : "Create account"}
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Verify email</p>
                <h2 className="mt-3 text-3xl font-black">Enter the code we sent to {currentEmail}</h2>
              </div>
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
                    <div className="rounded-neo border-brutal bg-red-50 px-4 py-3 text-sm text-danger">
                      {otpForm.formState.errors.root.message}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" size="lg" className="flex-1" disabled={otpForm.formState.isSubmitting}>
                      {otpForm.formState.isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                      Verify and enter app
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={handleResend}>
                      Resend
                    </Button>
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
        </div>
      </div>
    </div>
  );
}
