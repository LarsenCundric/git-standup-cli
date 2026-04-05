#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import chalk from 'chalk';
import { program } from 'commander';
import { git, gitLines, header, fatal, isInsideGitRepo, getGitUser, formatTime } from './utils.js';

program
  .name('git-standup')
  .description('What did I (or someone else) do recently? Shows commits from the last working day')
  .argument('[author]', 'author name or @username (default: you)')
  .option('-d, --days <number>', 'look back N days instead of last working day')
  .option('-t, --team', 'show commits from everyone')
  .option('-a, --all-repos', 'scan sibling directories for git repos too')
  .option('--no-dedupe', 'show duplicate commit messages (e.g. commit + PR merge)')
  .addHelpText('after', `
Examples:
  git standup                   Your commits from the last working day
  git standup @alice            Alice's commits
  git standup --team            Everyone's commits
  git standup -d 7              Your commits from the last 7 days
  git standup --all-repos       Scan sibling git repos too
  git standup --no-dedupe       Show all commits including duplicates`)
  .version('1.0.0')
  .action(run);

program.parse();

function getLastWorkingDay() {
  const now = new Date();
  const day = now.getDay();
  let daysBack;
  if (day === 1) daysBack = 3;
  else if (day === 0) daysBack = 2;
  else if (day === 6) daysBack = 1;
  else daysBack = 1;

  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalISO(d) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 19);
}

function getCommitsForRepo(repoPath, since, authorFilter, showAll) {
  const args = [
    'log', '--all',
    `--since=${toLocalISO(since)}`,
    '--format=%an%x00%aI%x00%s%x00%H',
    '--no-merges',
  ];
  if (!showAll && authorFilter) {
    args.push(`--author=${authorFilter}`);
  }
  const lines = gitLines(args, { cwd: repoPath, allowFail: true });
  return lines.map((line) => {
    const [author, date, msg, hash] = line.split('\0');
    return { author, date, msg, hash };
  }).filter((c) => c.author);
}

function batchGetFiles(repoPath, hashes) {
  if (hashes.length === 0) return {};
  const out = git(
    ['log', '--no-walk', '--format=%x00%H', '--name-only', ...hashes],
    { cwd: repoPath, allowFail: true },
  );
  const map = {};
  if (!out) return map;
  for (const block of out.split('\0')) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const hash = lines[0];
    map[hash] = lines.slice(1);
  }
  return map;
}

function findSiblingRepos(currentDir) {
  const parent = join(currentDir, '..');
  const repos = [];
  try {
    const entries = readdirSync(parent);
    for (const entry of entries) {
      const full = join(parent, entry);
      try {
        if (statSync(full).isDirectory()) {
          try { statSync(join(full, '.git')); repos.push(full); } catch {}
        }
      } catch {}
    }
  } catch {}
  return repos;
}

function run(authorArg, opts) {
  let since;
  if (opts.days) {
    const days = parseInt(opts.days, 10);
    if (Number.isNaN(days) || days <= 0) {
      fatal('--days must be a positive integer');
    }
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    since = d;
  } else {
    since = getLastWorkingDay();
  }

  const inGitRepo = isInsideGitRepo();

  let authorFilter = null;
  if (!opts.team) {
    if (authorArg) {
      authorFilter = authorArg.replace(/^@/, '');
    } else {
      if (inGitRepo) {
        authorFilter = getGitUser();
      } else {
        fatal('Not inside a git repository. Use --all-repos from a parent directory.');
      }
    }
  }

  let repos = [];
  if (inGitRepo) {
    repos.push(git(['rev-parse', '--show-toplevel']));
  }

  if (opts.allRepos || !inGitRepo) {
    const cwd = process.cwd();
    const siblings = findSiblingRepos(inGitRepo ? git(['rev-parse', '--show-toplevel']) : cwd);
    for (const s of siblings) {
      if (!repos.includes(s)) repos.push(s);
    }
    if (!inGitRepo) {
      try {
        for (const entry of readdirSync(cwd)) {
          const full = join(cwd, entry);
          try { statSync(join(full, '.git')); if (!repos.includes(full)) repos.push(full); } catch {}
        }
      } catch {}
    }
  }

  if (repos.length === 0) fatal('No git repositories found');

  const sinceStr = since.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const who = opts.team ? 'the team' : (authorFilter || 'you');
  header(`git standup ${chalk.white(who)} ${chalk.dim(`since ${sinceStr}`)}`);

  let totalCommits = 0;

  for (const repo of repos) {
    const repoName = basename(repo);
    let commits = getCommitsForRepo(repo, since, authorFilter, opts.team);
    if (commits.length === 0) continue;

    // Dedupe: collapse commits with identical author+message (e.g. commit + PR merge)
    // Strips trailing PR numbers like "(#123)" before comparing
    if (opts.dedupe !== false) {
      const normalize = (msg) => msg.replace(/\s*\(#\d+\)\s*$/, '').trim();
      const seen = new Set();
      commits = commits.filter((c) => {
        const key = `${c.author}\0${normalize(c.msg)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (commits.length === 0) continue;
    totalCommits += commits.length;

    const fileMap = batchGetFiles(repo, commits.map((c) => c.hash));

    if (repos.length > 1) {
      console.log(`  ${chalk.bold.blue(repoName)}`);
    }

    if (opts.team) {
      const byAuthor = {};
      for (const c of commits) {
        if (!byAuthor[c.author]) byAuthor[c.author] = [];
        byAuthor[c.author].push(c);
      }
      for (const [author, authorCommits] of Object.entries(byAuthor)) {
        console.log(`  ${chalk.yellow(author)}:`);
        for (const c of authorCommits) {
          const time = formatTime(c.date);
          const files = fileMap[c.hash] || [];
          console.log(`    ${chalk.dim(time)}  ${c.msg}`);
          if (files.length > 0 && files.length <= 5) {
            console.log(`    ${chalk.dim('         ' + files.join(', '))}`);
          } else if (files.length > 5) {
            console.log(`    ${chalk.dim('         ' + files.slice(0, 4).join(', '))} ${chalk.dim(`+${files.length - 4} more`)}`);
          }
        }
        console.log();
      }
    } else {
      for (const c of commits) {
        const time = formatTime(c.date);
        const files = fileMap[c.hash] || [];
        console.log(`  ${chalk.dim(time)}  ${c.msg}`);
        if (files.length > 0 && files.length <= 5) {
          console.log(`  ${chalk.dim('       ' + files.join(', '))}`);
        } else if (files.length > 5) {
          console.log(`  ${chalk.dim('       ' + files.slice(0, 4).join(', '))} ${chalk.dim(`+${files.length - 4} more`)}`);
        }
      }
      console.log();
    }
  }

  if (totalCommits === 0) {
    console.log(chalk.dim(`  No commits found since ${sinceStr}`));
    console.log();
  } else {
    console.log(chalk.dim(`  ${totalCommits} commit${totalCommits === 1 ? '' : 's'} total`));
    console.log();
  }
}
