import { execFileSync } from 'node:child_process';
import chalk from 'chalk';

export function git(args, opts = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).trim();
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

export function gitLines(args, opts = {}) {
  const out = git(args, opts);
  return out ? out.split('\n') : [];
}

export function isInsideGitRepo() {
  try {
    git(['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export function getGitUser() {
  return git(['config', 'user.name'], { allowFail: true }) || 'unknown';
}

export const symbols = {
  cross: '✗',
  line: '─',
};

export function header(text) {
  // Strip ANSI escape codes to get visible length for alignment
  const visibleLength = text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').length;
  const line = symbols.line.repeat(Math.max(0, 50 - visibleLength));
  console.log(`\n${chalk.bold.cyan(text)} ${chalk.dim(line)}\n`);
}

export function fatal(msg) {
  console.error(`${chalk.red(symbols.cross)} ${msg}`);
  process.exit(1);
}

export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
