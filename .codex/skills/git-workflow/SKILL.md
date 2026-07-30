---
name: git-workflow
description: Safely initialize, inspect, version, and publish Git repositories. Use when Codex needs to check or install Git, initialize a repository, review diffs, create focused commits, configure a GitHub remote, push branches, or prepare a pull request without losing local work.
---

# Git Workflow

## Inspect before changing anything

1. Read every applicable `AGENTS.md` before touching files.
2. Run `git --version`, `git status --short --branch`, `git remote -v`, and `git log --oneline -10`.
3. If the directory is not a repository, inspect its contents and ignore rules before running `git init`.
4. Treat all existing changes as user work. Never discard, overwrite, or amend them unless explicitly requested.

## Install Git only when missing

Use the platform package manager when available, then rerun `git --version`. Do not reinstall or upgrade a working Git installation merely to complete routine repository work.

## Create a focused commit

1. Review `git status --short` and `git diff --check`.
2. Inspect both unstaged and staged diffs with `git diff` and `git diff --cached`.
3. Run the repository's relevant tests or checks.
4. Stage only task-related paths. Avoid `git add .` when unrelated changes exist.
5. Recheck the staged diff and commit with a concise imperative message.
6. Verify the result with `git status --short --branch` and `git show --stat --oneline HEAD`.

Never use destructive recovery commands such as `git reset --hard` or `git checkout -- <path>`. To restore tracked content safely, write `git show HEAD:<path>` to a temporary file, inspect it, and deliberately replace the target.

## Publish to GitHub

1. Check existing remotes before creating a repository.
2. Use GitHub CLI authentication when available: `gh auth status`, then `gh auth login --web` only if needed.
3. Never print, persist, or commit access tokens.
4. For a new remote, prefer `gh repo create <name> --source=. --remote=origin --push` and choose visibility from the user's request. If visibility is unspecified, stop before exposing source publicly.
5. For an existing remote, push the current branch with `git push -u origin HEAD`.
6. Create a pull request only after the commit and push succeed. Use the repository's PR tool or `gh pr create` with a specific title, summary, and test results.

If authentication, account ownership, repository visibility, or network access is unresolved, preserve the local commit and clearly report the exact remaining command instead of guessing.

## Verify completion

Confirm all of the following with actual command output:

- Git is installed.
- The working tree contains no unintended changes.
- The requested commit exists.
- The remote URL points to the intended GitHub repository.
- The pushed branch or pull request exists remotely.
- Required project checks passed, or environment limitations are reported precisely.
