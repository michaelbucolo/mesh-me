"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Eye, EyeOff, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminDeletePost,
  adminResolveCommunityReports,
  adminResolveReport,
  adminSetCommunityVisibility,
  adminSuspendUser,
} from "@/lib/actions";

type AdminActionsProps =
  | { type: "user"; id: string; isSuspended?: boolean }
  | { type: "report"; id: string }
  | { type: "post"; id: string }
  | { type: "community"; id: string; isPublic: boolean; reportCount: number };

export function AdminActions(props: AdminActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(String(result.error));
        return;
      }
      router.refresh();
    });
  };

  if (props.type === "user") {
    return (
      <div className="space-y-1">
        <Button
          onClick={() => run(() => adminSuspendUser(props.id))}
          disabled={isPending}
          variant={props.isSuspended ? "secondary" : "danger"}
          size="sm"
          className="text-xs"
          leftIcon={<Ban className="h-3 w-3" />}
        >
          {props.isSuspended ? "Unsuspend" : "Suspend"}
        </Button>
        {error ? <p className="text-[10px] text-[var(--ds-danger)]">{error}</p> : null}
      </div>
    );
  }

  if (props.type === "report") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Button
            onClick={() => run(() => adminResolveReport(props.id, "resolved"))}
            disabled={isPending}
            variant="success"
            size="icon-sm"
            aria-label="Resolve report"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => run(() => adminResolveReport(props.id, "dismissed"))}
            disabled={isPending}
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss report"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {error ? <p className="text-[10px] text-[var(--ds-danger)]">{error}</p> : null}
      </div>
    );
  }

  if (props.type === "post") {
    return (
      <div className="space-y-1">
        <Button
          onClick={() => run(() => adminDeletePost(props.id))}
          disabled={isPending}
          variant="danger"
          size="sm"
          className="text-xs"
          leftIcon={<Trash2 className="h-3 w-3" />}
        >
          Delete post
        </Button>
        {error ? <p className="text-[10px] text-[var(--ds-danger)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => run(() => adminSetCommunityVisibility(props.id, !props.isPublic))}
        disabled={isPending}
        variant="secondary"
        size="sm"
        className="text-xs"
        leftIcon={props.isPublic ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      >
        {props.isPublic ? "Make private" : "Make public"}
      </Button>
      {props.reportCount > 0 ? (
        <Button
          onClick={() => run(() => adminResolveCommunityReports(props.id))}
          disabled={isPending}
          variant="success"
          size="sm"
          className="text-xs"
          leftIcon={<Check className="h-3 w-3" />}
        >
          Resolve reports
        </Button>
      ) : null}
      {error ? <p className="basis-full text-[10px] text-[var(--ds-danger)]">{error}</p> : null}
    </div>
  );
}
