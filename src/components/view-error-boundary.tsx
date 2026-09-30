"use client";

import Link from "next/link";
import { Component, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Keeps the shell up when one view throws. Navigation remounts this boundary. */
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-10 text-center">
        <p className="font-medium">This view ran into a problem.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          The rest of the desk is still available.
        </p>
        <div className="mt-4 flex justify-center">
          <Link href="/" className={buttonVariants()}>
            Back to the Dashboard
          </Link>
        </div>
      </div>
    );
  }
}
