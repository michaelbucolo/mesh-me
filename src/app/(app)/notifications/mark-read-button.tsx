"use client";

import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/lib/actions";
import { useTransition } from "react";
import { Check } from "lucide-react";

export function MarkReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => startTransition(async () => { await markNotificationsRead(); })}
      disabled={isPending}
      variant="ghost"
      size="sm"
    >
      <Check className="h-4 w-4" />
      {isPending ? "Marking..." : "Mark all read"}
    </Button>
  );
}
