import { storage } from "./storage";

interface LogEntry {
  component: string;
  function: string;
  errorType: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  errorMessage: string;
  stackTrace?: string;
  metadata?: any;
}

class Logger {
  private queue: LogEntry[] = [];
  private flushing = false;

  log(entry: LogEntry) {
    this.queue.push(entry);
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  async flush() {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    
    const entries = this.queue.splice(0, this.queue.length);
    for (const entry of entries) {
      try {
        await storage.createErrorLog(entry);
      } catch (e) {
        // Fail silently to avoid infinite loops
      }
    }
    this.flushing = false;
  }

  info(component: string, fn: string, message: string, metadata?: any) {
    this.log({ component, function: fn, errorType: "INFO", errorMessage: message, metadata });
  }

  warn(component: string, fn: string, message: string, metadata?: any) {
    this.log({ component, function: fn, errorType: "WARN", errorMessage: message, metadata });
  }

  error(component: string, fn: string, message: string, stackTrace?: string, metadata?: any) {
    this.log({ component, function: fn, errorType: "ERROR", errorMessage: message, stackTrace, metadata });
  }

  success(component: string, fn: string, message: string, metadata?: any) {
    this.log({ component, function: fn, errorType: "SUCCESS", errorMessage: message, metadata });
  }
}

export const logger = new Logger();

// Setup periodic flush
setInterval(() => {
  logger.flush();
}, 5000);
