'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'relative overflow-hidden border border-transparent bg-secondary text-secondary-foreground shadow-sm hover:shadow-md hover:bg-secondary/90 transition-all duration-200',
                destructive:
                    'relative overflow-hidden border border-transparent bg-destructive text-destructive-foreground shadow-sm hover:shadow-md hover:bg-destructive/90 transition-all duration-200',
                outline:
                    'relative overflow-hidden border border-border bg-background text-foreground shadow-sm hover:shadow-md hover:bg-accent/50 transition-all duration-200',
                secondary:
                    'bg-muted text-muted-foreground hover:bg-muted/80 transition-all duration-200',
                ghost: 'hover:bg-accent/30 hover:shadow-sm transition-all duration-200',
                link: 'text-primary underline-offset-4 hover:underline transition-all duration-200',
                shine: 'relative overflow-hidden border border-border bg-[length:400%_100%] text-foreground bg-[linear-gradient(110deg,hsl(var(--background)),45%,hsl(var(--muted)),55%,hsl(var(--background)))] animate-shine',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 px-3',
                lg: 'h-11 px-8',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { className, variant, size, asChild = false, onMouseDown, ...props },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button';

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            onMouseDown?.(e);
        };

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                onMouseDown={handleClick}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
