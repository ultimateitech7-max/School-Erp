'use client';

import { MessageChatWorkspace } from '@/components/messages/chat-workspace';

export default function InboxPage() {
  return (
    <div className="dashboard-stack">
      <MessageChatWorkspace
        description="Chat with anyone in the active school scope, review threads, and manage message history."
        title="School Chat"
      />
    </div>
  );
}
