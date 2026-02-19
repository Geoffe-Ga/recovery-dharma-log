/** Landing page - shows the next upcoming meeting. */

import { useCallback, useEffect, useState } from "react";
import { drawTopic, getUpcomingMeeting } from "../api/index";
import type { UpcomingMeeting } from "../types/index";

export function Landing(): React.ReactElement {
  const [meeting, setMeeting] = useState<UpcomingMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUpcomingMeeting()
      .then(setMeeting)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleDrawTopic = useCallback(async () => {
    try {
      await drawTopic();
      const updated = await getUpcomingMeeting();
      setMeeting(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to draw topic");
    }
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!meeting) return <p>No upcoming meeting found.</p>;

  return (
    <main>
      <h1>What&apos;s Next</h1>
      <article>
        <header>
          <h2>{meeting.meeting_date}</h2>
          <p>
            Format: <strong>{meeting.format_type}</strong>
          </p>
        </header>

        {meeting.format_type === "Topic" && (
          <section>
            {meeting.topic_name ? (
              <p>{meeting.topic_name}</p>
            ) : (
              <button type="button" onClick={handleDrawTopic}>
                Draw Topic
              </button>
            )}
            <p>
              {meeting.topics_remaining} of {meeting.topics_total} topics remain
            </p>
          </section>
        )}

        {meeting.format_type === "Speaker" && (
          <section>
            {meeting.speaker_name ? (
              <p>{meeting.speaker_name}</p>
            ) : (
              <p>No speaker scheduled</p>
            )}
          </section>
        )}

        {meeting.format_type === "Book Study" && meeting.book_chapter && (
          <section>
            <p>{meeting.book_chapter}</p>
          </section>
        )}
      </article>
    </main>
  );
}
