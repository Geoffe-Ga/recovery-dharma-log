/** API functions for each backend endpoint. */

import { TOKEN_KEY, api, getToken, postForm, setToken } from "./client";
import type {
  ActivityLogEntry,
  AssignmentUpdate,
  BookChapter,
  FormatOverride,
  GroupSettings,
  GroupSettingsUpdate,
  MeetingLogEntry,
  MeetingLogUpdate,
  ReadingAssignment,
  ReadingPlanStatus,
  SpeakerSchedule,
  Token,
  Topic,
  TopicDrawResult,
  UpcomingMeeting,
  UpcomingMeetingBrief,
  User,
} from "../types/index";

// --- Auth ---

export { TOKEN_KEY };

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
  // Backend expects OAuth2 form data, not JSON
  const token = await postForm<Token>("/auth/login", {
    username,
    password,
  });
  setToken(token.access_token);
  return token;
}

export function logout(): void {
  setToken(null);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

// --- Meetings ---

export async function getUpcomingMeeting(): Promise<UpcomingMeeting> {
  return api.get<UpcomingMeeting>("/meetings/upcoming");
}

export async function getUpcomingMeetings(
  weeks: number = 4,
): Promise<UpcomingMeetingBrief[]> {
  return api.get<UpcomingMeetingBrief[]>(
    `/meetings/upcoming/lookahead?weeks=${weeks}`,
  );
}

export async function getMeetingLog(): Promise<MeetingLogEntry[]> {
  return api.get<MeetingLogEntry[]>("/meetings/log");
}

export async function updateMeetingLogEntry(
  entryId: number,
  data: MeetingLogUpdate,
): Promise<MeetingLogEntry> {
  return api.put<MeetingLogEntry>(`/meetings/log/${entryId}`, data);
}

export async function cancelMeeting(
  meetingDate: string,
  isCancelled: boolean,
): Promise<MeetingLogEntry> {
  return api.post<MeetingLogEntry>("/meetings/cancel", {
    meeting_date: meetingDate,
    is_cancelled: isCancelled,
  });
}

export async function updateAttendance(
  meetingDate: string,
  count: number | null,
): Promise<MeetingLogEntry> {
  return api.put<MeetingLogEntry>(`/meetings/${meetingDate}/attendance`, {
    attendance_count: count,
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

export async function undoTopicDraw(): Promise<void> {
  await api.post("/topics/undo");
}

// --- Book ---

export async function getChapters(): Promise<BookChapter[]> {
  return api.get<BookChapter[]>("/book/chapters");
}

export async function getReadingPlan(): Promise<ReadingPlanStatus> {
  return api.get<ReadingPlanStatus>("/book/plan");
}

export async function addChapterToPlan(): Promise<ReadingPlanStatus> {
  return api.post<ReadingPlanStatus>("/book/plan/add-chapter");
}

export async function finalizePlan(): Promise<ReadingPlanStatus> {
  return api.post<ReadingPlanStatus>("/book/plan/finalize");
}

export async function updateAssignment(
  assignmentId: number,
  data: AssignmentUpdate,
): Promise<ReadingAssignment> {
  return api.put<ReadingAssignment>(`/book/assignments/${assignmentId}`, data);
}

export async function deleteAssignment(assignmentId: number): Promise<void> {
  await api.delete(`/book/assignments/${assignmentId}`);
}

// --- Speakers ---

export async function getSpeakerNames(): Promise<string[]> {
  return api.get<string[]>("/speakers/names");
}

export async function getSpeakerSchedule(): Promise<SpeakerSchedule[]> {
  return api.get<SpeakerSchedule[]>("/speakers/schedule");
}

export async function getUpcomingSpeakerDates(
  weeks: number = 8,
): Promise<SpeakerSchedule[]> {
  return api.get<SpeakerSchedule[]>(`/speakers/upcoming?weeks=${weeks}`);
}

export async function scheduleSpeaker(
  meetingDate: string,
  speakerName: string,
): Promise<SpeakerSchedule> {
  return api.post<SpeakerSchedule>("/speakers/schedule", {
    meeting_date: meetingDate,
    speaker_name: speakerName,
  });
}

export async function unscheduleSpeaker(meetingDate: string): Promise<void> {
  await api.delete(`/speakers/schedule/${meetingDate}`);
}

// --- Overrides ---

export async function getFormatOverrides(): Promise<FormatOverride[]> {
  return api.get<FormatOverride[]>("/overrides/");
}

export async function setFormatOverride(
  meetingDate: string,
  formatType: string,
): Promise<FormatOverride> {
  return api.put<FormatOverride>(`/overrides/${meetingDate}`, {
    format_type: formatType,
  });
}

export async function deleteFormatOverride(meetingDate: string): Promise<void> {
  await api.delete(`/overrides/${meetingDate}`);
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

export function getCsvExportUrl(startDate?: string, endDate?: string): string {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return `/api/export/csv${qs ? `?${qs}` : ""}`;
}

export function getPrintableExportUrl(
  startDate?: string,
  endDate?: string,
): string {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return `/api/export/printable${qs ? `?${qs}` : ""}`;
}

// --- Activity Log ---

export async function getActivity(): Promise<ActivityLogEntry[]> {
  return api.get<ActivityLogEntry[]>("/activity/");
}
