/** Landing page - shows the next upcoming meeting. */

import { useCallback, useEffect, useState } from "react";
import { drawTopic, getUpcomingMeeting, scheduleSpeaker } from "../api/index";
import type { UpcomingMeeting } from "../types/index";
import { formatMeetingDate } from "../utils/dates";

export function Landing(): React.ReactElement {
  const [meeting, setMeeting] = useState<UpcomingMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakerInput, setSpeakerInput] = useState("");
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const updated = await getUpcomingMeeting();
      setMeeting(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const handleDrawTopic = useCallback(async () => {
    try {
      await drawTopic();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to draw topic");
    }
  }, [refresh]);

  const handleScheduleSpeaker = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!meeting || !speakerInput.trim()) return;
      try {
        await scheduleSpeaker(meeting.meeting_date, speakerInput.trim());
        setSpeakerInput("");
        setShowSpeakerForm(false);
        await refresh();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to schedule speaker",
        );
      }
    },
    [meeting, speakerInput, refresh],
  );

  if (loading) return <p aria-busy="true">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!meeting) return <p>No upcoming meeting found.</p>;

  return (
    <main className="rd-landing">
      {meeting.banners.length > 0 && (
        <div role="alert">
          {meeting.banners.map((banner) => (
            <p key={banner}>
              <strong>{banner}</strong>
            </p>
          ))}
        </div>
      )}

      <article>
        <header>
          <h2>{formatMeetingDate(meeting.meeting_date)}</h2>
          <span className="rd-format-badge">{meeting.format_type}</span>
        </header>

        {meeting.format_type === "Topic" && (
          <section>
            {meeting.topic_name ? (
              <p>
                <strong>{meeting.topic_name}</strong>
              </p>
            ) : (
              <button type="button" onClick={handleDrawTopic}>
                Draw Topic
              </button>
            )}
            <p className="rd-deck-status">
              {meeting.topics_remaining} of {meeting.topics_total} topics remain
              in deck
            </p>
          </section>
        )}

        {meeting.format_type === "Speaker" && (
          <section>
            {meeting.speaker_name ? (
              <p>
                <strong>{meeting.speaker_name}</strong>
              </p>
            ) : (
              <>
                {showSpeakerForm ? (
                  <form onSubmit={handleScheduleSpeaker}>
                    <input
                      type="text"
                      placeholder="Speaker name"
                      value={speakerInput}
                      onChange={(e) => setSpeakerInput(e.target.value)}
                    />
                    <button type="submit">Schedule</button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => setShowSpeakerForm(false)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSpeakerForm(true)}
                  >
                    Schedule Speaker
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {meeting.format_type === "Book Study" && meeting.book_chapter && (
          <section>
            <p>
              <strong>{meeting.book_chapter}</strong>
            </p>
          </section>
        )}
      </article>
    </main>
  );
}
