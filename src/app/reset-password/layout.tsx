import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password to get back into your Mesh.",
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
