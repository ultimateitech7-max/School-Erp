'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { getStoredAuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  type ApiSuccessResponse,
  type MessageRecipientRecord,
  type MessageRecord,
} from '@/utils/api';

interface MessageChatWorkspaceProps {
  title: string;
  description: string;
}

interface MessageThreadRecord {
  participant: MessageRecipientRecord;
  messages: MessageRecord[];
  unreadCount: number;
  updatedAt: string;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getParticipantSubtitle(participant: MessageRecipientRecord) {
  return participant.roleType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function buildParticipantFromMessage(
  item: MessageRecord,
  currentUserId: string,
): MessageRecipientRecord {
  const counterpart = item.sender.id === currentUserId ? item.receiver : item.sender;

  return {
    id: counterpart.id,
    name: counterpart.name,
    email: counterpart.email,
    role: counterpart.role,
    roleType: counterpart.roleType,
    userType: counterpart.roleType as MessageRecipientRecord['userType'],
  };
}

export function MessageChatWorkspace({
  title,
  description,
}: MessageChatWorkspaceProps) {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [inbox, setInbox] = useState<MessageRecord[]>([]);
  const [sent, setSent] = useState<MessageRecord[]>([]);
  const [recipients, setRecipients] = useState<MessageRecipientRecord[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [newChatRecipientId, setNewChatRecipientId] = useState('');
  const [selectedThreadUserId, setSelectedThreadUserId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'threads' | 'chat' | 'new'>('threads');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const currentUserId = getStoredAuthSession()?.user.id ?? '';

  const loadWorkspace = async () => {
    setLoading(true);

    try {
      const [inboxResponse, sentResponse, recipientResponse] = await Promise.all([
        apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/inbox'),
        apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/sent'),
        apiFetch<ApiSuccessResponse<MessageRecipientRecord[]>>('/messages/recipients'),
      ]);

      setInbox(inboxResponse.data);
      setSent(sentResponse.data);
      setRecipients(recipientResponse.data);
    } catch (error) {
      setInbox([]);
      setSent([]);
      setRecipients([]);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to load message workspace.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 980px)');
    const syncViewport = () => {
      const nextIsMobile = mediaQuery.matches;
      setIsMobile(nextIsMobile);
      setMobileView((current) => {
        if (!nextIsMobile) {
          return 'threads';
        }

        return current;
      });
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  const allMessages = useMemo(() => {
    const uniqueMessages = new Map<string, MessageRecord>();

    [...inbox, ...sent].forEach((item) => {
      uniqueMessages.set(item.id, item);
    });

    return Array.from(uniqueMessages.values()).sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }, [inbox, sent]);

  const recipientRoleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          recipients.map((recipient) => [
            recipient.roleType,
            recipient.roleType.replaceAll('_', ' '),
          ]),
        ).entries(),
      ),
    [recipients],
  );

  const filteredRecipients = useMemo(
    () =>
      recipients.filter((recipient) =>
        roleFilter ? recipient.roleType === roleFilter : true,
      ),
    [recipients, roleFilter],
  );

  const threads = useMemo(() => {
    const threadMap = new Map<string, MessageThreadRecord>();

    allMessages.forEach((item) => {
      const participant = buildParticipantFromMessage(item, currentUserId);
      const existingThread = threadMap.get(participant.id);

      if (existingThread) {
        existingThread.messages.push(item);
        existingThread.updatedAt = item.createdAt;
        if (!item.isRead && item.receiver.id === currentUserId) {
          existingThread.unreadCount += 1;
        }
        return;
      }

      threadMap.set(participant.id, {
        participant,
        messages: [item],
        unreadCount: !item.isRead && item.receiver.id === currentUserId ? 1 : 0,
        updatedAt: item.createdAt,
      });
    });

    return Array.from(threadMap.values()).sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }, [allMessages, currentUserId]);

  useEffect(() => {
    if (
      selectedThreadUserId &&
      (threads.some((thread) => thread.participant.id === selectedThreadUserId) ||
        recipients.some((recipient) => recipient.id === selectedThreadUserId))
    ) {
      return;
    }

    if (isMobile) {
      setSelectedThreadUserId('');
      return;
    }

    setSelectedThreadUserId(threads[0]?.participant.id ?? '');
  }, [isMobile, recipients, selectedThreadUserId, threads]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.participant.id === selectedThreadUserId) ?? null,
    [selectedThreadUserId, threads],
  );

  const selectedRecipient = useMemo(
    () =>
      recipients.find((recipient) => recipient.id === selectedThreadUserId) ??
      selectedThread?.participant ??
      null,
    [recipients, selectedThread, selectedThreadUserId],
  );

  useEffect(() => {
    const unreadMessages =
      selectedThread?.messages.filter(
        (item) => !item.isRead && item.receiver.id === currentUserId,
      ) ?? [];

    if (!unreadMessages.length) {
      return;
    }

    let isActive = true;

    void Promise.all(
      unreadMessages.map((item) =>
        apiFetch<ApiSuccessResponse<MessageRecord>>(`/messages/${item.id}/read`, {
          method: 'PATCH',
        }).catch(() => null),
      ),
    ).then((responses) => {
      if (!isActive) {
        return;
      }

      const updatedById = new Map(
        responses
          .filter((item): item is ApiSuccessResponse<MessageRecord> => Boolean(item))
          .map((item) => [item.data.id, item.data]),
      );

      if (!updatedById.size) {
        return;
      }

      setInbox((current) =>
        current.map((item) => updatedById.get(item.id) ?? item),
      );
    });

    return () => {
      isActive = false;
    };
  }, [currentUserId, selectedThread]);

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }, [selectedThreadUserId, selectedThread?.messages.length]);

  const openThread = (recipientId: string) => {
    setSelectedThreadUserId(recipientId);
    setMessage(null);
    setIsNewChatOpen(false);
    setNewChatRecipientId('');
    setRoleFilter('');

    if (isMobile) {
      setMobileView('chat');
    }
  };

  const handleStartNewChat = () => {
    if (!newChatRecipientId) {
      setMessage({
        type: 'error',
        text: 'Select a person to start a new chat.',
      });
      return;
    }

    openThread(newChatRecipientId);
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!selectedRecipient || !draft.trim()) {
      setMessage({
        type: 'error',
        text: 'Choose a chat and write a message first.',
      });
      return;
    }

    setSending(true);

    try {
      const response = await apiFetch<ApiSuccessResponse<MessageRecord>>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: selectedRecipient.id,
          message: draft.trim(),
        }),
      });

      setSent((current) => [...current, response.data]);
      setDraft('');
      setSelectedThreadUserId(selectedRecipient.id);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to send message.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `/messages/${messageId}`,
        {
          method: 'DELETE',
        },
      );

      setInbox((current) => current.filter((item) => item.id !== messageId));
      setSent((current) => current.filter((item) => item.id !== messageId));
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete message.',
      });
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleDeleteThread = async () => {
    if (!selectedRecipient) {
      return;
    }

    setDeletingThread(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deletedCount: number }>>(
        `/messages/thread/${selectedRecipient.id}`,
        {
          method: 'DELETE',
        },
      );

      setInbox((current) =>
        current.filter(
          (item) =>
            item.sender.id !== selectedRecipient.id &&
            item.receiver.id !== selectedRecipient.id,
        ),
      );
      setSent((current) =>
        current.filter(
          (item) =>
            item.sender.id !== selectedRecipient.id &&
            item.receiver.id !== selectedRecipient.id,
        ),
      );
      setSelectedThreadUserId('');

      if (isMobile) {
        setMobileView('threads');
      }

      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete chat.',
      });
    } finally {
      setDeletingThread(false);
    }
  };

  const unreadCount = useMemo(
    () => threads.reduce((count, thread) => count + thread.unreadCount, 0),
    [threads],
  );

  const isNewChatVisible = isNewChatOpen || mobileView === 'new';
  const shouldShowSidebar =
    !isMobile || mobileView === 'threads' || mobileView === 'new';
  const shouldShowChatPanel = !isMobile || mobileView === 'chat';

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading chats..." />
      </section>
    );
  }

  return (
    <section className="card panel compact-panel-stack">
      <div className="message-chat-toolbar">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">{description}</p>
        </div>
        <div className="chip-list">
          <Badge tone={unreadCount ? 'info' : 'neutral'}>
            {unreadCount} unread
          </Badge>
          <Badge tone="neutral">{threads.length} chats</Badge>
        </div>
      </div>

      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <div className="message-chat-layout">
        {shouldShowSidebar ? (
          <aside className="message-chat-sidebar">
            <div className="message-chat-sidebar-head">
              <div>
                <h3>Recent Chats</h3>
                <p className="muted-text">Only recent conversations stay here.</p>
              </div>
              <Button
                className="message-chat-sidebar-toggle"
                onClick={() => {
                  if (isNewChatVisible) {
                    setIsNewChatOpen(false);
                    setMobileView('threads');
                    return;
                  }

                  setIsNewChatOpen(true);
                  setMobileView('new');
                  setMessage(null);
                }}
                size="sm"
                type="button"
                variant={isNewChatVisible ? 'ghost' : 'secondary'}
              >
                {isNewChatVisible ? 'X' : 'New Chat'}
              </Button>
            </div>

            {isNewChatVisible ? (
              <div className="message-chat-new-card">
                <div className="message-chat-new-head">
                  <strong>Start New Chat</strong>
                  {isMobile ? (
                    <button
                      className="message-chat-back"
                      onClick={() => {
                        setIsNewChatOpen(false);
                        setMobileView('threads');
                      }}
                      type="button"
                    >
                      Back
                    </button>
                  ) : null}
                </div>

                <div className="message-chat-new-form">
                  <Field label="Role">
                    <Select
                      value={roleFilter}
                      onChange={(event) => {
                        setRoleFilter(event.target.value);
                        setNewChatRecipientId('');
                      }}
                    >
                      <option value="">All roles</option>
                      {recipientRoleOptions.map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Person">
                    <Select
                      value={newChatRecipientId}
                      onChange={(event) => setNewChatRecipientId(event.target.value)}
                    >
                      <option value="">Select person</option>
                      {filteredRecipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.name} ({recipient.roleType.replaceAll('_', ' ')})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="form-actions">
                  <Button onClick={handleStartNewChat} size="sm" type="button">
                    Open Chat
                  </Button>
                </div>
              </div>
            ) : null}

            {(!isMobile || mobileView !== 'new') ? (
              <div className="message-chat-thread-list">
                {threads.length ? (
                  threads.map((thread) => (
                    <button
                      className={`message-chat-thread${thread.participant.id === selectedThreadUserId ? ' message-chat-thread-active' : ''}`}
                      key={thread.participant.id}
                      onClick={() => openThread(thread.participant.id)}
                      type="button"
                    >
                      <div className="message-chat-thread-avatar">
                        {getInitials(thread.participant.name)}
                      </div>
                      <div className="message-chat-thread-copy">
                        <div className="message-chat-thread-top">
                          <strong>{thread.participant.name}</strong>
                          <span>{formatDateTime(thread.updatedAt)}</span>
                        </div>
                        <div className="message-chat-thread-bottom">
                          <span className="message-chat-thread-role">
                            {getParticipantSubtitle(thread.participant)}
                          </span>
                          <span className="message-chat-thread-preview">
                            {thread.messages.at(-1)?.message ?? 'Start chatting'}
                          </span>
                        </div>
                      </div>
                      {thread.unreadCount ? (
                        <span className="message-chat-thread-unread">
                          {thread.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No chats yet"
                    description="Click new chat and choose a person to start."
                  />
                )}
              </div>
            ) : null}
          </aside>
        ) : null}

        {shouldShowChatPanel ? (
          <div className="message-chat-panel">
            {selectedRecipient ? (
              <>
                <div className="message-chat-header">
                  <div className="message-chat-header-main">
                    {isMobile ? (
                      <button
                        className="message-chat-back"
                        onClick={() => setMobileView('threads')}
                        type="button"
                      >
                        Back
                      </button>
                    ) : null}
                    <div className="message-chat-header-avatar">
                      {getInitials(selectedRecipient.name)}
                    </div>
                    <div className="message-chat-header-copy">
                      <h3>{selectedRecipient.name}</h3>
                      <p className="muted-text">
                        {getParticipantSubtitle(selectedRecipient)}
                        {selectedRecipient.email ? ` • ${selectedRecipient.email}` : ''}
                      </p>
                    </div>
                  </div>
                  {selectedThread?.messages.length ? (
                    <Button
                      disabled={deletingThread}
                      onClick={() => void handleDeleteThread()}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {deletingThread ? 'Deleting...' : 'Delete chat'}
                    </Button>
                  ) : null}
                </div>

                <div className="message-chat-messages" ref={messageListRef}>
                  {selectedThread?.messages.length ? (
                    selectedThread.messages.map((item) => {
                      const sentByCurrentUser = item.sender.id === currentUserId;
                      const deliveryLabel = item.isRead ? 'Read' : 'Sent';

                      return (
                        <article
                          className={`message-bubble${sentByCurrentUser ? ' message-bubble-outgoing' : ' message-bubble-incoming'}`}
                          key={item.id}
                        >
                          <p className="message-bubble-copy">{item.message}</p>
                          <div className="message-bubble-actions">
                            <div className="message-bubble-meta">
                              <span>{formatChatTime(item.createdAt)}</span>
                              {sentByCurrentUser ? (
                                <span
                                  aria-label={deliveryLabel}
                                  className={`message-bubble-ticks${item.isRead ? ' message-bubble-ticks-read' : ''}`}
                                  title={deliveryLabel}
                                >
                                  {item.isRead ? '✓✓' : '✓'}
                                </span>
                              ) : null}
                            </div>
                            <Button
                              className="message-bubble-delete"
                              disabled={deletingMessageId === item.id}
                              onClick={() => void handleDeleteMessage(item.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              {deletingMessageId === item.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState
                      title="No messages yet"
                      description="Write the first message to start this chat."
                    />
                  )}
                </div>

                <form className="message-chat-composer" onSubmit={handleSendMessage}>
                  <Textarea
                    className="message-chat-composer-input"
                    placeholder={`Write a message to ${selectedRecipient.name}...`}
                    rows={2}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div className="form-actions">
                    <Button disabled={sending} type="submit">
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <EmptyState
                title="Select a chat"
                description="Open a recent conversation or click new chat."
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
