type ActionProp = React.ReactNode | { label: string; onClick: () => void };

function isActionObject(action: ActionProp): action is { label: string; onClick: () => void } {
  return typeof action === "object" && action !== null && !Array.isArray(action) && "label" in action && "onClick" in action;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: ActionProp;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className || ""}`}
    >
      {icon && <div className="mb-4 text-text-tertiary">{icon}</div>}
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-text-secondary">{description}</p>
      )}
      {action && (
        <div>
          {isActionObject(action) ? (
            <button
              onClick={action.onClick}
              className="mt-2 rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent-primary-hover"
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}