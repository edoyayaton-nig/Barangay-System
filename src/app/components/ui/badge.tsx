import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[#6458FF]/50 focus-visible:ring-[3px] transition-all tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#6458FF] text-white shadow-xs [a&]:hover:bg-[#5044E5]",
        secondary:
          "border-transparent bg-[#6458FF]/10 text-[#6458FF] [a&]:hover:bg-[#6458FF]/20",
        destructive:
          "border-transparent bg-[#FF6492] text-white [a&]:hover:bg-[#FF6492]/90",
        outline:
          "border-[#6458FF]/40 text-[#6458FF] bg-[#6458FF]/5 [a&]:hover:bg-[#6458FF]/10",
        guna: "bg-[#6458FF]/15 text-[#6458FF] border-[#6458FF]/30 font-bold",
        gunaEmerald: "bg-[#00B894]/15 text-[#00B894] border-[#00B894]/30 font-bold",
        gunaRose: "bg-[#FF6492]/15 text-[#FF6492] border-[#FF6492]/30 font-bold",
        gunaAmber: "bg-[#FFA502]/15 text-[#FFA502] border-[#FFA502]/30 font-bold",
        gunaCyan: "bg-[#00C6FF]/15 text-[#0098C7] border-[#00C6FF]/30 font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
