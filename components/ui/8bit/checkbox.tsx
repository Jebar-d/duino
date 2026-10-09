import type * as React from "react";

import type * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import "@/components/ui/8bit/styles/retro.css";

export const checkboxVariants = cva("", {
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

export interface BitCheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {
  asChild?: boolean;
}

function Checkbox({ className, font = "normal", ...props }: BitCheckboxProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-y-2 border-foreground dark:border-ring",
        className
      )}
    >
      <ShadcnCheckbox
        className={cn(
          "size-4 rounded-none border-none ring-0",
          font !== "normal" && "retro",
        )}
        {...props}
      />

      <div
        className="pointer-events-none absolute inset-0 border-x-2 border-foreground dark:border-ring"
        aria-hidden="true"
      />
    </div>
  );
}

export { Checkbox };
