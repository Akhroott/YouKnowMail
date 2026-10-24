import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

export function Logo({
  className,
  showWordmark = true,
  size = "md",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md";
}) {
  const mark = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const word = size === "sm" ? "text-sm" : "text-base";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-foreground text-background",
          mark
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className={icon} fill="none">
          <path
            d="M4 7.5 12 13l8-5.5M5 18h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showWordmark ? (
        <span className={cn("font-semibold tracking-tight text-foreground", word)}>
          {APP_NAME}
        </span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </div>
  );
}
