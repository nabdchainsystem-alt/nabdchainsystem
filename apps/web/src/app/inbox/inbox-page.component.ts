import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconsModule } from '@ng-icons/core';

type Presence = 'online' | 'offline' | 'away';
type MessageStatus = 'sent' | 'delivered' | 'read';
type ConversationFilter = 'all' | 'unread' | 'priority';

interface Participant {
  id: string;
  name: string;
  role: string;
  initials: string;
  presence: Presence;
}

interface Attachment {
  type: 'file' | 'image';
  name: string;
  size: string;
}

interface Message {
  id: string;
  authorId: string;
  body: string;
  sentAt: Date;
  status: MessageStatus;
  attachments?: Attachment[];
}

interface Conversation {
  id: string;
  title: string;
  unreadCount: number;
  priority: 'high' | 'normal' | 'low';
  isMuted?: boolean;
  isStarred?: boolean;
  participants: Participant[];
  messages: Message[];
  lastMessageAt: Date;
  tags: string[];
}

interface MessageGroup {
  label: string;
  messages: Message[];
}

@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconsModule],
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxPageComponent {
  readonly conversations = signal<Conversation[]>(createSeedConversations());
  readonly selectedConversationId = signal<string | null>(
    this.conversations()[0]?.id ?? null,
  );
  readonly filterQuery = signal('');
  readonly activeFilter = signal<ConversationFilter>('all');
  readonly composerDraft = signal('');
  readonly showDetailsPanel = signal(true);

  readonly unreadTotal = computed(() =>
    this.conversations().reduce(
      (total, conversation) => total + conversation.unreadCount,
      0,
    ),
  );

  readonly hasUnread = computed(() => this.unreadTotal() > 0);

  readonly filteredConversations = computed(() => {
    const query = this.filterQuery().trim().toLowerCase();
    const filter = this.activeFilter();

    return this.conversations()
      .filter((conversation) => {
        if (
          filter === 'unread' &&
          conversation.unreadCount === 0
        ) {
          return false;
        }
        if (
          filter === 'priority' &&
          conversation.priority !== 'high'
        ) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = [
          conversation.title,
          ...conversation.tags,
          ...conversation.participants.map((participant) => participant.name),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort(
        (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
      );
  });

  readonly activeConversation = computed(() => {
    const id = this.selectedConversationId();
    if (!id) {
      return undefined;
    }
    return this.conversations().find((conversation) => conversation.id === id);
  });

  readonly activeParticipants = computed(
    () => this.activeConversation()?.participants ?? [],
  );

  readonly messageGroups = computed<MessageGroup[]>(() => {
    const conversation = this.activeConversation();
    if (!conversation) {
      return [];
    }

    const groups = new Map<string, Message[]>();
    for (const message of conversation.messages) {
      const label = formatGroupLabel(message.sentAt);
      const bucket = groups.get(label);
      if (bucket) {
        bucket.push(message);
      } else {
        groups.set(label, [message]);
      }
    }

    return Array.from(groups.entries(), ([label, messages]) => ({
      label,
      messages,
    }));
  });

  readonly composerPlaceholder = computed(() => {
    const conversation = this.activeConversation();
    if (!conversation) {
      return 'Select a conversation to start messaging...';
    }

    const participantNames = conversation.participants
      .filter((participant) => participant.id !== 'me')
      .map((participant) => participant.name);
    const recipient =
      participantNames.length > 2
        ? `${participantNames[0]} and team`
        : participantNames.join(', ');
    return `Message ${recipient || 'the team'}...`;
  });

  constructor() {
    effect(
      () => {
        const conversations = this.filteredConversations();
        const selected = this.selectedConversationId();
        if (conversations.length === 0) {
          if (selected !== null) {
            this.selectedConversationId.set(null);
          }
          return;
        }
        const hasSelected = selected
          ? conversations.some((conversation) => conversation.id === selected)
          : false;
        const firstConversation = conversations[0];
        if (!firstConversation) {
          return;
        }
        if (!hasSelected) {
          this.selectedConversationId.set(firstConversation.id);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const active = this.activeConversation();
        if (!active) {
          return;
        }
        if (active.unreadCount > 0) {
          this.conversations.update((conversations) =>
            conversations.map((conversation) =>
              conversation.id === active.id
                ? {
                    ...conversation,
                    unreadCount: 0,
                  }
                : conversation,
            ),
          );
        }
      },
      { allowSignalWrites: true },
    );
  }

  toggleDetails() {
    this.showDetailsPanel.update((value) => !value);
  }

  setFilter(filter: ConversationFilter) {
    this.activeFilter.set(filter);
  }

  onQueryInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.handleQueryChange(target?.value ?? '');
  }

  handleQueryChange(value: string) {
    this.filterQuery.set(value);
  }

  clearQuery() {
    if (this.filterQuery()) {
      this.filterQuery.set('');
    }
  }

  selectConversation(id: string) {
    this.selectedConversationId.set(id);
  }

  toggleStar(conversation: Conversation) {
    this.conversations.update((conversations) =>
      conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              isStarred: !item.isStarred,
            }
          : item,
      ),
    );
  }

  toggleMute(conversation: Conversation) {
    this.conversations.update((conversations) =>
      conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              isMuted: !item.isMuted,
            }
          : item,
      ),
    );
  }

  sendMessage() {
    const draft = this.composerDraft().trim();
    const conversation = this.activeConversation();
    if (!draft || !conversation) {
      return;
    }

    const message: Message = {
      id: `msg-${Date.now()}`,
      authorId: 'me',
      body: draft,
      sentAt: new Date(),
      status: 'sent',
    };

    this.conversations.update((conversations) => {
      const next = conversations.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              messages: [...item.messages, message],
              lastMessageAt: message.sentAt,
            }
          : item,
      );
      next.sort(
        (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
      );
      return next;
    });
    this.composerDraft.set('');
  }

  handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  participantInitial(participant: Participant) {
    return participant.initials;
  }

  participantPresence(participant: Participant) {
    switch (participant.presence) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      default:
        return 'Offline';
    }
  }

  messageAlignment(message: Message) {
    return message.authorId === 'me' ? 'outgoing' : 'incoming';
  }

  lastMessage(conversation: Conversation) {
    if (conversation.messages.length === 0) {
      return undefined;
    }
    return conversation.messages[conversation.messages.length - 1];
  }

  relativeTime(date: Date) {
    return formatRelativeTime(date);
  }

  trackConversation(_index: number, conversation: Conversation) {
    return conversation.id;
  }

  trackMessageGroup(_index: number, group: MessageGroup) {
    return group.label;
  }

  trackMessage(_index: number, message: Message) {
    return message.id;
  }

  trackAttachment(_index: number, attachment: Attachment) {
    return `${attachment.name}-${attachment.size}`;
  }

  trackTag(_index: number, tag: string) {
    return tag;
  }

  trackParticipant(_index: number, participant: Participant) {
    return participant.id;
  }

  resolveAuthor(message: Message) {
    return (
      this.activeParticipants().find(
        (participant) => participant.id === message.authorId,
      ) ?? {
        id: 'unknown',
        name: 'Unknown',
        role: '',
        initials: '?',
        presence: 'offline' as Presence,
      }
    );
  }

  statusLabel(status: MessageStatus) {
    switch (status) {
      case 'read':
        return 'Read';
      case 'delivered':
        return 'Delivered';
      default:
        return 'Sent';
    }
  }

  conversationParticipants(conversation: Conversation) {
    return conversation.participants
      .filter((participant) => participant.id !== 'me')
      .map((participant) => participant.name)
      .join(', ');
  }

  priorityLabel(priority: Conversation['priority']) {
    switch (priority) {
      case 'high':
        return 'High priority';
      case 'low':
        return 'Low priority';
      default:
        return 'Normal priority';
    }
  }
}

function formatGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const msInDay = 24 * 60 * 60 * 1000;
  const diff = (today.getTime() - target.getTime()) / msInDay;

  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Yesterday';
  }
  if (diff < 7) {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
    });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const RELATIVE_TIME_FORMATTER =
  typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null;

function formatRelativeTime(date: Date): string {
  if (!RELATIVE_TIME_FORMATTER) {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  const diffMs = date.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) {
    return RELATIVE_TIME_FORMATTER.format(minutes, 'minute');
  }
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(hours) < 24) {
    return RELATIVE_TIME_FORMATTER.format(hours, 'hour');
  }
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (Math.abs(days) < 7) {
    return RELATIVE_TIME_FORMATTER.format(days, 'day');
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function createSeedConversations(): Conversation[] {
  const makeDate = (offsetHours: number) => {
    const now = new Date();
    now.setHours(now.getHours() - offsetHours);
    return now;
  };

  return [
    {
      id: 'conv-ops',
      title: 'Launch Readiness Sync',
      unreadCount: 3,
      priority: 'high',
      isMuted: false,
      isStarred: true,
      tags: ['Operations', 'Q3 Launch'],
      lastMessageAt: makeDate(1),
      participants: [
        {
          id: 'me',
          name: 'You',
          role: 'Operations Lead',
          initials: 'YA',
          presence: 'online',
        },
        {
          id: 'ava',
          name: 'Ava Brooks',
          role: 'Program Manager',
          initials: 'AB',
          presence: 'away',
        },
        {
          id: 'sam',
          name: 'Samir Patel',
          role: 'Support Lead',
          initials: 'SP',
          presence: 'online',
        },
        {
          id: 'lee',
          name: 'Lee Nguyen',
          role: 'Solutions Engineer',
          initials: 'LN',
          presence: 'offline',
        },
      ],
      messages: [
        {
          id: 'conv-ops-1',
          authorId: 'ava',
          body:
            'Morning team! Updated the launch checklist—support runbooks still missing final approvals.',
          sentAt: makeDate(6),
          status: 'delivered',
        },
        {
          id: 'conv-ops-2',
          authorId: 'sam',
          body:
            'Support coverage is locked. We’ll staff two agents in Sydney and one in Austin for the midnight window.',
          sentAt: makeDate(5),
          status: 'delivered',
        },
        {
          id: 'conv-ops-3',
          authorId: 'me',
          body:
            'Perfect. Lee—can you confirm the integration webhooks are still green after yesterday’s patch?',
          sentAt: makeDate(4),
          status: 'read',
        },
        {
          id: 'conv-ops-4',
          authorId: 'lee',
          body:
            'Just reran the suite: all eight endpoints reporting 200 responses and latency <120ms.',
          sentAt: makeDate(3),
          status: 'read',
        },
        {
          id: 'conv-ops-5',
          authorId: 'ava',
          body:
            '@You can you capture the go/no-go criteria in the launch doc so we can circulate by end of day?',
          sentAt: makeDate(2),
          status: 'delivered',
        },
        {
          id: 'conv-ops-6',
          authorId: 'sam',
          body:
            'Also added the escalation matrix as a downloadable PDF in case execs need the quick reference tonight.',
          sentAt: makeDate(1),
          status: 'delivered',
          attachments: [
            {
              type: 'file',
              name: 'Launch Escalation Matrix.pdf',
              size: '184 KB',
            },
          ],
        },
      ],
    },
    {
      id: 'conv-cs',
      title: 'Customer Success • EdgeWave',
      unreadCount: 0,
      priority: 'normal',
      isMuted: false,
      isStarred: false,
      tags: ['Account'],
      lastMessageAt: makeDate(10),
      participants: [
        {
          id: 'me',
          name: 'You',
          role: 'Customer Partner',
          initials: 'YA',
          presence: 'online',
        },
        {
          id: 'mina',
          name: 'Mina Hart',
          role: 'Head of Product Ops',
          initials: 'MH',
          presence: 'online',
        },
        {
          id: 'ty',
          name: 'Ty Kim',
          role: 'Implementation Specialist',
          initials: 'TK',
          presence: 'offline',
        },
      ],
      messages: [
        {
          id: 'conv-cs-1',
          authorId: 'mina',
          body:
            'Thanks for the enablement deck. Could we get a lightweight checklist for the first 72 hours post-launch?',
          sentAt: makeDate(14),
          status: 'read',
        },
        {
          id: 'conv-cs-2',
          authorId: 'me',
          body:
            'Absolutely. Drafting it now and will share a pre-populated ClickUp doc so your team can localize.',
          sentAt: makeDate(13),
          status: 'read',
        },
        {
          id: 'conv-cs-3',
          authorId: 'ty',
          body:
            'Sharing the onboarding funnel metrics from their sandbox run—conversion to activation looks healthy.',
          sentAt: makeDate(12),
          status: 'read',
          attachments: [
            {
              type: 'file',
              name: 'EdgeWave Trial Metrics.xlsx',
              size: '92 KB',
            },
          ],
        },
        {
          id: 'conv-cs-4',
          authorId: 'mina',
          body:
            'This is perfect. We’ll review in our morning standup and confirm if the playbook covers regional nuances.',
          sentAt: makeDate(11),
          status: 'read',
        },
      ],
    },
    {
      id: 'conv-design',
      title: 'Design QA • Mobile',
      unreadCount: 0,
      priority: 'low',
      isMuted: true,
      isStarred: false,
      tags: ['Design Review'],
      lastMessageAt: makeDate(20),
      participants: [
        {
          id: 'me',
          name: 'You',
          role: 'Ops',
          initials: 'YA',
          presence: 'online',
        },
        {
          id: 'jules',
          name: 'Jules Carter',
          role: 'Design Lead',
          initials: 'JC',
          presence: 'online',
        },
        {
          id: 'ira',
          name: 'Ira Lopez',
          role: 'QA Analyst',
          initials: 'IL',
          presence: 'offline',
        },
        {
          id: 'dax',
          name: 'Dax Rivera',
          role: 'Mobile Engineer',
          initials: 'DR',
          presence: 'offline',
        },
      ],
      messages: [
        {
          id: 'conv-design-1',
          authorId: 'jules',
          body:
            'Dropping the Figma handoff for the mobile scheduling card. Page spacing updated per accessibility review.',
          sentAt: makeDate(30),
          status: 'read',
          attachments: [
            {
              type: 'file',
              name: 'Schedule Card v3.fig',
              size: '5.3 MB',
            },
          ],
        },
        {
          id: 'conv-design-2',
          authorId: 'ira',
          body:
            'Ticket QA-1445 ready for retest—fixed the misaligned CTA on iOS 15 and above.',
          sentAt: makeDate(26),
          status: 'read',
        },
        {
          id: 'conv-design-3',
          authorId: 'dax',
          body:
            'Heads up: animation easing is still using the legacy token, swapping to `ease-expressive` tomorrow.',
          sentAt: makeDate(24),
          status: 'read',
        },
      ],
    },
    {
      id: 'conv-ai',
      title: 'Assistant Training',
      unreadCount: 1,
      priority: 'normal',
      isMuted: false,
      isStarred: true,
      tags: ['AI', 'Automation'],
      lastMessageAt: makeDate(8),
      participants: [
        {
          id: 'me',
          name: 'You',
          role: 'Workflow Ops',
          initials: 'YA',
          presence: 'online',
        },
        {
          id: 'hani',
          name: 'Hani Blake',
          role: 'AI Trainer',
          initials: 'HB',
          presence: 'online',
        },
        {
          id: 'vera',
          name: 'Vera Stone',
          role: 'Product Analyst',
          initials: 'VS',
          presence: 'away',
        },
      ],
      messages: [
        {
          id: 'conv-ai-1',
          authorId: 'hani',
          body:
            'Uploaded fresh transcripts from the billing queue. We still have hallucinations on expected tax fields.',
          sentAt: makeDate(16),
          status: 'read',
        },
        {
          id: 'conv-ai-2',
          authorId: 'vera',
          body:
            'Telemetry flagged 6 low-confidence intents overnight. Sharing the JSON bundle in case you want to review.',
          sentAt: makeDate(15),
          status: 'read',
          attachments: [
            {
              type: 'file',
              name: 'low-confidence-intents.json',
              size: '38 KB',
            },
          ],
        },
        {
          id: 'conv-ai-3',
          authorId: 'me',
          body:
            'Looped in our policy update from yesterday so the tonality is handled. Will do another labeling pass tonight.',
          sentAt: makeDate(12),
          status: 'read',
        },
        {
          id: 'conv-ai-4',
          authorId: 'hani',
          body:
            'Great—added a reminder in ClickUp to review hand-off intents. Ping me if you want the assistant transcript export.',
          sentAt: makeDate(10),
          status: 'delivered',
        },
        {
          id: 'conv-ai-5',
          authorId: 'vera',
          body:
            'Quick note: finance needs the automation impact summary before the QBR. Can we draft bullet points tomorrow?',
          sentAt: makeDate(8),
          status: 'delivered',
        },
      ],
    },
  ];
}
