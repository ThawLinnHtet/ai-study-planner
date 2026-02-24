import { Flame, Zap, Trophy, Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakIconProps {
  streak: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StreakIcon({ streak, className, size = 'md' }: StreakIconProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const getIconAndColor = () => {
    if (streak === 0) {
      return {
        Icon: Flame,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        pulse: false
      };
    } else if (streak === 1) {
      return {
        Icon: Flame,
        color: 'text-orange-500',
        bgColor: 'bg-orange-100',
        pulse: false
      };
    } else if (streak <= 3) {
      return {
        Icon: Flame,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        pulse: true
      };
    } else if (streak <= 7) {
      return {
        Icon: Zap,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        pulse: true
      };
    } else if (streak <= 14) {
      return {
        Icon: Trophy,
        color: 'text-amber-500',
        bgColor: 'bg-amber-100',
        pulse: true
      };
    } else if (streak <= 30) {
      return {
        Icon: Star,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100',
        pulse: true
      };
    } else {
      return {
        Icon: Crown,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
        pulse: true
      };
    }
  };

  const { Icon, color, bgColor, pulse } = getIconAndColor();

  return (
    <div className={cn(
      'inline-flex items-center justify-center rounded-full',
      bgColor,
      sizeClasses[size],
      className,
      pulse && 'animate-pulse'
    )}>
      <Icon className={cn(sizeClasses[size], color)} />
    </div>
  );
}

export function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your streak today!';
  if (streak === 1) return 'Great start! Keep it going!';
  if (streak === 2) return 'Two days strong! 🔥';
  if (streak === 3) return 'Three in a row! Building momentum!';
  if (streak === 4) return 'Four-day streak! You\'re on fire!';
  if (streak === 5) return 'Five days! Amazing consistency!';
  if (streak === 6) return 'Six days! Almost a week!';
  if (streak === 7) return 'One week! Incredible dedication!';
  if (streak === 10) return '10 days! You\'re unstoppable!';
  if (streak === 14) return 'Two weeks! Legendary commitment!';
  if (streak === 21) return 'Three weeks! Habit master!';
  if (streak === 30) return '30 days! You\'re a champion!';
  if (streak === 50) return '50 days! Absolutely legendary!';
  if (streak === 100) return '100 days! Unbelievable achievement!';
  
  return `${streak} days! Keep the fire burning! 🔥`;
}

export function getStreakColor(streak: number): string {
  if (streak === 0) return 'text-gray-500';
  if (streak <= 3) return 'text-orange-600';
  if (streak <= 7) return 'text-yellow-600';
  if (streak <= 14) return 'text-amber-600';
  if (streak <= 30) return 'text-purple-600';
  return 'text-indigo-700';
}
