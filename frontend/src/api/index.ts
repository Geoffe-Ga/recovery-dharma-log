/** API functions for each backend endpoint. */

import { api, setToken } from "./client";
import type {
  BookChapter,
  GroupSettings,
  GroupSettingsUpdate,
  MeetingLogEntry,
  ReadingAssignment,
  ReadingPlanStatus,
  SpeakerSchedule,
  Token,
  Topic,
  TopicDrawResult,
  UpcomingMeeting,
  User,
} from "../types/index";

// --- Auth ---

export async function register(
  username: string,
  password: string,
): Promise<User> {
  return api.post<User>("/auth/register", { username, password });
}

export async function login(
  username: string,
  password: string,
): Promise<Token> {
  const token = await api.post<Token>("/auth/login", { username, password });
  setToken(token.access_token);
  return token;
}

export function logout(): void {
  setToken(null);
}

// --- Meetings ---

export async function getUpcomingMeeting(): Promise<UpcomingMeeting> {
  return api.get<UpcomingMeeting>("/meetings/upcoming");
}

export async function getMeetingLog(): Promise<MeetingLogEntry[]> {
  return api.get<MeetingLogEntry[]>("/meetings/log");
}

export async function cancelMeeting(
  meetingDate: string,
  isCancelled: boolean,
): Promise<void> {
  await api.post("/meetings/cancel", {
    meeting_date: meetingDate,
    is_cancelled: isCancelled,
  });
}

// --- Topics ---

export async function getTopics(): Promise<Topic[]> {
  return api.get<Topic[]>("/topics/");
}

export async function createTopic(name: string): Promise<Topic> {
  return api.post<Topic>("/topics/", { name });
}

export async function deleteTopic(topicId: number): Promise<void> {
  await api.delete(`/topics/${topicId}`);
}

export async function drawTopic(): Promise<TopicDrawResult> {
  return api.post<TopicDrawResult>("/topics/draw");
}

export async function reshuffleTopics(): Promise<void> {
  await api.post("/topics/reshuffle");
}

// --- Book ---

export async function getChapters(): Promise<BookChapter[]> {
  return api.get<BookChapter[]>("/book/chapters");
}

export async function getAssignments(): Promise<ReadingAssignment[]> {
  return api.get<ReadingAssignment[]>("/book/assignments");
}

export async function getReadingPlan(): Promise<ReadingPlanStatus> {
  return api.get<ReadingPlanStatus>("/book/plan");
}

export async function addChapterToPlan(): Promise<ReadingPlanStatus> {
  return api.post<ReadingPlanStatus>("/book/plan/add-chapter");
}

export async function finalizePlan(): Promise<void> {
  await api.post("/book/plan/finalize");
}

// --- Speakers ---

export async function getSpeakerSchedule(): Promise<SpeakerSchedule[]> {
  return api.get<SpeakerSchedule[]>("/speakers/schedule");
}

export async function scheduleSpeaker(
  meetingDate: string,
  speakerName: string,
): Promise<void> {
  await api.post("/speakers/schedule", {
    meeting_date: meetingDate,
    speaker_name: speakerName,
  });
}

export async function unscheduleSpeaker(meetingDate: string): Promise<void> {
  await api.delete(`/speakers/schedule/${meetingDate}`);
}

// --- Settings ---

export async function getSettings(): Promise<GroupSettings> {
  return api.get<GroupSettings>("/settings/");
}

export async function updateSettings(
  settings: GroupSettingsUpdate,
): Promise<GroupSettings> {
  return api.put<GroupSettings>("/settings/", settings);
}

// --- Export ---

export function getCsvExportUrl(): string {
  return "/api/export/csv";
}

export function getPrintableExportUrl(): string {
  return "/api/export/printable";
}
