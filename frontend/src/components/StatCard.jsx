
const StatCard = ({ title, value, icon: Icon, color, caption }) => {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <p>{title}</p>

      <h2>{value}</h2>

      <span className="stat-caption">
        {caption || "Current invoice count"}
      </span>
    </div>
  );
};

export default StatCard;
