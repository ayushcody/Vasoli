"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

export function ScreenEmptyState({ icon: Icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="neo-surface-lg p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full border-brutal bg-paper-1">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-2xl font-black">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-taupe">{description}</p>
      {cta ? (
        <div className="mt-6">
          {cta.href ? (
            <Button asChild>
              <Link href={cta.href}>
                {cta.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button onClick={cta.onClick}>
              {cta.label}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function InlineErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[1.25rem] border-brutal-thick bg-red-50 p-5 text-danger">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-ink/70">{description || "Retry the request or move to another part of the app."}</p>
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function FirstRunHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.25rem] border-brutal bg-mustard/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">First run hint</p>
      <p className="mt-2 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink/75">{description}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="neo-surface overflow-hidden">
      <div className="grid grid-cols-4 gap-3 border-b-brutal bg-paper-1 px-4 py-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      <div className="space-y-0">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-3 border-b-brutal px-4 py-4 last:border-b-0">
            {Array.from({ length: 4 }).map((_, cellIndex) => (
              <Skeleton key={cellIndex} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
