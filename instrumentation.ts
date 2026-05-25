import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

const dsn = process.env.SENTRY_DSN;

export async function register() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    beforeSend(event) {
      delete event.user?.email;
      delete event.user?.ip_address;
      return event;
    },
  });
}

export const onRequestError: Instrumentation.onRequestError = (...args) => {
  Sentry.captureRequestError(...args);
};
