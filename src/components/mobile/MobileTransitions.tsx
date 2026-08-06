import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

/**
 * Fade in animation wrapper
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 200,
}: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

interface SlideInProps {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}

/**
 * Slide in animation wrapper
 */
export function SlideIn({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 300,
}: SlideInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const transforms = {
    up: 'translate-y-4',
    down: '-translate-y-4',
    left: 'translate-x-4',
    right: '-translate-x-4',
  };

  return (
    <div
      className={cn(
        'transition-all',
        visible 
          ? 'opacity-100 translate-x-0 translate-y-0' 
          : `opacity-0 ${transforms[direction]}`,
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

interface ScaleInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

/**
 * Scale in animation wrapper
 */
export function ScaleIn({
  children,
  className,
  delay = 0,
  duration = 200,
}: ScaleInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-all',
        visible 
          ? 'opacity-100 scale-100' 
          : 'opacity-0 scale-95',
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

interface StaggerContainerProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

/**
 * Stagger children animations
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 50,
}: StaggerContainerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <SlideIn key={index} delay={index * staggerDelay}>
          {child}
        </SlideIn>
      ))}
    </div>
  );
}

interface PulseProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
}

/**
 * Pulse animation wrapper
 */
export function Pulse({
  children,
  className,
  active = true,
}: PulseProps) {
  return (
    <div className={cn(active && 'animate-pulse-soft', className)}>
      {children}
    </div>
  );
}

interface ShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

/**
 * Shimmer loading placeholder
 */
export function Shimmer({
  className,
  width = '100%',
  height = '20px',
}: ShimmerProps) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted',
        'bg-[length:200%_100%] rounded',
        className
      )}
      style={{ width, height }}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showAvatar?: boolean;
}

/**
 * Skeleton card for loading states
 */
export function SkeletonCard({
  className,
  lines = 3,
  showAvatar = false,
}: SkeletonCardProps) {
  return (
    <div className={cn('rounded-2xl bg-card border border-border p-4 space-y-3', className)}>
      {showAvatar && (
        <div className="flex items-center gap-3">
          <Shimmer className="rounded-full" width="40px" height="40px" />
          <Shimmer width="120px" height="16px" />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          height="14px"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Circular progress indicator
 */
export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={cn('transform -rotate-90', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted opacity-20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-500"
      />
    </svg>
  );
}
