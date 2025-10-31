/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // Status colors used in matching/sync
    "text-emerald-600",
    "text-sky-600",
    "text-amber-600",
    "text-rose-600",
    "bg-emerald-50",
    "bg-sky-50",
    "bg-amber-50",
    "bg-rose-50",
    "border-emerald-200",
    "border-sky-200",
    "border-amber-200",
    "border-rose-200",
    // Dark mode variants
    "dark:text-emerald-400",
    "dark:text-sky-400",
    "dark:text-amber-400",
    "dark:text-rose-400",
    "dark:bg-emerald-950",
    "dark:bg-sky-950",
    "dark:bg-amber-950",
    "dark:bg-rose-950",
    "dark:border-emerald-800",
    "dark:border-sky-800",
    "dark:border-amber-800",
    "dark:border-rose-800",
    // Ring widths used with ring colors
    "ring-1",
    "ring-2",
    // Ring colors for focus states
    "ring-blue-400",
    "ring-blue-500",
    "ring-offset-2",
    // Animation classes
    "animate-spin",
    "animate-pulse",
    "animate-bounce",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
