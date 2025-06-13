'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, style, ...props }, ref) => (
    <DropdownMenuPrimitive.Trigger
        ref={ref}
        className={cn(
            'focus:outline-none focus-visible:outline-none',
            className
        )}
        style={{
            outline: 'none !important',
            boxShadow: 'none !important',
            border: 'none !important',
            ...style,
        }}
        onFocus={(e) => {
            e.currentTarget.style.outline = 'none';
            e.currentTarget.style.boxShadow = 'none';
            props.onFocus?.(e);
        }}
        {...props}
    />
));
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
        inset?: boolean;
    }
>(({ className, inset, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <DropdownMenuPrimitive.SubTrigger
            ref={ref}
            className={cn(
                'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                inset && 'pl-8',
                className
            )}
            {...props}
        >
            {children}
            <motion.div
                animate={{ rotate: 0 }}
                whileHover={shouldReduceMotion ? {} : { rotate: 90 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="ml-auto"
            >
                <ChevronRight />
            </motion.div>
        </DropdownMenuPrimitive.SubTrigger>
    );
});
DropdownMenuSubTrigger.displayName =
    DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
        ref={ref}
        className={cn(
            'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
            className
        )}
        {...props}
    />
));
DropdownMenuSubContent.displayName =
    DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <AnimatePresence>
            <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                    ref={ref}
                    sideOffset={sideOffset}
                    className={cn(
                        'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border p-1 text-popover-foreground shadow-md backdrop-blur-md bg-popover',
                        className
                    )}
                    asChild
                    {...props}
                >
                    <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
                        animate={shouldReduceMotion ? { opacity: 1 } : 'show'}
                        exit={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
                        variants={{
                            hidden: {
                                clipPath: 'inset(10% 50% 90% 50% round 10px)',
                            },
                            show: {
                                clipPath: 'inset(0% 0% 0% 0% round 10px)',
                                transition: {
                                    type: 'spring',
                                    bounce: 0,
                                    duration: 0.5,
                                    delayChildren: 0.15,
                                    staggerChildren: 0.1,
                                },
                            },
                        }}
                        style={{
                            transformOrigin: 'top center',
                        }}
                    >
                        {children}
                    </motion.div>
                </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
        </AnimatePresence>
    );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const itemVariants = {
    hidden: {
        opacity: 0,
        scale: 0.3,
        filter: 'blur(20px)',
    },
    show: {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            duration: 0.2,
        },
    },
};

const DropdownMenuItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
        inset?: boolean;
        showChevronOnHover?: boolean;
    }
>(
    (
        {
            className,
            inset,
            onMouseDown,
            children,
            showChevronOnHover = false,
            ...props
        },
        ref
    ) => {
        const shouldReduceMotion = useReducedMotion();

        const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
            onMouseDown?.(e);
        };

        return (
            <DropdownMenuPrimitive.Item
                ref={ref}
                className={cn(
                    'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                    showChevronOnHover && 'group',
                    inset && 'pl-8',
                    className
                )}
                onMouseDown={handleClick}
                asChild
                {...props}
            >
                <motion.div
                    variants={shouldReduceMotion ? {} : itemVariants}
                    whileTap={
                        shouldReduceMotion
                            ? {}
                            : {
                                  scale: 0.98,
                                  transition: { duration: 0.1 },
                              }
                    }
                >
                    {children}
                    {showChevronOnHover && (
                        <ChevronRight className="ml-auto h-3 w-3 opacity-0 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0.5" />
                    )}
                </motion.div>
            </DropdownMenuPrimitive.Item>
        );
    }
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, onCheckedChange, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    const handleCheckedChange = (checked: boolean) => {
        onCheckedChange?.(checked);
    };

    return (
        <DropdownMenuPrimitive.CheckboxItem
            ref={ref}
            className={cn(
                'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                className
            )}
            checked={checked}
            onCheckedChange={handleCheckedChange}
            asChild
            {...props}
        >
            <motion.div
                variants={shouldReduceMotion ? {} : itemVariants}
                whileTap={
                    shouldReduceMotion
                        ? {}
                        : {
                              scale: 0.98,
                              transition: { duration: 0.1 },
                          }
                }
            >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <DropdownMenuPrimitive.ItemIndicator>
                        <motion.div
                            initial={shouldReduceMotion ? {} : { scale: 0 }}
                            animate={shouldReduceMotion ? {} : { scale: 1 }}
                            exit={shouldReduceMotion ? {} : { scale: 0 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                        >
                            <Check className="h-4 w-4" />
                        </motion.div>
                    </DropdownMenuPrimitive.ItemIndicator>
                </span>
                {children}
            </motion.div>
        </DropdownMenuPrimitive.CheckboxItem>
    );
});
DropdownMenuCheckboxItem.displayName =
    DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {}
>(({ className, children, onSelect, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    const handleSelect = (event: Event) => {
        onSelect?.(event);
    };

    return (
        <DropdownMenuPrimitive.RadioItem
            ref={ref}
            className={cn(
                'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                className
            )}
            onSelect={handleSelect}
            asChild
            {...props}
        >
            <motion.div
                variants={shouldReduceMotion ? {} : itemVariants}
                whileTap={
                    shouldReduceMotion
                        ? {}
                        : {
                              scale: 0.98,
                              transition: { duration: 0.1 },
                          }
                }
            >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <DropdownMenuPrimitive.ItemIndicator>
                        <motion.div
                            initial={shouldReduceMotion ? {} : { scale: 0 }}
                            animate={shouldReduceMotion ? {} : { scale: 1 }}
                            exit={shouldReduceMotion ? {} : { scale: 0 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                        >
                            <Circle className="h-2 w-2 fill-current" />
                        </motion.div>
                    </DropdownMenuPrimitive.ItemIndicator>
                </span>
                {children}
            </motion.div>
        </DropdownMenuPrimitive.RadioItem>
    );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
        inset?: boolean;
    }
>(({ className, inset, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <DropdownMenuPrimitive.Label
            ref={ref}
            className={cn(
                'px-2 py-1.5 text-sm font-semibold',
                inset && 'pl-8',
                className
            )}
            asChild
            {...props}
        >
            <motion.div variants={shouldReduceMotion ? {} : itemVariants}>
                {children}
            </motion.div>
        </DropdownMenuPrimitive.Label>
    );
});
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <DropdownMenuPrimitive.Separator
            ref={ref}
            className={cn('-mx-1 my-1 h-px bg-muted', className)}
            asChild
            {...props}
        >
            <motion.div
                variants={shouldReduceMotion ? {} : itemVariants}
                initial={shouldReduceMotion ? {} : { scaleX: 0 }}
                animate={shouldReduceMotion ? {} : { scaleX: 1 }}
                transition={{
                    duration: 0.3,
                    delay: 0.1,
                    ease: [0.4, 0, 0.2, 1],
                }}
            />
        </DropdownMenuPrimitive.Separator>
    );
});
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
        <span
            className={cn(
                'ml-auto text-xs tracking-widest opacity-60',
                className
            )}
            {...props}
        />
    );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup,
};
