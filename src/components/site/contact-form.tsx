"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, MessageSquareText, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { siteConfig } from "@/lib/site";

const contactSchema = z.object({
  name: z.string().min(2, "Tell us your name."),
  email: z.string().email("Enter a valid email address."),
  subject: z.string().min(4, "Add a short subject."),
  message: z.string().min(20, "Give a bit more context so support can help."),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactForm() {
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  function onSubmit(values: ContactValues) {
    track("contact_support_submit", { subject: values.subject });
    const mailto = new URL(`mailto:${siteConfig.supportEmail}`);
    mailto.searchParams.set("subject", `[Vasoli] ${values.subject}`);
    mailto.searchParams.set(
      "body",
      `Name: ${values.name}\nEmail: ${values.email}\n\n${values.message}`,
    );
    window.location.href = mailto.toString();
    toast.success("Opening your email client");
  }

  return (
    <div className="neo-surface-lg p-6 md:p-8">
      <div className="mb-6 space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border-brutal bg-paper-1 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
          <Mail className="size-3.5" />
          Support
        </p>
        <h2 className="text-3xl font-black">Talk to a human</h2>
        <p className="max-w-xl text-sm leading-6 text-taupe">
          Use the form for product support, partnership questions, or bug reports. It opens your email client with the
          details prefilled so nothing disappears into a void.
        </p>
      </div>

      <Form {...form}>
        <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
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
            name="subject"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Subject</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Need help with receipts" />
                </FormControl>
                <FormDescription>Keep it short. We only use it to route the conversation faster.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={7} placeholder="Tell us what happened, what you expected, and how we can help." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-w-40">
              <Send className="size-4" />
              Open email draft
            </Button>
            <p className="text-sm text-taupe">
              Prefer direct email?{" "}
              <a href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-ink underline underline-offset-4">
                {siteConfig.supportEmail}
              </a>
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}
