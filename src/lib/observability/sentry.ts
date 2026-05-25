import * as Sentry from "@sentry/nextjs";
import type { LogFields } from "./logger";

function hasSentryDsn() {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function addSentryBreadcrumb(message: string, fields: LogFields) {
  if (!hasSentryDsn()) return;

  Sentry.addBreadcrumb({
    category: "sear.log",
    level: "info",
    message,
    data: {
      req_id: fields.req_id,
      route: fields.route,
      method: fields.method,
      status: fields.status,
      duration_ms: fields.duration_ms,
      org_id: fields.org_id,
      user_id: fields.user_id,
    },
  });
}

export function captureLoggedError(message: string, fields: LogFields) {
  if (!hasSentryDsn()) return;

  Sentry.withScope((scope) => {
    if (typeof fields.req_id === "string") scope.setTag("req_id", fields.req_id);
    if (typeof fields.route === "string") scope.setTag("route", fields.route);
    if (typeof fields.org_id === "string") scope.setTag("org_id", fields.org_id);
    if (typeof fields.user_id === "string") scope.setUser({ id: fields.user_id });

    const error = new Error(typeof fields.err === "string" ? fields.err : message);
    if (typeof fields.err_stack === "string") {
      error.stack = fields.err_stack;
    }
    Sentry.captureException(error);
  });
}

export function captureRouteGroupError(
  error: Error & { digest?: string },
  routeGroup: string,
) {
  if (!hasSentryDsn()) return;

  Sentry.withScope((scope) => {
    scope.setTag("route_group", routeGroup);
    if (error.digest) scope.setTag("digest", error.digest);
    Sentry.captureException(error);
  });
}
