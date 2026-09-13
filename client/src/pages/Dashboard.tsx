import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client, type Application } from "../api";

export function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    client.tracking().then((res) => {
      setCounts(res.counts);
      setRecent(res.recent);
    });
    client.profile().then((res) => setProfile(res.profile));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Your copilot desk</h1>
          <p>Search, score, prepare, and approve — nothing is submitted without you.</p>
        </div>
        <Link className="btn" to="/jobs">Search jobs</Link>
      </div>
      <div className="grid cards">
        {["PENDING_APPROVAL", "APPROVED", "REQUIRES_USER_ACTION", "SUBMITTED"].map((status) => (
          <article className="card" key={status}>
            <div className="muted">{status.replaceAll("_", " ")}</div>
            <h2>{counts[status] ?? 0}</h2>
          </article>
        ))}
      </div>
      <div className="split" style={{ marginTop: 20 }}>
        <article className="card">
          <h3>Candidate snapshot</h3>
          <p>{String(profile?.headline || "Add a headline in your profile")}</p>
          <p className="muted">{String(profile?.summary || "Upload a CV to extract a structured profile.")}</p>
          <Link to="/profile">Edit profile</Link>
        </article>
        <article className="card">
          <h3>Recent applications</h3>
          <div className="list">
            {recent.map((item) => (
              <Link key={item.id} to={`/applications/${item.id}`}>
                {item.job?.title} — {item.status}
              </Link>
            ))}
            {recent.length === 0 && <p className="muted">No applications yet.</p>}
          </div>
        </article>
      </div>
    </div>
  );
}
