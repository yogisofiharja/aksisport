import { apiFetch, apiUrl } from '../api/client';
import type { ClubChatState, ConversationMessage, GroupChat, GroupThread, MessageableUser } from '../api/types';

// DP-021 step 3: group chats (up to 50, managed by their creator) and one
// chat per Community.

type OutgoingMessage = { body?: string; image?: { base64: string; contentType: string } };

function messageBody(message: OutgoingMessage) {
  return JSON.stringify({ body: message.body, imageBase64: message.image?.base64, imageContentType: message.image?.contentType });
}

// Any message's image, for anyone in its conversation.
export function conversationImageUrl(messageId: string): string {
  return apiUrl(`/v1/conversation-messages/${messageId}/image`);
}

// People you could message: you share a Community, or already have a
// direct conversation. Blocked people (either way) are left out.
export function listMessageableUsers(query: string): Promise<MessageableUser[]> {
  return apiFetch(`/v1/me/messageable-users?q=${encodeURIComponent(query)}`);
}

export function listMyGroups(): Promise<GroupThread[]> {
  return apiFetch('/v1/me/groups');
}

export function createGroup(title: string, memberIds: string[]): Promise<GroupChat> {
  return apiFetch('/v1/groups', { method: 'POST', body: JSON.stringify({ title, memberIds }) });
}

export function getGroup(groupId: string): Promise<GroupChat> {
  return apiFetch(`/v1/groups/${groupId}`);
}

export function renameGroup(groupId: string, title: string): Promise<void> {
  return apiFetch(`/v1/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ title }) });
}

export function addGroupMembers(groupId: string, userIds: string[]): Promise<GroupChat> {
  return apiFetch(`/v1/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userIds }) });
}

// Removing yourself is leaving.
export function removeGroupMember(groupId: string, userId: string): Promise<void> {
  return apiFetch(`/v1/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}

export function listGroupMessages(groupId: string): Promise<ConversationMessage[]> {
  return apiFetch(`/v1/groups/${groupId}/messages`);
}

export function sendGroupMessage(groupId: string, message: OutgoingMessage): Promise<ConversationMessage> {
  return apiFetch(`/v1/groups/${groupId}/messages`, { method: 'POST', body: messageBody(message) });
}

export function getClubChat(clubId: string): Promise<ClubChatState> {
  return apiFetch(`/v1/clubs/${clubId}/chat`);
}

export function setClubChatEnabled(clubId: string, enabled: boolean): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/chat`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
}

export function listClubChatMessages(clubId: string): Promise<ConversationMessage[]> {
  return apiFetch(`/v1/clubs/${clubId}/chat/messages`);
}

export function sendClubChatMessage(clubId: string, message: OutgoingMessage): Promise<ConversationMessage> {
  return apiFetch(`/v1/clubs/${clubId}/chat/messages`, { method: 'POST', body: messageBody(message) });
}

// Owner/admin: remove any message from the Community chat.
export function removeClubChatMessage(clubId: string, messageId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/chat/messages/${messageId}`, { method: 'DELETE' });
}
