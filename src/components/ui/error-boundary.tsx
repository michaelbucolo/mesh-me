"use client";

import { Component, type ReactNode } from "react";
import { ThemedErrorScreen } from "@/components/errors/themed-error-screen";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ThemedErrorScreen
          code="Component fallback"
          eyebrow="Mesh.me protection"
          title="This section needs a refresh"
          description="A component stopped rendering, but the rest of Mesh.me is still protected and recoverable."
          mood="surprised"
          compact
          onReset={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
          }}
          primaryLink={{ href: "/mesh", label: "Back to Mesh" }}
          secondaryLink={{ href: "/", label: "Home" }}
        />
      );
    }

    return this.props.children;
  }
}
