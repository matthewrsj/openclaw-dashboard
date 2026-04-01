import { Link } from "@tanstack/react-router";
import type { Agent } from "@/types/agent";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatTokens, formatCost } from "@/lib/format";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const getBadgeVariant = (status: Agent["status"]) => {
    switch (status) {
      case "active":
        return "success";
      case "error":
        return "error";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="transition-all hover:shadow-lg">
      <Link
        to="/agent/$agentId"
        params={{ agentId: agent.id }}
        className="block"
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{agent.emoji}</span>
              <div>
                <h3 className="font-semibold text-text-primary">
                  {agent.name}
                </h3>
                <p className="text-sm text-text-secondary">{agent.model}</p>
              </div>
            </div>
            <Badge variant={getBadgeVariant(agent.status)}>
              {agent.status}
            </Badge>
          </div>
          {agent.activity && (
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <StatusDot status="success" size="sm" pulse />
              <span className="truncate">{agent.activity}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary">Tokens Today</span>
              <div className="font-medium">
                {formatTokens(agent.tokensToday.input + agent.tokensToday.output)}
              </div>
            </div>
            <div>
              <span className="text-text-tertiary">Cost Today</span>
              <div className="font-medium">{formatCost(agent.costToday)}</div>
            </div>
          </div>

          {agent.subagents.length > 0 && (
            <div className="mt-3 border-t border-border-primary pt-3">
              <div className="text-xs text-text-tertiary">
                {agent.subagents.length} active subagent
                {agent.subagents.length !== 1 ? "s" : ""}
              </div>
              <div className="mt-1 flex space-x-1">
                {agent.subagents.slice(0, 3).map((sub) => (
                  <StatusDot
                    key={sub.key}
                    status={
                      sub.status === "running"
                        ? "success"
                        : sub.status === "failed"
                          ? "error"
                          : "inactive"
                    }
                    size="sm"
                    pulse={sub.status === "running"}
                  />
                ))}
                {agent.subagents.length > 3 && (
                  <span className="text-xs text-text-tertiary">
                    +{agent.subagents.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {agent.bindings.length > 0 && (
            <div className="mt-3 border-t border-border-primary pt-3">
              <div className="text-xs text-text-tertiary mb-1">Channels</div>
              <div className="flex flex-wrap gap-1">
                {agent.bindings.slice(0, 2).map((binding) => (
                  <Badge key={binding.channelId} variant="secondary">
                    {binding.channelType}
                  </Badge>
                ))}
                {agent.bindings.length > 2 && (
                  <Badge variant="secondary">
                    +{agent.bindings.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}