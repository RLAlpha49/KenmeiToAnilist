module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Custom rules for this project
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation changes
        "style", // Code style changes (formatting, etc.)
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Adding or updating tests
        "build", // Build system changes
        "ci", // CI/CD changes
        "chore", // Other changes (dependencies, etc.)
        "revert", // Revert previous commit
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        // Core features
        "import",
        "matching",
        "sync",
        "auth",
        "settings",
        "statistics",

        // Technical areas
        "api",
        "storage",
        "cache",
        "ipc",
        "ui",
        "hooks",
        "utils",

        // Infrastructure
        "deps",
        "config",
        "build",
        "release",
        "docs",
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [2, "never", ["upper-case", "pascal-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
