/**
 * @packageDocumentation
 * @module Header
 * @description Application header component with logo, navigation, theme toggle, and window controls.
 */

import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { getPathname } from "@/utils/getPathname";
import ToggleTheme from "../ToggleTheme";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "../ui/navigation-menu";
import {
  Minimize2,
  Maximize2,
  X,
  Home,
  Download,
  ClipboardCheck,
  Settings as SettingsIcon,
  ArrowUpDown as SyncIcon,
  BarChart3,
  Bug,
  HelpCircle,
} from "lucide-react";
import {
  minimizeWindow,
  maximizeWindow,
  closeWindow,
} from "../../helpers/window_helpers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { motion } from "framer-motion";
import appIcon from "../../assets/k2a-icon-512x512.png";
import { useDebugState, useDebugActions } from "../../contexts/DebugContext";
import { DebugMenu } from "../debug/DebugMenu";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/tailwind";

/**
 * Navigation item configuration for header navigation menu.
 * @property label - Display label for the navigation item.
 * @property to - Route path for TanStack Router navigation.
 * @property icon - Lucide icon component for the navigation item.
 * @source
 */
type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

/** Navigation menu items array with label, route, and icon for each page. @source */
const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Import", to: "/import", icon: Download },
  { label: "Review", to: "/review", icon: ClipboardCheck },
  { label: "Sync", to: "/sync", icon: SyncIcon },
  { label: "Statistics", to: "/statistics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

/**
 * Header React component that displays the application header with logo, navigation links, theme toggle, and window controls.
 *
 * @param onOpenShortcutsPanel - Optional callback function invoked to open the shortcuts panel.
 * @returns The rendered header React element.
 * @source
 */
export function Header({
  onOpenShortcutsPanel,
}: Readonly<{
  onOpenShortcutsPanel?: () => void;
}>) {
  const { isDebugEnabled, debugMenuOpen } = useDebugState();
  const { openDebugMenu, closeDebugMenu } = useDebugActions();

  const location = useLocation();

  const pathname = getPathname(location);

  return (
    <TooltipProvider>
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-blue-600 focus:shadow-lg dark:focus:bg-slate-900 dark:focus:text-blue-400"
        >
          Skip to main content
        </a>
        <div className="draglayer w-full">
          <div className="relative flex h-16 items-center justify-between px-4">
            <div className="bg-linear-to-r pointer-events-none absolute inset-x-6 top-1/2 z-0 h-24 -translate-y-1/2 rounded-full from-blue-500/10 via-purple-500/10 to-transparent blur-2xl" />
            <div className="flex items-center gap-4">
              {/* Logo and title */}
              <Link to="/" className="non-draggable flex items-center">
                <motion.div
                  className="mr-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img src={appIcon} alt="K2A Logo" className="h-8 w-8" />
                </motion.div>
                <div className="overflow-hidden whitespace-nowrap">
                  <p className="text-muted-foreground text-xs uppercase tracking-[0.4em]">
                    Sync Tool
                  </p>
                  <h1 className="font-mono text-lg font-semibold leading-tight">
                    <span className="min-[44rem]:inline bg-linear-to-r hidden from-blue-500 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                      Kenmei → AniList
                    </span>
                    <span className="max-[44rem]:inline min-[44rem]:hidden bg-linear-to-r inline from-blue-500 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                      K2A
                    </span>
                  </h1>
                </div>
              </Link>

              {/* Always visible navigation - icon-only on small screens, icon+text on larger screens */}
              <nav
                className="non-draggable"
                role="navigation"
                aria-label="Main navigation"
              >
                <NavigationMenu>
                  <NavigationMenuList className="bg-background/60 flex rounded-full p-1 text-xs font-medium shadow-inner shadow-black/5 ring-1 ring-white/40 backdrop-blur-sm dark:bg-slate-950/60 dark:ring-white/10">
                    {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
                      const isActive =
                        to === "/" ? pathname === "/" : pathname.startsWith(to);
                      return (
                        <NavigationMenuItem key={label}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <NavigationMenuLink
                                asChild
                                className={cn(
                                  "text-muted-foreground group inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium tracking-wide transition-all",
                                  "hover:text-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                                  "data-[state=open]:text-primary data-[state=open]:bg-white/80 dark:hover:bg-slate-900/70 dark:data-[state=open]:bg-slate-900/80",
                                  isActive &&
                                    "text-primary bg-white/80 dark:bg-slate-900/80",
                                )}
                              >
                                <Link
                                  to={to}
                                  className="flex items-center gap-2"
                                  aria-current={isActive ? "page" : undefined}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span className="max-lg:hidden">{label}</span>
                                </Link>
                              </NavigationMenuLink>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="lg:hidden">
                              {label}
                            </TooltipContent>
                          </Tooltip>
                        </NavigationMenuItem>
                      );
                    })}
                  </NavigationMenuList>
                </NavigationMenu>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <div className="non-draggable">
                <ToggleTheme />
              </div>
              <div className="non-draggable">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onOpenShortcutsPanel}
                      className="h-8 w-8 rounded-full"
                      aria-label="View keyboard shortcuts"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Keyboard Shortcuts (?)
                  </TooltipContent>
                </Tooltip>
              </div>
              {isDebugEnabled && (
                <div className="non-draggable">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDebugMenu()}
                        className="h-8 w-8 rounded-full"
                        aria-label="Open debug menu"
                      >
                        <Bug className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Debug Menu</TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="non-draggable flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={minimizeWindow}
                      className="h-8 w-8 rounded-full"
                      aria-label="Minimize window"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Minimize</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={maximizeWindow}
                      className="h-8 w-8 rounded-full"
                      aria-label="Maximize window"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Maximize</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={closeWindow}
                      className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 rounded-full"
                      aria-label="Close window"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Close</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Debug Menu */}
      <DebugMenu isOpen={debugMenuOpen} onClose={() => closeDebugMenu()} />
    </TooltipProvider>
  );
}
