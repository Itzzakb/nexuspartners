import { cn } from '@/lib/utils';
import { DEFAULT_LOGO, SITE_NAME } from '@/lib/branding';

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

interface AppLogoProps {
  src?: string | null;
  className?: string;
  size?: keyof typeof sizeClasses;
  alt?: string;
}

export function AppLogo({ src, className, size = 'md', alt = SITE_NAME }: AppLogoProps) {
  return (
    <img
      src={src?.trim() ? src : DEFAULT_LOGO}
      alt={alt}
      className={cn('object-contain', sizeClasses[size], className)}
    />
  );
}
