import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[#006B66]/40 focus-visible:ring-[3px] transition-all tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#006B66] text-white shadow-xs [a&]:hover:bg-[#005753]",
        secondary:
          "border-transparent bg-[#173B5E]/10 text-[#173B5E] dark:bg-[#173B5E]/30 dark:text-[#E9F4F2] [a&]:hover:bg-[#173B5E]/20",
        destructive:
          "border-transparent bg-[#B42318] text-white [a&]:hover:bg-[#912015]",
        outline:
          "border-[#006B66]/40 text-[#006B66] bg-[#006B66]/5 [a&]:hover:bg-[#006B66]/10",
        guna: "bg-[#006B66]/15 text-[#006B66] border-[#006B66]/30 font-bold dark:text-[#55EFC4]",
        gunaEmerald: "bg-[#1D7046]/15 text-[#1D7046] border-[#1D7046]/30 font-bold dark:bg-[#1D7046]/25 dark:text-[#55EFC4]",
        gunaRose: "bg-[#B42318]/15 text-[#B42318] border-[#B42318]/30 font-bold dark:bg-[#B42318]/25 dark:text-[#FFA39E]",
        gunaAmber: "bg-[#D8A443]/20 text-[#915500] border-[#D8A443]/40 font-bold dark:bg-[#D8A443]/20 dark:text-[#D8A443]",
        gunaCyan: "bg-[#205781]/15 text-[#205781] border-[#205781]/30 font-bold dark:bg-[#205781]/25 dark:text-[#A5C8E4]",
        civic: "bg-[#173B5E] text-white border-transparent font-bold",
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
