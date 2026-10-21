# Dev container only — production builds run on Vercel (Node runtime).
FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

ARG BUN_VERSION=1.3.11

# Install Bun globally, pinned. Installed via npm rather than the curl installer
# so BUN_INSTALL stays unset — that keeps Bun's package cache at
# ~/.bun/install/cache, which devcontainer.json mounts as a named volume.
RUN npm install -g "bun@${BUN_VERSION}" && bun --version

# Mount point for the Claude Code config volume. Created here so the empty named
# volume is initialised owned by node; otherwise it mounts as root and `claude`
# cannot write to it.
RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude
