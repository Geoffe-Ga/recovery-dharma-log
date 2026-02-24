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
  start_date?: string;
  format_rotation?: string[];
}

export interface UpcomingMeeting {
  meeting_date: string;
  meeting_time: string | null;
  format_type: string;
  is_cancelled: boolean;
  topic_name: string | null;
  speaker_name: string | null;
  book_chapter: string | null;
  topics_remaining: number;
  topics_total: number;
  banners: string[];
}

export interface UpcomingMeetingBrief {
  meeting_date: string;
  meeting_time: string | null;
  format_type: string;
  is_cancelled: boolean;
}

export interface MeetingLogEntry {
  id: number;
  meeting_date: string;
  format_type: string;
  content_summary: string | null;
  speaker_name: string | null;
  topic_name: string | null;
  reading_assignment_summary: string | null;
  is_cancelled: boolean;
}

export interface Topic {
  id: number;
  name: string;
  is_active: boolean;
  is_drawn: boolean;
  last_used: string | null;
}

export interface TopicDrawResult {
  topic: Topic;
  topics_remaining: number;
  topics_total: number;
  deck_cycle: number;
}

export interface BookChapter {
  id: number;
  order: number;
  start_page: string;
  end_page: string;
  title: string;
  page_count: number;
}

export interface ReadingAssignment {
  id: number;
  assignment_order: number;
  chapters: BookChapter[];
  total_pages: number;
}

export interface AssignmentUpdate {
  chapter_ids: number[];
}

export interface ReadingPlanStatus {
  current_assignment_chapters: BookChapter[];
  current_assignment_total_pages: number;
  next_chapter: BookChapter | null;
  completed_assignments: ReadingAssignment[];
}

export interface SpeakerSchedule {
  meeting_date: string;
  speaker_name: string | null;
}
