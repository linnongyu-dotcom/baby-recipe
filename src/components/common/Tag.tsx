import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TagProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'info';
  className?: ClassValue;
}

export function Tag({
  children,
  selected = false,
  onClick,
  variant = 'default',
  className,
}: TagProps) {
  const baseStyles = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200';
  
  const variants = {
    default: selected
      ? 'bg-purple-500 text-white shadow-md'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    success: selected
      ? 'bg-purple-500 text-white shadow-md'
      : 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    warning: selected
      ? 'bg-orange-500 text-white shadow-md'
      : 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    info: selected
      ? 'bg-blue-500 text-white shadow-md'
      : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
  };
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={twMerge(
        clsx(baseStyles, variants[variant], onClick && 'cursor-pointer', className)
      )}
    >
      {children}
    </motion.button>
  );
}