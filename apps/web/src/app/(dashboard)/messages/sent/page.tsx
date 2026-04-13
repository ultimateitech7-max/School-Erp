'use client';

import { MessageChatWorkspace } from '@/components/messages/chat-workspace';

export default function SentMessagesPage() {
  return (
    <div className="dashboard-stack">
      <MessageChatWorkspace
        description="All sent and received chats now live in one shared thread workspace."
        title="School Chat"
      />
    </div>
  );
}
