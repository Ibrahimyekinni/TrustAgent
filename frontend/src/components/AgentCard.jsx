export default function AgentCard({ agent, onClick }) {
  const hasImage = agent.image && !agent.image.includes("localhost");
  const v = agent.validation;

  return (
    <div
      className="agent-card"
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      role="button"
      tabIndex={0}
    >
      <div className="agent-card-header">
        {hasImage ? (
          <img
            src={agent.image}
            alt={agent.name}
            className="agent-card-image"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="agent-card-avatar">
            {agent.name?.charAt(0)?.toUpperCase() || "#"}
          </div>
        )}
        <div className="agent-card-info">
          <h4 className="agent-card-name">{agent.name}</h4>
          <span className="agent-card-id">ID: {agent.agentId}</span>
        </div>
        <div className="agent-card-badges">
          {v && (
            <div className={`agent-card-badge agent-card-badge--${v.verdict.toLowerCase()}`} title={`${v.verdict} -- ${v.score}%`}>
              {v.score}%
            </div>
          )}
          <span className={`agent-card-status ${agent.active ? "agent-card-status--active" : "agent-card-status--inactive"}`}>
            {agent.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      {agent.description && (
        <p className="agent-card-desc">
          {agent.description.length > 120
            ? agent.description.slice(0, 120) + "..."
            : agent.description}
        </p>
      )}
      <div className="agent-card-footer">
        <span className="agent-card-owner" title={agent.owner}>
          Owner: {agent.owner?.slice(0, 6)}...{agent.owner?.slice(-4)}
        </span>
        {agent.protocol && (
          <span className="agent-card-protocol">{agent.protocol}</span>
        )}
      </div>
    </div>
  );
}
