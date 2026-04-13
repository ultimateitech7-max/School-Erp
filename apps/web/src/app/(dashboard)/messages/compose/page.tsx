'use client';

import { MessageChatWorkspace } from '@/components/messages/chat-workspace';

export default function ComposeMessagePage() {
  return (
    <div className="dashboard-stack">
      <MessageChatWorkspace
        description="Start a new school chat by choosing a role, selecting a person, and sending your message in one thread view."
        title="School Chat"
      />
    </div>
  );
}
