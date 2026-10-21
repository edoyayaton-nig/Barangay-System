import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[#006B66]/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#006B66] text-white hover:bg-[#005753] shadow-[0_4px_14px_rgba(0,107,102,0.3)] hover:shadow-[0_6px_20px_rgba(0,107,102,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-[#B42318] text-white hover:bg-[#912015] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border-2 border-[#006B66] text-[#006B66] bg-transparent hover:bg-[#006B66] hover:text-white shadow-xs hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-[#173B5E] text-white hover:bg-[#0F2740] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        ghost:
          "hover:bg-[#006B66]/10 hover:text-[#006B66]",
        link: "text-[#006B66] underline-offset-4 hover:underline",
        accent:
          "bg-[#D8A443] text-[#1C2B36] hover:bg-[#C29035] shadow-sm hover:shadow-md font-bold hover:-translate-y-0.5 active:translate-y-0",
        guna: "bg-[#006B66] text-white hover:bg-[#005753] shadow-[0_6px_20px_-2px_rgba(0,107,102,0.35)] hover:shadow-[0_8px_25px_-2px_rgba(0,107,102,0.5)] font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0",
        gunaGradient: "bg-gradient-to-r from-[#173B5E] to-[#006B66] text-white border-0 shadow-[0_6px_20px_-2px_rgba(23,59,94,0.35)] hover:shadow-[0_10px_28px_-2px_rgba(0,107,102,0.45)] font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0",
        gunaEmerald: "bg-gradient-to-r from-[#1D7046] to-[#006B66] text-white border-0 shadow-[0_6px_20px_-2px_rgba(29,112,70,0.35)] hover:shadow-[0_8px_25px_-2px_rgba(0,107,102,0.45)] font-bold hover:-translate-y-0.5 active:translate-y-0",
        gunaRose: "bg-gradient-to-r from-[#B42318] to-[#D8A443] text-white border-0 shadow-[0_6px_20px_-2px_rgba(180,35,24,0.35)] hover:shadow-[0_8px_25px_-2px_rgba(216,164,67,0.45)] font-bold hover:-translate-y-0.5 active:translate-y-0",
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
