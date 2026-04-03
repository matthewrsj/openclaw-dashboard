/**
 * Slash command registry for the chat input.
 *
 * Each command has a name, description, usage string, and an async
 * execute function that returns a user-visible result message (or
 * null for silent success).
 */

import {
  execCli,
  execCliJson,
  writeWorkspaceFile,
  gatewayRpc,
} from "@/services/tauri-commands";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface SlashCommandContext {
  agentId: string;
  sessionKey: string;
  addToast: (toast: {
    type: string;
    message: string;
  }) => void;
  navigate: (opts: { to: string }) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  execute: (
    args: string[],
    context: SlashCommandContext,
  ) => Promise<string | null>;
}

// -------------------------------------------------------------------
// Argument parser
// -------------------------------------------------------------------

export function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

interface CronJob {
  id: string;
  name: string;
  agentId: string;
  schedule: { kind: string; expr: string; tz: string };
  payload: { kind: string; message?: string };
  enabled: boolean;
}

/** Run an arbitrary openclaw CLI command and return the output. */
async function runCli(
  args: string[],
): Promise<string> {
  const result = await execCli(args);
  if (!result) return "(CLI unavailable)";
  if (result.exitCode !== 0) {
    return result.stderr || `Exited with code ${result.exitCode}`;
  }
  return result.stdout || "(no output)";
}

// -------------------------------------------------------------------
// Commands
// -------------------------------------------------------------------

const commands: SlashCommand[] = [
  // -- General --
  {
    name: "help",
    description: "List all available slash commands",
    usage: "/help",
    execute: async () => {
      const lines = commands.map(
        (cmd) =>
          `**/${cmd.name}** -- ${cmd.description}`
          + `\n  \`${cmd.usage}\``,
      );
      return lines.join("\n\n");
    },
  },
  {
    name: "clear",
    description: "Clear chat messages for this session",
    usage: "/clear",
    execute: async () => "__CLEAR__",
  },
  {
    name: "status",
    description: "Show agent status and session info",
    usage: "/status",
    execute: async () => runCli(["status"]),
  },
  {
    name: "health",
    description: "Fetch gateway health status",
    usage: "/health",
    execute: async () => runCli(["health"]),
  },
  {
    name: "doctor",
    description:
      "Run health checks on gateway and channels",
    usage: "/doctor",
    execute: async () =>
      runCli(["doctor", "--non-interactive"]),
  },

  // -- Agent identity --
  {
    name: "model",
    description: "Change this agent's default model",
    usage: "/model <model-id>",
    execute: async (args, ctx) => {
      if (args.length < 1) {
        return "Usage: `/model <model-id>`";
      }
      const result = await execCli([
        "agents",
        "set-identity",
        ctx.agentId,
        "--model",
        args[0],
      ]);
      if (!result) return "(CLI unavailable)";
      if (result.exitCode !== 0) {
        return `Failed: ${result.stderr}`;
      }
      return `Model changed to **${args[0]}**.`;
    },
  },
  {
    name: "identity",
    description: "Update SOUL.md for this agent",
    usage: "/identity <text>",
    execute: async (args, ctx) => {
      if (args.length < 1) {
        return "Usage: `/identity <text>`";
      }
      const text = args.join(" ");
      await writeWorkspaceFile(
        ctx.agentId,
        "SOUL.md",
        text,
      );
      return "Updated **SOUL.md** for this agent.";
    },
  },

  // -- Models --
  {
    name: "models",
    description: "List available models",
    usage: "/models",
    execute: async () => runCli(["models", "list"]),
  },

  // -- Channels --
  {
    name: "bind",
    description: "Bind this agent to a channel",
    usage: "/bind <channel[:account]>",
    execute: async (args, ctx) => {
      if (args.length < 1) {
        return "Usage: `/bind <channel[:account]>`";
      }
      const result = await execCli([
        "agents",
        "bind",
        "--agent",
        ctx.agentId,
        "--bind",
        args[0],
      ]);
      if (!result) return "(CLI unavailable)";
      if (result.exitCode !== 0) {
        return `Bind failed: ${result.stderr}`;
      }
      return `Bound to **${args[0]}**.`;
    },
  },
  {
    name: "unbind",
    description: "Unbind this agent from a channel",
    usage: "/unbind <channel[:account]>",
    execute: async (args, ctx) => {
      if (args.length < 1) {
        return "Usage: `/unbind <channel[:account]>`";
      }
      const result = await execCli([
        "agents",
        "unbind",
        "--agent",
        ctx.agentId,
        "--bind",
        args[0],
      ]);
      if (!result) return "(CLI unavailable)";
      if (result.exitCode !== 0) {
        return `Unbind failed: ${result.stderr}`;
      }
      return `Unbound from **${args[0]}**.`;
    },
  },
  {
    name: "bindings",
    description: "Show this agent's channel bindings",
    usage: "/bindings",
    execute: async (_args, ctx) => {
      const bindings = await execCliJson<
        Array<{
          agentId: string;
          match: { channel: string; accountId?: string };
          description: string;
        }>
      >(["agents", "bindings"]);
      if (!bindings) return "(CLI unavailable)";
      const filtered = bindings.filter(
        (b) => b.agentId === ctx.agentId,
      );
      if (filtered.length === 0) {
        return "No channel bindings for this agent.";
      }
      return filtered
        .map((b) => `- **${b.match.channel}** ${b.description}`)
        .join("\n");
    },
  },
  {
    name: "channels",
    description: "List configured channels and status",
    usage: "/channels",
    execute: async () =>
      runCli(["channels", "list"]),
  },

  // -- Cron --
  {
    name: "schedule",
    description: "Create a cron job for this agent",
    usage:
      '/schedule "name" "0 9 * * *" "prompt"',
    execute: async (args, ctx) => {
      if (args.length < 3) {
        return (
          "Usage: `/schedule <name> <cron> <prompt>`\n\n"
          + "Example: `/schedule \"daily check\""
          + " \"0 9 * * *\" \"Check emails\"`"
        );
      }
      const [name, cronExpr, ...rest] = args;
      const prompt = rest.join(" ");
      const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      await gatewayRpc("cron.add", {
        agentId: ctx.agentId,
        name,
        schedule: { kind: "cron", expr: cronExpr, tz },
        payload: { kind: "agentTurn", message: prompt },
        enabled: true,
      });
      return (
        `Scheduled **${name}** (\`${cronExpr}\`)`
        + " for this agent."
      );
    },
  },
  {
    name: "jobs",
    description: "List cron jobs for this agent",
    usage: "/jobs",
    execute: async (_args, ctx) => {
      const raw = await execCliJson<
        { jobs: CronJob[] } | CronJob[]
      >(["cron", "list"]);
      if (!raw) return "(CLI unavailable)";
      const jobs = Array.isArray(raw)
        ? raw
        : raw.jobs || [];
      const filtered = jobs.filter(
        (j) => j.agentId === ctx.agentId,
      );
      if (filtered.length === 0) {
        return "No cron jobs for this agent.";
      }
      return filtered
        .map(
          (j) =>
            `- **${j.name}**`
            + ` (${j.enabled ? "on" : "off"})`
            + ` \`${j.schedule.expr}\``,
        )
        .join("\n");
    },
  },
  {
    name: "run",
    description: "Manually trigger a cron job by name",
    usage: "/run <job-name>",
    execute: async (args, ctx) => {
      if (args.length < 1) {
        return "Usage: `/run <job-name>`";
      }
      const jobName = args.join(" ");
      const raw = await execCliJson<
        { jobs: CronJob[] } | CronJob[]
      >(["cron", "list"]);
      if (!raw) return "(CLI unavailable)";
      const jobs = Array.isArray(raw)
        ? raw
        : raw.jobs || [];
      const job = jobs.find(
        (j) =>
          j.agentId === ctx.agentId && j.name === jobName,
      );
      if (!job) {
        return `No job named **${jobName}** for this agent.`;
      }
      await gatewayRpc("cron.run", { id: job.id });
      return `Triggered **${job.name}**.`;
    },
  },

  // -- Memory --
  {
    name: "memory",
    description: "Search agent memory files",
    usage: "/memory <query>",
    execute: async (args) => {
      if (args.length < 1) {
        return "Usage: `/memory <query>`";
      }
      return runCli([
        "memory",
        "search",
        args.join(" "),
      ]);
    },
  },

  // -- Skills --
  {
    name: "skills",
    description: "List available agent skills",
    usage: "/skills",
    execute: async () => runCli(["skills", "list"]),
  },

  // -- Messages --
  {
    name: "send",
    description: "Send a message via a channel",
    usage:
      '/send <channel> <target> "message"',
    execute: async (args) => {
      if (args.length < 3) {
        return (
          "Usage: `/send <channel> <target>"
          + ' "message"`'
        );
      }
      const [channel, target, ...rest] = args;
      const message = rest.join(" ");
      return runCli([
        "message",
        "send",
        "--channel",
        channel,
        "--target",
        target,
        "--message",
        message,
      ]);
    },
  },

  // -- Tasks --
  {
    name: "tasks",
    description: "List background tasks",
    usage: "/tasks [--status running]",
    execute: async (args) =>
      runCli(["tasks", "list", ...args]),
  },

  // -- Hooks --
  {
    name: "hooks",
    description: "List agent hooks",
    usage: "/hooks",
    execute: async () => runCli(["hooks", "list"]),
  },

  // -- Sessions --
  {
    name: "sessions",
    description: "List recent sessions",
    usage: "/sessions",
    execute: async (_args, ctx) =>
      runCli([
        "sessions",
        "--agent",
        ctx.agentId,
      ]),
  },

  // -- Generic CLI passthrough --
  {
    name: "cli",
    description: "Run any openclaw CLI command",
    usage: "/cli <command> [args...]",
    execute: async (args) => {
      if (args.length < 1) {
        return "Usage: `/cli <command> [args...]`";
      }
      return runCli(args);
    },
  },
];

// -------------------------------------------------------------------
// Registry API
// -------------------------------------------------------------------

/** Look up a command by exact name. */
export function findCommand(
  name: string,
): SlashCommand | undefined {
  return commands.find((c) => c.name === name);
}

/** Get all registered commands (for autocomplete). */
export function allCommands(): readonly SlashCommand[] {
  return commands;
}

/** Filter commands whose name starts with a prefix. */
export function filterCommands(
  prefix: string,
): SlashCommand[] {
  const lower = prefix.toLowerCase();
  return commands.filter((c) =>
    c.name.startsWith(lower),
  );
}
