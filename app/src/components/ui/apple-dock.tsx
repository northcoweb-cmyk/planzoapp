"use client";

import React, { useRef } from "react";
import { cva } from "class-variance-authority";
import { motion, MotionValue, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MotionProps } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Apple-style magnifying dock, adapted for Planzo's bottom navigation.
 *
 * Two changes from the stock component, both because it has to work on a
 * phone as well as a trackpad:
 *   1. Magnification follows touch as well as the pointer, and a coarse
 *      pointer (no hover) gets the active-item scale instead — otherwise
 *      the whole effect is invisible on the device most people will use.
 *   2. The dock spans the viewport and distributes its items, rather than
 *      sitting at w-max in the centre, so it reads as navigation.
 */

export interface AppleDockProps {
  className?: string;
  iconSize?: number;
  iconMagnification?: number;
  disableMagnification?: boolean;
  iconDistance?: number;
  direction?: "top" | "middle" | "bottom";
  children: React.ReactNode;
}

const DEFAULT_SIZE = 44;
const DEFAULT_MAGNIFICATION = 62;
const DEFAULT_DISTANCE = 130;

const appleDockVariants = cva(
  "mx-auto flex w-full items-end justify-between gap-1 rounded-[26px] px-3 py-2",
);

export const AppleDock = React.forwardRef<HTMLDivElement, AppleDockProps>(
  ({ className, children, iconSize = DEFAULT_SIZE, iconMagnification = DEFAULT_MAGNIFICATION,
     disableMagnification = false, iconDistance = DEFAULT_DISTANCE, direction = "middle", ...props }, ref) => {
    const mouseX = useMotionValue(Infinity);

    const renderChildren = () =>
      React.Children.map(children, (child) => {
        if (React.isValidElement<AppleDockIconProps>(child) && child.type === AppleDockIcon) {
          return React.cloneElement(child, {
            ...child.props,
            mouseX,
            size: iconSize,
            magnification: iconMagnification,
            disableMagnification,
            distance: iconDistance,
          });
        }
        return child;
      });

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        // Touch drives the same motion value, so dragging along the dock
        // magnifies exactly as the pointer does.
        onTouchStart={(e) => mouseX.set(e.touches[0].pageX)}
        onTouchMove={(e) => mouseX.set(e.touches[0].pageX)}
        onTouchEnd={() => mouseX.set(Infinity)}
        {...props}
        className={cn(appleDockVariants({ className }), {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    );
  },
);
AppleDock.displayName = "AppleDock";

export interface AppleDockIconProps
  extends Omit<MotionProps & React.HTMLAttributes<HTMLDivElement>, "children"> {
  size?: number;
  magnification?: number;
  disableMagnification?: boolean;
  distance?: number;
  mouseX?: MotionValue<number>;
  className?: string;
  children?: React.ReactNode;
  label?: string;
  active?: boolean;
}

export const AppleDockIcon = ({
  size = DEFAULT_SIZE, magnification = DEFAULT_MAGNIFICATION, disableMagnification,
  distance = DEFAULT_DISTANCE, mouseX, className, children, label, active, ...props
}: AppleDockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const padding = Math.max(7, size * 0.24);
  const defaultMouseX = useMotionValue(Infinity);

  const distanceCalc = useTransform(mouseX ?? defaultMouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const targetSize = disableMagnification ? size : magnification;
  const sizeTransform = useTransform(distanceCalc, [-distance, 0, distance], [size, targetSize, size]);
  const scaleSize = useSpring(sizeTransform, { mass: 0.1, stiffness: 150, damping: 12 });

  // A dock item is navigation, so it has to behave like a control: an
  // accessible name, a role, tab focus and Enter/Space. The stock component
  // is a bare div with onClick — unreachable by keyboard, and it announces
  // nothing to a screen reader.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (props as any).onClick?.(e);
    }
  };

  return (
    <motion.div
      ref={ref}
      role="tab"
      tabIndex={0}
      aria-label={label}
      aria-selected={Boolean(active)}
      onKeyDown={onKeyDown}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center rounded-2xl",
        "outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/60",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center">{children}</div>
      {/* Active pip — the only persistent state indicator, so the dock still
          communicates where you are once the magnification settles. */}
      {active && (
        <motion.span
          layoutId="dock-pip"
          className="absolute -bottom-[3px] h-[3px] w-[3px] rounded-full bg-white"
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      )}
    </motion.div>
  );
};
AppleDockIcon.displayName = "AppleDockIcon";

export default AppleDock;
