# git-standup-cli

> What did I do yesterday? See your recent git activity at a glance.

## Install

```sh
npm install -g git-standup-cli
```

## Usage

```sh
# What did I do yesterday?
git standup

# What did Alice do?
git standup @alice

# Show the whole team's activity
git standup --team

# Last 7 days
git standup -d 7

# Scan all repos in parent directory
git standup --all-repos
```

### Example output

```
git standup Alice since Friday, Mar 7 ─────────────

  09:42 AM  Fix auth token refresh on expired sessions
            src/auth.ts, src/middleware.ts
  10:15 AM  Add rate limiting to API endpoints
            src/api/routes.ts, src/api/middleware.ts, tests/api.test.ts
  02:33 PM  Update README with new API docs
            README.md

  3 commits total
```

### Team view

```
git standup the team since Friday, Mar 7 ──────────

  Alice:
    09:42 AM  Fix auth token refresh on expired sessions
    10:15 AM  Add rate limiting to API endpoints

  Bob:
    11:30 AM  Refactor database connection pool
    03:45 PM  Add migration for user preferences table

  4 commits total
```

## Features

- **Smart weekday detection**: On Monday, shows Friday's work (skips weekends)
- **Multi-repo scanning**: Use `--all-repos` to scan sibling directories
- **Team view**: `--team` shows everyone's commits grouped by author
- **Files touched**: Shows which files each commit modified
- **Flexible lookback**: `-d N` to look back N days
- **Auto-dedupe**: Collapses duplicate commit messages (e.g. commit + PR merge). Disable with `--no-dedupe`

## Part of [git-enhanced](https://github.com/LarsenCundric/git-enhanced)

Install all git power tools at once: `npm install -g git-enhanced`

| Tool | What it does |
|---|---|
| [git who](https://github.com/LarsenCundric/git-who-cli) | Find who knows a file best |
| **git standup** | What did I do yesterday? |
| [git nuke](https://github.com/LarsenCundric/git-nuke-cli) | Delete a branch everywhere |
| [git undo](https://github.com/LarsenCundric/smart-git-undo) | Smart undo for any git operation |

## License

MIT
