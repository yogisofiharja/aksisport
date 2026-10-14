import { apiFetch, apiUrl } from '../api/client';
import type { ConversationMessage, ConversationRead, DirectThread } from '../api/types';

// DP-020 Direct Messages: one conversation per pair of players, keyed by
// the other person's user id.

export function listDirectThreads(): Promise<DirectThread[]> {
  return apiFetch('/v1/me/direct-threads');
}

export function listDirectMessages(otherUserId: string): Promise<ConversationMessage[]> {
  return apiFetch(`/v1/dm/${otherUserId}/messages`);
}

export function sendDirectMessage(
  otherUserId: string,
  message: { body?: string; image?: { base64: string; contentType: string } }
): Promise<ConversationMessage> {
  return apiFetch(`/v1/dm/${otherUserId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      body: message.body,
      imageBase64: message.image?.base64,
      imageContentType: message.image?.contentType,
    }),
  });
}

export function directMessageImageUrl(messageId: string): string {
  return apiUrl(`/v1/dm/messages/${messageId}/image`);
}

// DP-021: read receipts and the Inbox badge, for every kind of conversation.

export function markConversationRead(conversationId: string): Promise<void> {
  return apiFetch(`/v1/conversations/${conversationId}/read`, { method: 'POST' });
}

export function listConversationReads(conversationId: string): Promise<ConversationRead[]> {
  return apiFetch(`/v1/conversations/${conversationId}/reads`);
}

export function getUnreadMessageCount(): Promise<{ count: number }> {
  return apiFetch('/v1/me/unread-messages');
}
