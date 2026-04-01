import type { Agent } from "@/types/agent";
import { useSessionStore } from "@/stores/sessions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCost, formatTokens, formatRelativeTime, formatDuration } from "@/lib/format";
import { useShallow } from "zustand/react/shallow";

interface AgentOverviewProps { agent: Agent; }

export function AgentOverview({ agent }: AgentOverviewProps) {
  const activeSessions = useSessionStore(useShallow((s) => {
    const keys = s.byAgent.get(agent.id) || [];
    return keys
      .map((k) => s.sessions.get(k))
      .filter((sess): sess is NonNullable<typeof sess> => sess !== undefined && sess.status === "active");
  }));
  const allSessions = useSessionStore(useShallow((s) => {
    const keys = s.byAgent.get(agent.id) || [];
    return keys
      .map((k) => s.sessions.get(k))
      .filter((sess): sess is NonNullable<typeof sess> => sess !== undefined);
  }));
  const currentSession = activeSessions[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Current Session</CardTitle></CardHeader>
        <CardContent>
          {currentSession ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">ID</span><span className="font-mono text-xs">{currentSession.sessionId.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Channel</span><span>{currentSession.channel}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Started</span><span>{formatRelativeTime(currentSession.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Messages</span><span>{currentSession.messageCount}</span></div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>Context</span><span>{formatTokens(currentSession.tokens.total)} / {formatTokens(currentSession.tokens.contextWindow)}</span>
                </div>
                <ProgressBar value={currentSession.tokens.percentUsed} showLabel size="md" />
              </div>
              <div className="flex justify-between"><span className="text-text-secondary">Cost</span><span>{formatCost(currentSession.cost)}</span></div>
            </div>
          ) : <p className="text-sm text-text-tertiary">No active session</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Subagents</CardTitle></CardHeader>
        <CardContent>
          {agent.subagents.length === 0 ? <p className="text-sm text-text-tertiary">No subagents</p> : (
            <div className="space-y-2">
              {agent.subagents.map((sub) => (
                <div key={sub.key} className="flex items-center gap-2 text-sm">
                  <StatusDot status={sub.status === "running" ? "success" : sub.status === "failed" ? "error" : sub.status === "completed" ? "success" : "inactive"} size="sm" pulse={sub.status === "running"} />
                  <span className="flex-1 truncate">{sub.label}</span>
                  <span className="text-xs text-text-tertiary">{sub.status === "running" ? formatDuration(Date.now() - sub.startedAt) : formatDuration(sub.durationMs)}</span>
                  {sub.status === "failed" && <span className="text-xs text-status-error">✗</span>}
                  {sub.status === "completed" && <span className="text-xs text-status-success">✓</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Channel Bindings</CardTitle></CardHeader>
        <CardContent>
          {agent.bindings.length === 0 ? <p className="text-sm text-text-tertiary">No channel bindings</p> : (
            <div className="space-y-1.5">
              {agent.bindings.map((b) => <div key={b.channelId} className="flex items-center gap-2 text-sm"><span>{b.bound ? "✓" : "✗"}</span><span>{b.channelType}</span></div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Quick Stats</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">Sessions today</span><span>{allSessions.length}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Total cost</span><span>{formatCost(agent.costToday)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Tokens today</span><span>{formatTokens(agent.tokensToday.input + agent.tokensToday.output)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
