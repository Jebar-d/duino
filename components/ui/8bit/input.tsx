import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { Input as ShadcnInput } from "@/components/ui/input";

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

export interface BitInputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  inputClassName?: string;
}

function Input({
  className,
  font = "normal",
  inputClassName,
  ...props
}: BitInputProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 items-center border-y-2 border-foreground dark:border-ring",
        className
      )}
    >
      <ShadcnInput
        {...props}
        className={cn(
          "h-full w-full rounded-none border-0 px-3 py-1 text-sm ring-0",
          font !== "normal" && "retro",
          inputClassName
        )}
      />

      <div
        className="pointer-events-none absolute inset-0 border-x-2 border-foreground dark:border-ring"
        aria-hidden="true"
      />
    </div>
  );
}

export { Input };
