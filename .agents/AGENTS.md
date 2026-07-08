# Project Rules

## Deployment Workflow

- **NEVER directly edit, upload, or write files to the server via SSH or SFTP.**
- All code changes MUST be made on the local machine, committed with `git commit`, and pushed with `git push`.
- The user will manually run `git pull` on the server after each push. Do not run `git pull` automatically unless explicitly instructed.
- After the user confirms the pull is done, proceed with any follow-up steps (e.g., `pm2 restart`).

## Server Git Pull Method

The server cannot reach GitHub over HTTPS. The correct way to pull on the server is via SSH:

```bash
cd ~/Social
git remote set-url origin git@github.com:SheikhMustehsan/Social.git
git pull origin main
```

Always instruct the user to use this exact command sequence when asking them to pull on the server. Do NOT instruct them to use `https://github.com/...` URLs.

## Server Access

- SSH commands (via `sshHelper.js`) are only permitted for:
  - Running read-only diagnostic commands (e.g., `pm2 logs`, `cat`, `ls`, `ps`)
  - Running scripts/utilities already present on the server (e.g., `npx tsx scripts/...`)
  - Restarting services (e.g., `pm2 restart social-backend`)
  - Killing stuck processes (e.g., `pkill -f chrome`)
- Never use `sshHelper.js upload` or any SSH-based file write to deploy code.
