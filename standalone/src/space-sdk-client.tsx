import { QueryClient } from "@tanstack/react-query";
import type { CSSProperties, HTMLAttributes } from "react";

// Minimal local replacements for the parts of @hatch/space-sdk/client
// that the Pomodoro UI uses. The standalone server implements the same
// POST /actions protocol, so the original client code can stay unchanged.

export const spaceQueryClient = new QueryClient();

export type ApiRequest<_Actions = unknown> = Record<string, unknown>;
export type ApiResponse<_Actions = unknown, _Action = unknown> = unknown;

type ActionFunction = (args?: Record<string, unknown>) => Promise<unknown>;

export function createActionClient<
  Actions extends Record<string, unknown>,
>(): Actions {
  const client = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") return undefined;

        const call: ActionFunction = async (args = {}) => {
          const response = await fetch("/actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: property, args }),
          });
          const data: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const message =
              data &&
              typeof data === "object" &&
              "error" in data &&
              typeof data.error === "string"
                ? data.error
                : `Action ${property} failed (${response.status})`;
            throw new Error(message);
          }
          return data;
        };
        return call;
      },
    },
  );

  return client as unknown as Actions;
}

export interface SafeAreaTopScrimProps
  extends HTMLAttributes<HTMLDivElement> {
  backgroundColor?: string;
  variant?: "gradient" | "blur" | "solid";
  zIndex?: number;
}

export function SafeAreaTopScrim({
  backgroundColor,
  style,
  ...props
}: SafeAreaTopScrimProps) {
  const scrimStyle: CSSProperties = {
    height: "env(safe-area-inset-top, 0px)",
    backgroundColor,
    ...style,
  };
  return <div aria-hidden="true" style={scrimStyle} {...props} />;
}
