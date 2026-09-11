"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selection chips with the spring layout animation from the cuisine selector,
 * generalised: the original hard-coded 24 cuisines and its own dark page.
 * Planzo uses the same interaction for interests, dietary needs, vibe and
 * budget, so the list is a prop and the colour comes from the theme.
 */
export type SelectorChipsProps = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
  className?: string;
  size?: "sm" | "md";
  /** Cap how many can be selected at once (multi mode only) — picking a
   * new one past the cap replaces the first pick rather than doing nothing,
   * so the interaction never just silently fails to respond to a tap. */
  max?: number;
};

const spring = { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.5 };

export function SelectorChips({ options, value, onChange, single, className, size = "md", max }: SelectorChipsProps) {
  const toggle = (opt: string) => {
    if (single) return onChange(value.includes(opt) ? [] : [opt]);
    if (value.includes(opt)) return onChange(value.filter(v => v !== opt));
    if (max && value.length >= max) return onChange([...value.slice(1), opt]);
    onChange([...value, opt]);
  };

  return (
    <motion.div layout transition={spring} className={cn("flex flex-wrap gap-2 overflow-visible", className)}>
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <motion.button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            layout
            initial={false}
            animate={{ backgroundColor: on ? "rgba(124,107,255,.20)" : "rgba(255,255,255,.055)" }}
            whileHover={{ backgroundColor: on ? "rgba(124,107,255,.26)" : "rgba(255,255,255,.10)" }}
            whileTap={{ scale: 0.96 }}
            transition={{ ...spring, backgroundColor: { duration: 0.12 } }}
            className={cn(
              "inline-flex items-center rounded-full font-medium whitespace-nowrap overflow-hidden ring-1 ring-inset backdrop-blur-sm",
              size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-[15px]",
              on ? "text-[#C9C1FF] ring-[rgba(124,107,255,.45)]" : "text-white/55 ring-white/10",
            )}
          >
            <motion.div
              className="relative flex items-center"
              animate={{ paddingRight: on ? (size === "sm" ? "1.25rem" : "1.5rem") : "0rem" }}
              transition={{ ease: [0.175, 0.885, 0.32, 1.275], duration: 0.3 }}
            >
              <span>{opt}</span>
              <AnimatePresence>
                {on && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={spring}
                    className="absolute right-0"
                  >
                    <span className={cn("flex items-center justify-center rounded-full bg-[#7C6BFF]",
                      size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}>
                      <Check className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.5} color="#0B0B12" />
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export default SelectorChips;
