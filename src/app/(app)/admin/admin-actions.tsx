"use client";

import { Button } from "@/components/ui/button";
import { adminSuspendUser, adminResolveReport } from "@/lib/actions";
import { useTransition } from "react";
import { Ban, Check, X } from "lucide-react";

interface AdminActionsProps {
  type: "user" | "report";
  id: string;
  isSuspended?: boolean;
}

export function AdminActions({ type, id, isSuspended }: AdminActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (type === "user") {
    return (
      <Button
        onClick={() => startTransition(() => { adminSuspendUser(id); })}
        disabled={isPending}
        variant={isSuspended ? "secondary" : "danger"}
        size="sm"
        className="text-xs"
      >
        <Ban className="h-3 w-3" />
        {isSuspended ? "Unsuspend" : "Suspend"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={() => startTransition(() => { adminResolveReport(id, "resolved"); })}
        disabled={isPending}
        variant="success"
        size="icon-sm"
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        onClick={() => startTransition(() => { adminResolveReport(id, "dismissed"); })}
        disabled={isPending}
        variant="ghost"
        size="icon-sm"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
