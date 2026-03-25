import { Variants } from 'framer-motion';

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const slideInRight: Variants = {
  hidden: { x: 450, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },
  exit: { 
    x: 450, 
    opacity: 0,
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  }
};

export const buttonVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02, boxShadow: "0 10px 30px rgba(0, 120, 212, 0.3)" },
  tap: { scale: 0.98 }
};
