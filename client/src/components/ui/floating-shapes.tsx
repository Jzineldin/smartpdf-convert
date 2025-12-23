import { cn } from '@/lib/utils';

interface FloatingShapesProps {
  className?: string;
  variant?: 'hero' | 'section';
}

export function FloatingShapes({ className, variant = 'hero' }: FloatingShapesProps) {
  if (variant === 'hero') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        {/* Large gradient orb - top right */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-purple-500/20 rounded-full blur-3xl animate-pulse" />

        {/* Medium gradient orb - bottom left */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-gradient-to-tr from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

        {/* Small accent orb - center right */}
        <div className="absolute top-1/2 right-10 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-pink-400/10 rounded-full blur-2xl animate-bounce" style={{ animationDuration: '6s' }} />

        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-[15%] w-4 h-4 bg-blue-500/20 rounded rotate-45 animate-float" />
        <div className="absolute top-40 right-[20%] w-3 h-3 bg-purple-500/30 rounded-full animate-float-delayed" />
        <div className="absolute bottom-32 left-[25%] w-5 h-5 bg-cyan-500/20 rounded animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 left-[10%] w-2 h-2 bg-indigo-500/30 rounded-full animate-float-delayed" />
        <div className="absolute bottom-40 right-[15%] w-4 h-4 bg-blue-400/20 rounded-full animate-float" style={{ animationDelay: '2s' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      <div className="absolute top-10 right-10 w-24 h-24 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-2xl" />
      <div className="absolute bottom-10 left-10 w-32 h-32 bg-gradient-to-tr from-cyan-400/10 to-blue-400/10 rounded-full blur-2xl" />
    </div>
  );
}
