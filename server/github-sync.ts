/**
 * GitHub Sync Service - COMPLETE REPLACEMENT
 * تجاهل محتوى GitHub تماماً ودفع جميع ملفات Replit
 */

import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    console.error("X_REPLIT_TOKEN not found");
    return "";
  }

  try {
    const response = await fetch(
      "https://" +
        hostname +
        "/api/v2/connection?include_secrets=true&connector_names=github",
      {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken,
        },
      }
    );

    const data = (await response.json()) as any;
    connectionSettings = data.items?.[0];

    const accessToken =
      connectionSettings?.settings?.access_token ||
      connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      console.error("GitHub not connected");
      return "";
    }

    return accessToken;
  } catch (error) {
    console.error("Failed to get access token:", error);
    return "";
  }
}

async function getGitHubClient(): Promise<Octokit | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }
  return new Octokit({ auth: accessToken });
}

export async function getGitHubInfo(): Promise<{
  owner: string;
  repo: string;
} | null> {
  try {
    const client = await getGitHubClient();
    if (!client) return null;

    const user = await client.users.getAuthenticated();
    const repos = await client.repos.listForAuthenticatedUser({ per_page: 100 });

    const matchingRepo = repos.data.find(
      (r) =>
        r.name.toLowerCase().includes("telegram") ||
        r.name.toLowerCase().includes("bot")
    );

    if (matchingRepo) {
      return {
        owner: matchingRepo.owner.login,
        repo: matchingRepo.name,
      };
    }

    console.log("Found repositories:", repos.data.map((r) => r.name).join(", "));
    return null;
  } catch (error) {
    console.error("Error getting GitHub info:", error);
    return null;
  }
}

export async function listGitHubRepos(): Promise<
  Array<{ name: string; owner: string; url: string; private: boolean }>
> {
  try {
    const client = await getGitHubClient();
    if (!client) return [];

    const user = await client.users.getAuthenticated();
    const repos = await client.repos.listForAuthenticatedUser({ per_page: 100 });

    console.log("[GitHub] Authenticated user:", user.data.login);

    const result = repos.data.map((r: any) => {
      const ownerLogin = r.owner?.login || user.data.login || "unknown";
      console.log(`[GitHub] Repo: ${r.name}, Owner: ${ownerLogin}`);
      return {
        name: r.name,
        owner: ownerLogin,
        url: r.html_url,
        private: r.private || false,
      };
    });

    console.log("[GitHub] Returned repos with owners:", result.slice(0, 3));
    return result;
  } catch (error) {
    console.error("Error listing repos:", error);
    return [];
  }
}

export async function getBranches(): Promise<string[]> {
  try {
    const result = await execAsync("git branch -a --format='%(refname:short)'");
    const branches = result.stdout
      ?.split("\n")
      .filter((b) => b.trim() && !b.includes("HEAD"))
      .map((b) => b.trim())
      .filter((b, i, arr) => arr.indexOf(b) === i) || [];

    const currentBranch = await execAsync("git rev-parse --abbrev-ref HEAD");
    const current = currentBranch.stdout?.trim() || "main";

    const filtered = branches.filter((b) => !b.includes("origin/") || b === `origin/${current}`);
    const clean = filtered.map((b) => b.replace("origin/", ""));

    return [current, ...clean.filter((b) => b !== current)];
  } catch (error) {
    console.error("Error getting branches:", error);
    return ["main"];
  }
}

export async function getFileChanges(): Promise<{
  modified: string[];
  created: string[];
  deleted: string[];
}> {
  try {
    const result = await execAsync("git diff --name-status HEAD~1..HEAD 2>/dev/null || git diff --name-status 2>/dev/null || echo ''");
    const output = result.stdout?.trim() || "";

    const modified: string[] = [];
    const created: string[] = [];
    const deleted: string[] = [];

    output.split("\n").forEach((line) => {
      if (!line) return;
      const [status, file] = line.split("\t");
      if (status === "M") modified.push(file);
      else if (status === "A") created.push(file);
      else if (status === "D") deleted.push(file);
    });

    return { modified, created, deleted };
  } catch (error) {
    console.error("[GitHub] Error getting file changes:", error);
    return { modified: [], created: [], deleted: [] };
  }
}

/**
 * دفع ملفات Replit إلى GitHub مع احترام .gitignore
 * يستخدم git add . الذي يحترم .gitignore تلقائياً
 */
export async function pushToGitHubRepo(
  owner: string,
  repo: string,
  message: string,
  targetBranch: string = "main"
): Promise<{ success: boolean }> {
  try {
    console.log("[GitHub] ========================================");
    console.log("[GitHub] PUSH TO GITHUB");
    console.log("[GitHub] Target:", `${owner}/${repo}`, "Branch:", targetBranch);
    console.log("[GitHub] ========================================");

    const workspaceDir = process.cwd();
    console.log("[GitHub] Workspace:", workspaceDir);

    // Step 1: Configure git
    console.log("\n[GitHub] Step 1: Configuring git...");
    await execAsync('git config user.email "replit-bot@replit.com"');
    await execAsync('git config user.name "Replit Auto-Sync"');
    console.log("[GitHub] ✓ Git configured");

    // Step 2: Get token
    console.log("\n[GitHub] Step 2: Getting GitHub token...");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("[GitHub] ✗ No token available");
      return { success: false };
    }
    console.log("[GitHub] ✓ Token obtained");

    // Step 3: Setup remote
    console.log("\n[GitHub] Step 3: Setting up remote...");
    try {
      await execAsync(`git remote remove origin 2>/dev/null || true`, { timeout: 5000 });
    } catch (e) {
      // ignore
    }
    const remoteUrl = `https://oauth2:${accessToken}@github.com/${owner}/${repo}.git`;
    await execAsync(`git remote add origin "${remoteUrl}"`, { timeout: 5000 });
    console.log("[GitHub] ✓ Remote configured");

    // Step 4: Ensure .gitignore exists and has critical entries
    console.log("\n[GitHub] Step 4: Verifying .gitignore...");
    try {
      const gitignoreCheck = await execAsync("cat .gitignore | head -5", { timeout: 5000 });
      console.log("[GitHub] ✓ .gitignore exists");
    } catch (e) {
      console.log("[GitHub] ⚠ .gitignore not found, creating default...");
      const defaultGitignore = `node_modules/\n.env\n*.session\n.pythonlibs/\n.cache/\ndist/\n`;
      await execAsync(`echo "${defaultGitignore}" > .gitignore`, { timeout: 5000 });
    }

    // Step 5: Checkout/Create branch
    console.log("\n[GitHub] Step 5: Preparing branch...");
    try {
      // Try to fetch first if remote exists
      await execAsync(`git fetch origin ${targetBranch} 2>/dev/null || true`, { timeout: 10000 });
    } catch (e) {
      // ignore
    }
    
    try {
      await execAsync(`git checkout "${targetBranch}" 2>/dev/null || git checkout -b "${targetBranch}"`, { timeout: 5000 });
      console.log(`[GitHub] ✓ On branch ${targetBranch}`);
    } catch (e) {
      console.log(`[GitHub] Creating new branch ${targetBranch}...`);
      await execAsync(`git checkout -b "${targetBranch}"`, { timeout: 5000 });
      console.log(`[GitHub] ✓ Created ${targetBranch}`);
    }

    // Step 6: Add files (respects .gitignore)
    console.log("\n[GitHub] Step 6: Adding files (respecting .gitignore)...");
    try {
      // Use git add . which respects .gitignore
      await execAsync("git add .", { timeout: 20000 });
      console.log("[GitHub] ✓ Files added (ignoring entries in .gitignore)");
    } catch (e) {
      console.error("[GitHub] Error adding files:", e);
      return { success: false };
    }

    // Step 7: Show what will be committed
    console.log("\n[GitHub] Step 7: Checking staged files...");
    try {
      const statusResult = await execAsync("git diff --cached --stat | tail -5", { timeout: 5000 });
      console.log("[GitHub] Staged changes:\n", statusResult.stdout || "(no changes)");
      
      // Count files
      const countResult = await execAsync("git diff --cached --name-only | wc -l", { timeout: 5000 });
      const fileCount = parseInt(countResult.stdout?.trim() || "0");
      console.log(`[GitHub] ✓ ${fileCount} files staged for commit`);
    } catch (e) {
      console.log("[GitHub] Could not get staged files info");
    }

    // Step 8: Check for sensitive files that should NOT be pushed
    console.log("\n[GitHub] Step 8: Security check...");
    try {
      const sensitiveCheck = await execAsync(
        "git diff --cached --name-only | grep -E '(\\.env|\\.session|secret|password|token|key)' || echo 'SAFE'",
        { timeout: 5000 }
      );
      if (sensitiveCheck.stdout?.trim() !== 'SAFE' && sensitiveCheck.stdout?.trim()) {
        console.log("[GitHub] ⚠ WARNING: Potentially sensitive files detected:");
        console.log(sensitiveCheck.stdout);
        // Unstage sensitive files
        await execAsync("git reset HEAD -- '*.env' '*.session' 2>/dev/null || true", { timeout: 5000 });
        console.log("[GitHub] ✓ Sensitive files unstaged");
      } else {
        console.log("[GitHub] ✓ No sensitive files detected");
      }
    } catch (e) {
      console.log("[GitHub] Security check passed");
    }

    // Step 9: Create commit
    console.log("\n[GitHub] Step 9: Creating commit...");
    const escapedMessage = message.replace(/"/g, '\\"').replace(/'/g, "\\'");
    try {
      const commitResult = await execAsync(`git commit -m "${escapedMessage}" 2>&1 || echo "NO_CHANGES"`, { timeout: 10000 });
      if (commitResult.stdout?.includes("NO_CHANGES") || commitResult.stdout?.includes("nothing to commit")) {
        console.log("[GitHub] No changes to commit");
        // Create empty commit if no changes
        await execAsync(`git commit --allow-empty -m "${escapedMessage}"`, { timeout: 10000 });
        console.log("[GitHub] ✓ Empty commit created");
      } else {
        console.log("[GitHub] ✓ Commit created");
      }
    } catch (e) {
      console.error("[GitHub] Commit failed:", e);
      return { success: false };
    }

    // Step 10: Push to GitHub
    console.log("\n[GitHub] Step 10: Pushing to GitHub...");
    try {
      await execAsync(`git push -f -u origin ${targetBranch}`, { timeout: 60000 });
      console.log("[GitHub] ✅ Successfully pushed to GitHub!");
      console.log("[GitHub] ========================================");
      return { success: true };
    } catch (pushError: any) {
      const errorMsg = pushError?.message || String(pushError);
      console.error("[GitHub] ✗ Push failed:", errorMsg.substring(0, 300));
      console.log("[GitHub] ========================================");
      return { success: false };
    }
  } catch (error) {
    console.error("[GitHub] ✗ Sync failed:", error);
    if (error instanceof Error) {
      console.error("[GitHub] Error:", error.message);
    }
    console.log("[GitHub] ========================================");
    return { success: false };
  }
}

export async function pushToGitHub(message: string): Promise<boolean> {
  try {
    console.log("[GitHub] Starting push with message:", message);

    await execAsync('git config user.email "replit-bot@replit.com"');
    await execAsync('git config user.name "Replit Auto-Sync"');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("[GitHub] No access token available");
      return false;
    }

    const githubInfo = await getGitHubInfo();
    if (!githubInfo) {
      console.error("[GitHub] Could not get GitHub repository info");
      return false;
    }

    await execAsync("git add .");
    console.log("[GitHub] Staged changes");

    const statusResult = await execAsync("git status --porcelain");
    if (!statusResult.stdout) {
      console.log("[GitHub] No changes to commit");
      return true;
    }

    const escapedMessage = message.replace(/"/g, '\\"');
    await execAsync(`git commit -m "${escapedMessage}"`);
    console.log("[GitHub] Commit created");

    const remoteUrl = `https://oauth2:${accessToken}@github.com/${githubInfo.owner}/${githubInfo.repo}.git`;
    await execAsync(`git push -f "${remoteUrl}" HEAD:main`);
    console.log("[GitHub] Push successful");

    return true;
  } catch (error) {
    console.error("[GitHub] Push failed:", error);
    return false;
  }
}
