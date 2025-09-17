/**
 * @packageDocumentation
 * @module Footer
 * @description Application footer component with branding, version, social links, and credits.
 */
import React from "react";
import { Heart, Mail } from "lucide-react";

/**
 * GitHub SVG icon (from simpleicons.org)
 */
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>GitHub</title>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.304.762-1.604-2.665-.3-5.466-1.334-5.466-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.289-1.552 3.295-1.23 3.295-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.625-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
import { motion } from "framer-motion";
import { Separator } from "../ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { getAppVersion } from "../../utils/app-version";
import appIcon from "../../assets/k2a-icon-512x512.png";

/**
 * Footer React component that displays the application footer with logo, version, social links, and credits.
 *
 * @returns The rendered footer React element.
 * @source
 */
export function Footer() {
  const handleOpenExternal = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    } else {
      // Fallback to regular link behavior if not in Electron
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const socialLinks = [
    {
      name: "GitHub",
      icon: <GithubIcon className="h-4 w-4" />,
      url: "https://github.com/RLAlpha49/KenmeiToAnilist",
      tooltip: "View source code on GitHub",
    },
    {
      name: "Contact",
      icon: <Mail className="h-4 w-4" />,
      url: "mailto:contact@alpha49.com",
      tooltip: "Email with questions",
    },
  ];

  return (
    <TooltipProvider>
      <footer className="border-border bg-background/90 border-t p-3 text-xs backdrop-blur-sm">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <motion.div
              className="h-6 w-6"
              whileHover={{ rotate: 10, scale: 1.05 }}
            >
              <img src={appIcon} alt="K2A Logo" className="h-6 w-6" />
            </motion.div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Kenmei to AniList</span>
              <Badge variant="outline" className="h-5 px-2 font-mono">
                v{getAppVersion()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {socialLinks.map((link) => (
                <Tooltip key={link.name}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
                      onClick={handleOpenExternal(link.url)}
                    >
                      {link.icon}
                      <span className="sr-only">{link.name}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{link.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Separator orientation="vertical" className="h-4" />

            <motion.div
              className="text-muted-foreground flex items-center"
              whileHover={{ scale: 1.05 }}
            >
              <span>Made with</span>
              <Heart className="mx-1 h-3 w-3 fill-red-500 text-red-500" />
              <span>for manga readers</span>
            </motion.div>

            <span className="text-muted-foreground">
              © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </footer>
    </TooltipProvider>
  );
}
