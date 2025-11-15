/**
 * @packageDocumentation
 * @module ToggleTheme
 * @description A button component for toggling between light and dark themes, with tooltip and accessible controls.
 */

import { Moon, Sun } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

/**
 * Button for toggling between light and dark themes.
 * Displays appropriate icon and provides accessible tooltip.
 * @returns Theme toggle button component.
 * @source
 */
export default function ToggleTheme() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleTheme}
            size="icon"
            variant="ghost"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isDarkMode ? "Switch to light mode" : "Switch to dark mode"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
