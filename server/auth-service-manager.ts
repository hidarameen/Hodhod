/**
 * Manages the persistent Userbot Auth Service subprocess
 * Keeps the service running and provides HTTP client access
 */
import { spawn, ChildProcess } from "child_process";
import axios, { AxiosInstance } from "axios";

const AUTH_SERVICE_PORT = 8765;
const AUTH_SERVICE_URL = `http://127.0.0.1:${AUTH_SERVICE_PORT}`;

class AuthServiceManager {
  private process: ChildProcess | null = null;
  private client: AxiosInstance;
  private maxRetries = 30;
  private retryDelay = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: AUTH_SERVICE_URL,
      timeout: 30000,
    });
  }

  async start() {
    if (this.process) {
      console.log("[auth-service] Service already running");
      return;
    }

    console.log("[auth-service] Starting auth service...");
    
    const command = process.env.NODE_ENV === "production" ? "python" : "uv";
    const args = process.env.NODE_ENV === "production"
      ? ["-m", "uvicorn", "telegram_bot.auth_service:app", "--host", "127.0.0.1", "--port", "8765"]
      : ["run", "python", "-m", "uvicorn", "telegram_bot.auth_service:app", "--host", "127.0.0.1", "--port", "8765"];

    this.process = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONPATH: process.cwd(), UV_PROJECT_ENVIRONMENT: "venv" },
    });

    this.process.stdout?.on("data", (data) => {
      console.log(`[auth-service] ${data.toString().trim()}`);
    });

    this.process.stderr?.on("data", (data) => {
      console.error(`[auth-service-err] ${data.toString().trim()}`);
    });

    this.process.on("exit", (code) => {
      console.warn(`[auth-service] Process exited with code ${code}`);
      this.process = null;
    });

    await this.waitForReady();
  }

  private async waitForReady() {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        await this.client.get("/health");
        console.log("[auth-service] Service is ready!");
        return;
      } catch (error) {
        if (i < this.maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        } else {
          throw new Error("Failed to start auth service after multiple retries");
        }
      }
    }
  }

  async stop() {
    if (this.process) {
      console.log("[auth-service] Stopping auth service...");
      this.process.kill();
      this.process = null;
    }
  }

  async startLogin(phoneNumber: string) {
    return await this.client.post("/start-login", { phone_number: phoneNumber });
  }

  async verifyCode(phoneNumber: string, code: string) {
    return await this.client.post("/verify-code", { phone_number: phoneNumber, code });
  }

  async verify2FA(phoneNumber: string, password: string) {
    return await this.client.post("/verify-2fa", { phone_number: phoneNumber, password });
  }

  async cancelLogin(phoneNumber: string) {
    return await this.client.post("/cancel-login", { phone_number: phoneNumber });
  }

  async logout(phoneNumber?: string) {
    return await this.client.post("/logout", { phone_number: phoneNumber || null });
  }

  async getLoginStatus(phoneNumber: string) {
    return await this.client.get(`/login-status/${encodeURIComponent(phoneNumber)}`);
  }
}

export const authServiceManager = new AuthServiceManager();
