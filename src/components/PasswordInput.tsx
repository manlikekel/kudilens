import { forwardRef, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide button. */
export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          type={show ? "text" : "password"}
          className={cn("pr-12", className)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

/** The rules every new password must meet. */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "A letter", test: (p) => /[A-Za-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
];

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

/** Live checklist under a new-password field; a symbol is suggested but not required. */
export function PasswordHints({ value }: { value: string }) {
  const strong = passwordOk(value) && (value.length >= 12 || /[^A-Za-z0-9]/.test(value));
  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li
              key={r.label}
              className={cn(
                "flex items-center gap-1",
                ok ? "text-success" : "text-muted-foreground",
              )}
            >
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {r.label}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {strong
          ? "Strong password."
          : "Tip: add a symbol (like ! or #) or make it 12+ characters to make it stronger. Avoid your name or birthday."}
      </p>
    </div>
  );
}
