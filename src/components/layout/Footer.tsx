import React from "react";
import { Github, Heart, Mail } from "lucide-react";
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
      icon: <Github className="h-4 w-4" />,
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
