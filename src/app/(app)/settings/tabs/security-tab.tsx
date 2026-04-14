"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/actions";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";

interface SecurityTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export function SecurityTab({ showSuccess, showError }: SecurityTabProps) {
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result && "error" in result) {
        showError(result.error || "Failed to change password");
      } else {
        showSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  return (
    <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleChangePassword} className="space-y-5">
      <MeshiSettingsTip tab="security" />
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Change password</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">Choose a strong password with at least 8 characters</p>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Current password</label>
        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">New password</label>
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Confirm new password</label>
        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
      </div>
      <Button type="submit" variant="gradient" disabled={isPending}>
        {isPending ? "Changing..." : "Change password"}
      </Button>
    </motion.form>
  );
}
