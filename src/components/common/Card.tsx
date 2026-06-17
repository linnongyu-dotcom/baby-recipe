import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: ClassValue;
  hoverable?: boolean;
}

export function Card({ children, onClick, className, hoverable = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { scale: 1.02, y: -2 } : undefined}
      onClick={onClick}
      className={twMerge(
        clsx(
          'bg-white rounded-2xl shadow-md p-4',
          hoverable && 'cursor-pointer hover:shadow-lg transition-shadow duration-200',
          onClick && 'cursor-pointer',
          className
        )
      )}
    >
      {children}
    </motion.div>
  );
}