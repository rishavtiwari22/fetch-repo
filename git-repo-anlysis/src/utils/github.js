const IGNORED_FILES = new Set([
  // Locks
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "composer.lock", "cargo.lock", "poetry.lock", "gemfile.lock",
  // Common Config & Meta
  ".gitignore", ".gitattributes", ".editorconfig", ".prettierrc", ".eslintrc.js",
  ".eslintrc.json", "dockerfile", "docker-compose.yml",
  ".env", ".env.local", ".env.example",
  // Build/Tooling Configs (Noise for LLM logic analysis)
  "vite.config.js", "vite.config.ts", "eslint.config.js", "postcss.config.js",
  "tailwind.config.js", "tailwind.config.ts", "webpack.config.js", "babel.config.js",
  "next.config.js", "next.config.mjs", "svelte.config.js", "nuxt.config.js",
  "playwright.config.js", "playwright.config.ts", "jest.config.js", "vitest.config.ts",
  "vitest.config.js", "tsconfig.json", "jsconfig.json",
  // Metadata 
  "license", "contributing.md", "code_of_conduct.md", "security.md"
]);

const IGNORED_DIRECTORIES = new Set([
  ".git", ".svn", ".hg",
  "node_modules", "vendor", "bower_components",
  ".cache", ".npm", ".yarn", ".idea", ".vscode", ".pytest_cache", "__pycache__",
  "dist", "build", "out", "target", "bin", "obj", ".next", ".nuxt",
  "tests", "test", "coverage", "__tests__", "docs", "doc", "examples", "example",
  "temp", "tmp"
]);

export const estimateTokens = (text) => {
  if (!text) return 0;
  // Code tends to have more tokens per character due to symbols
  // 3.5 char/token is a safe middle ground for code.
  return Math.ceil(text.length / 3.5);
};

export const parseGitHubUrl = (url) => {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes("github.com")) return null;
    const parts = urlObj.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1];
    let branch = "main";

    if (parts[2] === "tree" && parts[3]) {
      branch = parts[3];
    }

    return { owner, repo, branch };
  } catch {
    return null;
  }
};

export const fetchRepoTree = async (
  owner,
  repo,
  branch = "main",
  token = ""
) => {
  const headers = token ? { Authorization: `token ${token}` } : {};
  // First try the branch provided, then try 'master' if 'main' fails
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  if (!response.ok) {
    if (branch === "main") return fetchRepoTree(owner, repo, "master", token);
    throw new Error(`Failed to fetch repo tree: ${response.statusText}`);
  }
  const data = await response.json();
  return data.tree;
};

export const fetchFileContent = async (owner, repo, branch, path) => {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${path}`);
  }
  return await response.text();
};

const ALLOWED_EXTENSIONS = new Set(["js", "jsx", "html", "css", "json"]);

export const isTextFile = (path) => {
  const parts = path.split("/");
  if (parts.some((p) => IGNORED_DIRECTORIES.has(p))) return false;

  const fileName = parts[parts.length - 1];
  if (IGNORED_FILES.has(fileName)) return false;

  const ext = fileName.split(".").pop().toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
};

export const compressCode = (text, path) => {
  if (!text) return "";

  // 1. Detect file type
  const isTest = /\.test\.|\.spec\.|[\/\\]test[\/\\]|[\/\\]tests[\/\\]/.test(path);

  let compressed = text;

  // 2. Strip multi-line comments
  compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, "");

  // 3. Strip single-line comments (ignoring common false positives like URLs)
  compressed = compressed.split("\n")
    .map(line => {
      // Very loose check to avoid stripping in strings or URLs
      // Strips only if // is preceded by whitespace or start of line
      const index = line.indexOf("//");
      if (index === 0) return "";
      if (index > 0 && /\s/.test(line[index - 1])) {
         // Check if it's not part of a URL (http:// or https://)
         const before = line.substring(0, index);
         if (!before.endsWith("http:") && !before.endsWith("https:")) {
           return before.trimEnd();
         }
      }
      return line;
    })
    .join("\n");

  // 4. Truncate long strings (>100 chars)
  compressed = compressed.replace(/([\"\'\`])(.{100,})\1/g, (match, quote, content) => {
    return `${quote}${content.substring(0, 40)}...[truncated ${content.length} chars]...${content.slice(-10)}${quote}`;
  });

  // 5. Compress whitespace
  compressed = compressed
    .split("\n")
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0)
    .join("\n");

  // 6. Tiered compression for tests (Keeping only structural keywords for efficacy)
  if (isTest) {
    compressed = compressed.split("\n")
      .filter(line => /^\s*(describe|it|test|before|after|expect|import|export|from)/i.test(line))
      .map(line => {
         // If it's a test body block, we could condense further, but keeping declarations for context
         return line;
      })
      .join("\n");
  }

  return compressed;
};
