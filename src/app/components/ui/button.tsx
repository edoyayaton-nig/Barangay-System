import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[#6458FF]/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#6458FF] text-white hover:bg-[#5044E5] shadow-[0_4px_14px_rgba(100,88,255,0.35)] hover:shadow-[0_6px_20px_rgba(100,88,255,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-[#FF6492] text-white hover:bg-[#E04B76] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border-2 border-[#6458FF] text-[#6458FF] bg-transparent hover:bg-[#6458FF] hover:text-white shadow-xs hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#6458FF]/10 hover:text-[#6458FF] hover:-translate-y-0.5 active:translate-y-0",
        ghost:
          "hover:bg-[#6458FF]/10 hover:text-[#6458FF]",
        link: "text-[#6458FF] underline-offset-4 hover:underline",
        guna: "bg-[#6458FF] text-white hover:bg-[#5044E5] shadow-[0_6px_20px_-2px_rgba(100,88,255,0.4)] hover:shadow-[0_8px_25px_-2px_rgba(100,88,255,0.55)] font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0",
        gunaGradient: "bg-gradient-to-r from-[#6458FF] to-[#00C6FF] text-white border-0 shadow-[0_6px_20px_-2px_rgba(100,88,255,0.45)] hover:shadow-[0_10px_28px_-2px_rgba(0,198,255,0.55)] font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0",
        gunaEmerald: "bg-gradient-to-r from-[#00B894] to-[#55EFC4] text-white border-0 shadow-[0_6px_20px_-2px_rgba(0,184,148,0.4)] hover:shadow-[0_8px_25px_-2px_rgba(0,184,148,0.55)] font-bold hover:-translate-y-0.5 active:translate-y-0",
        gunaRose: "bg-gradient-to-r from-[#FF6492] to-[#FFA502] text-white border-0 shadow-[0_6px_20px_-2px_rgba(255,100,146,0.4)] hover:shadow-[0_8px_25px_-2px_rgba(255,100,146,0.55)] font-bold hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-full gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-full px-7 text-base font-bold has-[>svg]:px-5 shadow-md",
        icon: "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
