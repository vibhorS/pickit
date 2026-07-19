"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp, MOTION } from "@/lib/motion";

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

export function FadeIn({
  children,
  delay = 0,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={{
        duration: MOTION.duration,
        ease: MOTION.ease,
        delay,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
