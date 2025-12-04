
interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'info' | 'error' | 'warn' | 'debug';
  source: string;
  message: string;
}

class ConsoleLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Maximum number of logs to keep
  private idCounter = 0;

  addLog(level: LogEntry['level'], source: string, message: string) {
    const entry: LogEntry = {
      id: this.idCounter++,
      timestamp: new Date(),
      level,
      source,
      message
    };

    this.logs.unshift(entry); // Add to beginning

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  getLogs(limit?: number, source?: string, level?: string): LogEntry[] {
    let filtered = this.logs;

    if (source) {
      filtered = filtered.filter(log => log.source.toLowerCase().includes(source.toLowerCase()));
    }

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  clearLogs() {
    this.logs = [];
    this.idCounter = 0;
  }

  getStats() {
    const total = this.logs.length;
    const errors = this.logs.filter(l => l.level === 'error').length;
    const warnings = this.logs.filter(l => l.level === 'warn').length;
    const info = this.logs.filter(l => l.level === 'info').length;

    return { total, errors, warnings, info };
  }
}

export const consoleLogger = new ConsoleLogger();
