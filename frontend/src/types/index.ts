/** Shared TypeScript types matching backend schemas. */

export interface User {
  id: number;
  username: string;
  group_id: number;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface GroupSettings {
  name: string;
  meeting_day: number;
  start_date: string;
  meeting_time: string | null;
  format_rotation: string[];
}

export interface GroupSettingsUpdate {
  name?: string;
  meeting_day?: number;
  meeting_time?: string | null;
  format_rotation?: string[];
}

export interface UpcomingMeeting {
  meeting_date: string;
  format_type: string;
  topic_name: string | null;
  speaker_name: string | null;
  book_chapter: string | null;
  topics_remaining: number;
  topics_total: number;
}

export interface MeetingLogEntry {
  meeting_date: string;
  format_type: string;
  topic_name: string | null;
  speaker_name: string | null;
  book_chapter: string | null;
  is_cancelled: boolean;
}

export interface Topic {
  id: number;
  name: string;
  in_current_deck: boolean;
}

export interface TopicDrawResult {
  topic: string;
  topics_remaining: number;
}

export interface BookChapter {
  id: number;
  chapter_order: number;
  title: string;
  start_page: number;
  end_page: number;
}

export interface ReadingAssignment {
  id: number;
  assignment_order: number;
  chapters: string;
  page_start: number;
  page_end: number;
  is_finalized: boolean;
}

export interface ReadingPlanStatus {
  current_assignment_chapters: string[];
  current_page_start: number | null;
  current_page_end: number | null;
  next_chapter: BookChapter | null;
  total_assignments: number;
}

export interface SpeakerSchedule {
  meeting_date: string;
  speaker_name: string;
}
