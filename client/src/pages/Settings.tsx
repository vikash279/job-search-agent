import { useEffect, useState } from "react";
import { client } from "../api";

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    client.settings().then(setSettings);
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Matching weights, daily limits, and enabled job sources. Secrets never appear here.</p>
        </div>
      </div>
      <article className="card">
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      </article>
    </div>
  );
}
