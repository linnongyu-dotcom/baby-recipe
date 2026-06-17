import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: ClassValue;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: ButtonProps) {
  const baseStyles = 'rounded-full font-medium transition-all duration-200 inline-flex items-center justify-center';
  
  const variants = {
    primary: 'bg-gradient-to-r from-purple-400 to-purple-500 text-white shadow-md hover:shadow-lg hover:from-purple-500 hover:to-purple-600 active:scale-95',
    secondary: 'bg-gradient-to-r from-purple-300 to-purple-400 text-white shadow-md hover:shadow-lg hover:from-purple-400 hover:to-purple-500 active:scale-95',
    outline: 'border-2 border-purple-400 text-purple-500 hover:bg-purple-50 active:scale-95',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={twMerge(
        clsx(baseStyles, variants[variant], sizes[size], disabled && 'opacity-50 cursor-not-allowed', className)
      )}
    >
      {children}
    </motion.button>
  );
}