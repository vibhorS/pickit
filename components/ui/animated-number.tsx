"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { MOTION } from "@/lib/motion";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  suffix?: string;
};

export function AnimatedNumber({
  value,
  className,
  suffix = "",
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (latest) =>
    `${Math.round(latest)}${suffix}`,
  );

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: MOTION.durationSlow,
      ease: MOTION.ease,
    });
    return controls.stop;
  }, [motionValue, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
