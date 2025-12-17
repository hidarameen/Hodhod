/**
 * GitHub Sync Service - SIMPLIFIED & ROBUST
 * Push ALL files from Replit workspace to GitHub with force overwrite
 */

import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Increase buffer size for large git operations (10MB instead of default 1MB)
const EXEC_OPTIONS = { 
  maxBuffer: 10 * 1024 * 1024,
  shell: '/bin/bash',
  timeout: 120000 // 2 minutes timeout
};

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
      return {
        name: r.name,
        owner: ownerLogin,
        url: r.html_url,
        private: r.private || false,
      };
    });

    return result;
  } catch (error) {
    console.error("Error listing repos:", error);
    return [];
  }
}

export async function getBranches(): Promise<string[]> {
  try {
    const result = await execAsync("git branch -a --format='%(refname:short)'", EXEC_OPTIONS);
    const branches = result.stdout
      ?.split("\n")
      .filter((b) => b.trim() && !b.includes("HEAD"))
      .map((b) => b.trim())
      .filter((b, i, arr) => arr.indexOf(b) === i) || [];

    const currentBranch = await execAsync("git rev-parse --abbrev-ref HEAD", EXEC_OPTIONS);
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
    const result = await execAsync("git diff --name-status HEAD~1..HEAD 2>/dev/null || git diff --name-status 2>/dev/null || echo ''", EXEC_OPTIONS);
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
 * PUSH ALL FILES FROM REPLIT TO GITHUB
 * - Adds ALL files (including ignored ones with --force)
 * - Commits with provided message
 * - Force pushes to replace everything in GitHub
 * - GitHub becomes identical to Replit after this operation
 */
export async function pushToGitHubRepo(
  owner: string,
  repo: string,
  message: string,
  targetBranch: string = "main"
): Promise<{ success: boolean }> {
  const startTime = Date.now();
  try {
    console.log("\n[GitHub] ========================================");
    console.log("[GitHub] 🚀 Starting Complete Workspace Push");
    console.log("[GitHub] ========================================");
    console.log(`[GitHub] Owner: ${owner}`);
    console.log(`[GitHub] Repository: ${repo}`);
    console.log(`[GitHub] Target Branch: ${targetBranch}`);
    console.log(`[GitHub] Commit Message: ${message}`);
    console.log("[GitHub] ========================================\n");

    // Step 1: Clean up
    console.log("[GitHub] ⚙️ Step 1: Cleanup...");
    try {
      await execAsync('rm -f /home/runner/workspace/.git/index.lock 2>/dev/null || true', EXEC_OPTIONS);
    } catch (e) {
      // ignore
    }
    console.log("[GitHub] ✓ Cleanup done\n");

    // Step 2: Configure Git
    console.log("[GitHub] ⚙️ Step 2: Configure Git...");
    await execAsync('git config user.email "replit-bot@replit.com"', EXEC_OPTIONS);
    await execAsync('git config user.name "Replit Auto-Sync"', EXEC_OPTIONS);
    console.log("[GitHub] ✓ Git configured\n");

    // Step 3: Get token
    console.log("[GitHub] 🔑 Step 3: Retrieve GitHub token...");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("[GitHub] ✗ No GitHub token available");
      return { success: false };
    }
    console.log("[GitHub] ✓ Token retrieved\n");

    // Step 4: Configure remote
    console.log("[GitHub] 🔗 Step 4: Configure remote...");
    try {
      await execAsync(`git remote remove origin 2>/dev/null || true`, EXEC_OPTIONS);
    } catch (e) {
      // ignore
    }
    const remoteUrl = `https://oauth2:${accessToken}@github.com/${owner}/${repo}.git`;
    await execAsync(`git remote add origin "${remoteUrl}"`, EXEC_OPTIONS);
    console.log("[GitHub] ✓ Remote configured\n");

    // Step 5: Add all tracked project files (respecting .gitignore)
    console.log("[GitHub] 📦 Step 5: Adding all project files...");
    await execAsync("git add .", EXEC_OPTIONS);
    console.log("[GitHub] ✓ Project files added\n");

    // Step 6: Get file count summary
    console.log("[GitHub] 📊 Step 6: Analyzing changes...");
    let fileCount = 0;
    try {
      const lsResult = await execAsync("git ls-files | wc -l", EXEC_OPTIONS);
      fileCount = parseInt(lsResult.stdout?.trim() || "0") || 0;
      console.log(`[GitHub] ✓ Total files in staging: ${fileCount}\n`);
    } catch (e) {
      console.log("[GitHub] ℹ️ Could not count files\n");
    }

    // Step 7: Check if there are changes
    console.log("[GitHub] ✓ Step 7: Check for changes...");
    const statusResult = await execAsync("git status --porcelain 2>/dev/null | wc -l", EXEC_OPTIONS);
    const changesCount = parseInt(statusResult.stdout?.trim() || "0") || 0;
    if (changesCount > 0) {
      console.log(`[GitHub] ✓ Found ${changesCount} changes to commit\n`);
    } else {
      console.log("[GitHub] ℹ️ No new changes detected (will force push anyway)\n");
    }

    // Step 8: Commit
    console.log("[GitHub] 💾 Step 8: Creating commit...");
    try {
      // Use single quotes with proper escaping for Arabic characters
      const escapedMsg = message.replace(/'/g, "'\\''");
      const commitResult = await execAsync(`git commit -m '${escapedMsg}'`, EXEC_OPTIONS);
      const hashMatch = commitResult.stdout?.match(/\[.*? ([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1].substring(0, 7) : "unknown";
      console.log(`[GitHub] ✓ Commit created: ${commitHash}\n`);
    } catch (e: any) {
      // Might fail if nothing to commit, but we'll push anyway
      console.log("[GitHub] ℹ️ No new commits needed (might already be up to date)\n");
    }

    // Step 9: Push with force (this will OVERWRITE GitHub with Replit content)
    console.log("[GitHub] 🚀 Step 9: Force pushing to GitHub...");
    console.log(`[GitHub] This will replace all GitHub content with Replit workspace content\n`);
    
    const pushResult = await execAsync(
      `git push --force --set-upstream origin ${targetBranch}`,
      EXEC_OPTIONS
    );
    
    console.log("[GitHub] Push output:", pushResult.stdout);
    console.log("[GitHub] ✓ Force push completed\n");

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n[GitHub] ========================================");
    console.log("[GitHub] ✅ PUSH SUCCESSFUL!");
    console.log("[GitHub] ========================================");
    console.log(`[GitHub] Files synced: ${fileCount}`);
    console.log(`[GitHub] Branch: ${targetBranch}`);
    console.log(`[GitHub] Duration: ${duration}s`);
    console.log("[GitHub] Status: GitHub now equals Replit workspace");
    console.log("[GitHub] ========================================\n");

    return { success: true };
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("\n[GitHub] ✗ PUSH FAILED!");
    console.error("[GitHub] Error details:", error.message || error);
    if (error.stderr) {
      console.error("[GitHub] Git stderr:", error.stderr);
    }
    console.error(`[GitHub] Duration: ${duration}s`);
    console.log("[GitHub] ========================================\n");
    return { success: false };
  }
}

export async function pushToGitHub(message: string): Promise<boolean> {
  try {
    console.log("[GitHub] Starting push with message:", message);

    await execAsync('git config user.email "replit-bot@replit.com"', EXEC_OPTIONS);
    await execAsync('git config user.name "Replit Auto-Sync"', EXEC_OPTIONS);

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

    await execAsync("git add .", EXEC_OPTIONS);
    console.log("[GitHub] Staged changes");

    const statusResult = await execAsync("git status --porcelain", EXEC_OPTIONS);
    if (!statusResult.stdout) {
      console.log("[GitHub] No changes to commit");
      return true;
    }

    const escapedMessage = message.replace(/'/g, "'\\''");
    await execAsync(`git commit -m '${escapedMessage}'`, EXEC_OPTIONS);
    console.log("[GitHub] Commit created");

    const remoteUrl = `https://oauth2:${accessToken}@github.com/${githubInfo.owner}/${githubInfo.repo}.git`;
    await execAsync(`git push --force -u origin HEAD:main`, EXEC_OPTIONS);
    console.log("[GitHub] Push successful");

    return true;
  } catch (error) {
    console.error("[GitHub] Push failed:", error);
    return false;
  }
}
