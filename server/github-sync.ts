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
 * دفع ملفات Replit إلى GitHub بخطوات بسيطة
 * git add . → git commit → git push -f
 */
export async function pushToGitHubRepo(
  owner: string,
  repo: string,
  message: string,
  targetBranch: string = "main"
): Promise<{ success: boolean }> {
  try {
    console.log("[GitHub] Starting push...");

    // Step 1: Configure git
    await execAsync('git config user.email "replit-bot@replit.com"');
    await execAsync('git config user.name "Replit Auto-Sync"');

    // Step 2: Get token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("[GitHub] No token available");
      return { success: false };
    }

    // Step 3: Setup remote
    try {
      await execAsync(`git remote remove origin 2>/dev/null || true`);
    } catch (e) {
      // ignore
    }
    const remoteUrl = `https://oauth2:${accessToken}@github.com/${owner}/${repo}.git`;
    await execAsync(`git remote add origin "${remoteUrl}"`);

    // Step 1: git add
    console.log("[GitHub] Step 1: git add .");
    await execAsync("git add .");

    // Step 2: git commit
    console.log("[GitHub] Step 2: git commit");
    const escapedMessage = message.replace(/"/g, '\\"').replace(/'/g, "\\'");
    try {
      await execAsync(`git commit -m "${escapedMessage}"`);
    } catch (e) {
      console.log("[GitHub] No changes to commit, creating empty commit");
      await execAsync(`git commit --allow-empty -m "${escapedMessage}"`);
    }

    // Step 3: git push force
    console.log("[GitHub] Step 3: git push -f");
    await execAsync(`git push -f -u origin ${targetBranch}`);

    console.log("[GitHub] ✅ Successfully pushed to GitHub!");
    return { success: true };
  } catch (error) {
    console.error("[GitHub] Push failed:", error);
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
