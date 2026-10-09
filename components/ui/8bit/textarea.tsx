import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";

import "@/components/ui/8bit/styles/retro.css";

export const inputVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "normal",
  },
});

export interface BitTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof inputVariants> {}

function Textarea({ className, font = "normal", ...props }: BitTextareaProps) {
  return (
    <div
      className={cn(
        "relative w-full border-y-2 border-foreground dark:border-ring",
        className
      )}
    >
      <ShadcnTextarea
        {...props}
        className={cn(
          "min-h-24 w-full resize-y rounded-none border-0 px-3 py-2 text-sm transition-transform ring-0",
          font !== "normal" && "retro"
        )}
      />

      <div
        className="pointer-events-none absolute inset-0 border-y-2 border-foreground dark:border-ring"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 border-x-2 border-foreground dark:border-ring"
        aria-hidden="true"
      />
    </div>
  );
}

export { Textarea };
