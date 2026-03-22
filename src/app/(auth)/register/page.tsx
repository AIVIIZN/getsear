"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Smartphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RegistrationState = "input" | "loading" | "success" | "error";

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|iphone|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Record<string, unknown>).standalone === true)
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [state, setState] = useState<RegistrationState>("input");
  const [errorMessage, setErrorMessage] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const platform = detectPlatform();

  const handleActivate = useCallback(
    async (code: string) => {
      setState("loading");
      setErrorMessage("");

      try {
        const deviceInfo = {
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          platform: navigator.platform,
          standalone: isStandalone(),
        };

        const res = await fetch("/api/terminals/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_code: code,
            device_info: deviceInfo,
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({ error: "Activation failed" }));
          throw new Error(json.error ?? "Activation failed");
        }

        const data = await res.json();

        // Store terminal ID for heartbeat
        localStorage.setItem("sear_terminal_id", data.terminal_id);
        localStorage.setItem("sear_terminal_name", data.name);
        localStorage.setItem("sear_default_view", data.default_view ?? "pos");

        setTerminalName(data.name);
        setState("success");
      } catch (err) {
        setState("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to activate terminal"
        );
        // Reset digits so user can try again
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    },
    []
  );

  function handleDigitChange(index: number, value: string) {
    // Only allow single digit
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const code = newDigits.join("");
      if (code.length === 6) {
        handleActivate(code);
      }
    } else if (digit) {
      // Check if all filled after setting middle digit
      const allFilled = newDigits.every((d) => d !== "");
      if (allFilled) {
        handleActivate(newDigits.join(""));
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setDigits(newDigits);

    if (pasted.length === 6) {
      handleActivate(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  }

  // Focus first input on mount
  useEffect(() => {
    if (state === "input") {
      inputRefs.current[0]?.focus();
    }
  }, [state]);

  if (state === "success") {
    return (
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Checkmark animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 animate-ping rounded-full bg-[var(--success)]/20" />
          <CheckCircle2 className="relative h-16 w-16 text-[var(--success)] animate-in zoom-in-50 duration-500" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Device Registered!
          </h2>
          <p className="text-sm text-muted-foreground">
            This device is now registered as{" "}
            <span className="font-medium text-foreground">{terminalName}</span>.
          </p>
        </div>

        {/* Add to Home Screen instructions */}
        {!isStandalone() && (
          <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4 text-left">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--primary)]" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Add to Home Screen
                </p>
                {platform === "ios" ? (
                  <p className="text-sm text-muted-foreground">
                    Tap the{" "}
                    <span className="inline-flex items-center rounded bg-[var(--muted)] px-1.5 py-0.5 font-medium text-foreground">
                      Share
                    </span>{" "}
                    button, then select{" "}
                    <span className="font-medium text-foreground">
                      &quot;Add to Home Screen&quot;
                    </span>{" "}
                    for a fullscreen app experience.
                  </p>
                ) : platform === "android" ? (
                  <p className="text-sm text-muted-foreground">
                    Tap the{" "}
                    <span className="inline-flex items-center rounded bg-[var(--muted)] px-1.5 py-0.5 font-medium text-foreground">
                      Menu
                    </span>{" "}
                    button, then select{" "}
                    <span className="font-medium text-foreground">
                      &quot;Install App&quot;
                    </span>{" "}
                    or{" "}
                    <span className="font-medium text-foreground">
                      &quot;Add to Home Screen&quot;
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Install this app for the best experience. Look for the install
                    option in your browser menu.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={() => router.push("/orders")}
          className="h-12 w-full text-base btn-press touch-target"
        >
          Open POS
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Register this Device
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code shown on your admin screen.
        </p>
      </div>

      {/* Error message */}
      {state === "error" && errorMessage && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-[var(--error)]" />
          <p className="text-sm text-[var(--error)]">{errorMessage}</p>
        </div>
      )}

      {/* 6-digit code input */}
      <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={state === "loading"}
            className={cn(
              "h-16 w-14 rounded-lg border-2 bg-[var(--background)] text-center text-2xl font-bold text-foreground",
              "outline-none transition-all duration-150",
              "focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20",
              state === "error"
                ? "border-[var(--error)] animate-shake"
                : "border-[var(--border)]",
              state === "loading" && "opacity-50 cursor-not-allowed"
            )}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Activating device...
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Don&apos;t have a code? Ask your manager to generate one from
        Settings &rarr; Terminals.
      </p>
    </div>
  );
}
