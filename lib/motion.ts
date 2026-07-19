/** Calm motion tokens — keep under 250ms, prefer fade + translate. */
export const MOTION = {
  duration: 0.2,
  durationSlow: 0.24,
  ease: [0.25, 0.1, 0.25, 1] as const,
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: MOTION.duration, ease: MOTION.ease },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MOTION.duration, ease: MOTION.ease },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.duration, ease: MOTION.ease },
  },
};
