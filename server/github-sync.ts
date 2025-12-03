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
 * دفع كل ملفات المشروع إلى GitHub مع سجلات تفصيلية
 * git add . → git commit → git push -f
 * عرض الملفات واحد تلو الآخر بشكل متحرك
 */
export async function pushToGitHubRepo(
  owner: string,
  repo: string,
  message: string,
  targetBranch: string = "main"
): Promise<{ success: boolean }> {
  try {
    console.log("\n[GitHub] ========================================");
    console.log("[GitHub] 🚀 Starting GitHub Push");
    console.log("[GitHub] ========================================");
    console.log(`[GitHub] Repository: ${owner}/${repo}`);
    console.log(`[GitHub] Target Branch: ${targetBranch}`);
    console.log(`[GitHub] Commit Message: ${message}`);
    console.log("[GitHub] ========================================\n");

    // Cleanup: Remove stale lock file if exists
    console.log("[GitHub] 🔄 Cleaning up git locks...");
    try {
      await execAsync('rm -f /home/runner/workspace/.git/index.lock 2>/dev/null || true');
      console.log("[GitHub] ✓ Lock file cleaned");
      await execAsync('sleep 1');
    } catch (e) {
      console.log("[GitHub] ⚠️  Could not clean lock file");
    }

    // Setup: Configure git
    console.log("[GitHub] 🔧 Setting up Git configuration...");
    await execAsync('git config user.email "replit-bot@replit.com"');
    await execAsync('git config user.name "Replit Auto-Sync"');
    console.log("[GitHub] ✓ Git configured\n");

    // Setup: Get token
    console.log("[GitHub] 🔑 Retrieving GitHub access token...");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("[GitHub] ✗ No token available");
      return { success: false };
    }
    console.log("[GitHub] ✓ Token retrieved\n");

    // Setup: Setup remote
    console.log("[GitHub] 🔗 Configuring remote repository...");
    try {
      await execAsync(`git remote remove origin 2>/dev/null || true`);
    } catch (e) {
      // ignore
    }
    const remoteUrl = `https://oauth2:${accessToken}@github.com/${owner}/${repo}.git`;
    await execAsync(`git remote add origin "${remoteUrl}"`);
    console.log("[GitHub] ✓ Remote configured\n");

    // Step 1: git add . with force option to include all files
    console.log("[GitHub] 📦 Step 1: Adding all files (including ignored patterns)...");
    // Add all files including those that might be ignored
    await execAsync("git add --force .");
    // Also explicitly add attached_assets to ensure it's included
    try {
      await execAsync("git add --force attached_assets/ 2>/dev/null || true");
    } catch (e) {
      // Silently fail if attached_assets doesn't exist
    }
    
    // Get list of ALL tracked/untracked files being pushed
    let allFiles: string[] = [];
    try {
      // Get all files that will be pushed (modified, new, deleted)
      const unstagedResult = await execAsync("git diff --name-only HEAD 2>/dev/null || echo ''");
      const modifiedFiles = unstagedResult.stdout?.trim().split("\n").filter(f => f) || [];
      
      const stagedResult = await execAsync("git diff --cached --name-only");
      const stagedFiles = stagedResult.stdout?.trim().split("\n").filter(f => f) || [];
      
      const untrackedResult = await execAsync("git ls-files --others --exclude-standard");
      const untrackedFiles = untrackedResult.stdout?.trim().split("\n").filter(f => f) || [];
      
      const fileSet = new Set([...modifiedFiles, ...stagedFiles, ...untrackedFiles]);
      allFiles = Array.from(fileSet).sort();
    } catch (e) {
      // If git is not initialized or other issues, get all files using ls-files
      const lsResult = await execAsync("git ls-files");
      allFiles = lsResult.stdout?.trim().split("\n").filter(f => f) || [];
    }

    if (allFiles.length === 0) {
      console.log("[GitHub] ℹ️  No files to commit (repository may be up to date)");
      console.log("[GitHub] Attempting to push anyway with force push...\n");
    } else {
      console.log(`[GitHub] ✓ Found ${allFiles.length} files:\n`);
      
      // Get detailed file status
      const statusResult = await execAsync("git status --porcelain");
      const statusLines = statusResult.stdout?.trim().split("\n").filter(l => l) || [];
      
      const modifiedFiles: string[] = [];
      const addedFiles: string[] = [];
      const deletedFiles: string[] = [];
      const renamedFiles: string[] = [];
      
      statusLines.forEach(line => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        
        if (status === 'M' || status === 'MM' || status === 'AM') {
          modifiedFiles.push(file);
        } else if (status === 'A' || status === '??') {
          addedFiles.push(file);
        } else if (status === 'D') {
          deletedFiles.push(file);
        } else if (status === 'R') {
          renamedFiles.push(file);
        }
      });
      
      console.log("[GitHub] 📋 تقرير التغييرات التفصيلي:\n");
      
      if (addedFiles.length > 0) {
        console.log(`[GitHub] ✨ ملفات جديدة (${addedFiles.length}):`);
        addedFiles.slice(0, 10).forEach((file, i) => {
          console.log(`[GitHub]    ${i + 1}. ➕ ${file}`);
        });
        if (addedFiles.length > 10) {
          console.log(`[GitHub]    ... و ${addedFiles.length - 10} ملف آخر`);
        }
        console.log();
      }
      
      if (modifiedFiles.length > 0) {
        console.log(`[GitHub] 🔄 ملفات معدلة (${modifiedFiles.length}):`);
        modifiedFiles.slice(0, 10).forEach((file, i) => {
          console.log(`[GitHub]    ${i + 1}. 📝 ${file}`);
        });
        if (modifiedFiles.length > 10) {
          console.log(`[GitHub]    ... و ${modifiedFiles.length - 10} ملف آخر`);
        }
        console.log();
      }
      
      if (deletedFiles.length > 0) {
        console.log(`[GitHub] 🗑️  ملفات محذوفة (${deletedFiles.length}):`);
        deletedFiles.slice(0, 10).forEach((file, i) => {
          console.log(`[GitHub]    ${i + 1}. ❌ ${file}`);
        });
        if (deletedFiles.length > 10) {
          console.log(`[GitHub]    ... و ${deletedFiles.length - 10} ملف آخر`);
        }
        console.log();
      }
      
      if (renamedFiles.length > 0) {
        console.log(`[GitHub] ♻️  ملفات معاد تسميتها (${renamedFiles.length}):`);
        renamedFiles.slice(0, 10).forEach((file, i) => {
          console.log(`[GitHub]    ${i + 1}. 🔄 ${file}`);
        });
        if (renamedFiles.length > 10) {
          console.log(`[GitHub]    ... و ${renamedFiles.length - 10} ملف آخر`);
        }
        console.log();
      }

      // Get file statistics
      const statsResult = await execAsync("git diff --cached --stat 2>/dev/null || echo 'No staged changes'");
      console.log("[GitHub] 📊 إحصائيات التغييرات:");
      console.log(statsResult.stdout || "(no staged changes)");
      
      // Summary
      console.log("\n[GitHub] 📈 ملخص:");
      console.log(`[GitHub]    إجمالي الملفات: ${allFiles.length}`);
      console.log(`[GitHub]    جديد: ${addedFiles.length} | معدل: ${modifiedFiles.length} | محذوف: ${deletedFiles.length}`);
      console.log();
    }

    // Step 2: git commit
    console.log("\n[GitHub] 💾 Step 2: Creating commit...");
    // Use -m flag directly with proper escaping for Arabic characters
    const escapedMessage = message.replace(/'/g, "'\\''");
    const commitResult = await execAsync(`git commit -m '${escapedMessage}'`, { shell: '/bin/bash' });
    
    // Extract commit hash
    const commitMatch = commitResult.stdout?.match(/\[.*? ([a-f0-9]+)\]/);
    const commitHash = commitMatch ? commitMatch[1].substring(0, 7) : "unknown";
    console.log(`[GitHub] ✓ Commit created (${commitHash})\n`);

    // Step 3: git push force
    console.log("[GitHub] 🚀 Step 3: Pushing to GitHub...");
    console.log(`[GitHub] Pushing to: origin/${targetBranch}\n`);
    
    await execAsync(`git push -f -u origin ${targetBranch}`);
    
    console.log("\n[GitHub] ========================================");
    console.log("[GitHub] ✅ Successfully pushed to GitHub!");
    console.log("[GitHub] ========================================");
    console.log(`[GitHub] Total files in repository: ${allFiles.length}`);
    console.log(`[GitHub] Branch: ${targetBranch}`);
    console.log(`[GitHub] Commit: ${commitHash}`);
    console.log("[GitHub] ========================================\n");

    return { success: true };
  } catch (error) {
    console.error("\n[GitHub] ✗ Push failed!");
    console.error("[GitHub] Error:", error);
    console.log("[GitHub] ========================================\n");
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
