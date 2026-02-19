/** Settings page - group configuration. */

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../api/index";
import type { GroupSettings } from "../types/index";

export function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings({ name: settings.name });
      setSettings(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!settings) return <p>No settings found.</p>;

  return (
    <main>
      <h1>Settings</h1>
      <section>
        <h2>Meeting Info</h2>
        <label>
          Group Name
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>
        <p>Meeting Day: {settings.meeting_day}</p>
        <p>Start Date: {settings.start_date}</p>
      </section>

      <section>
        <h2>Format Rotation</h2>
        <ol>
          {settings.format_rotation.map((format, i) => (
            <li key={i}>{format}</li>
          ))}
        </ol>
      </section>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </main>
  );
}
