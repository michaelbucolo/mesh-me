import Foundation

// Wire models, mirroring the backend's serializers field-for-field — the
// route file each shape came from is cited above it. Fields the app does not
// render yet are still declared when cheap, so decoding stays honest about
// what the API actually says. Everything optional-where-the-server-can-omit:
// a missing minor field must never take down a whole screen.

// src/app/api/auth/native-session/route.ts safeUser()
struct MeshUser: Decodable, Identifiable, Equatable {
    let id: String
    let username: String
    let displayName: String
    let avatarUrl: String?
    let isVerified: Bool
    let onboarded: Bool
}

// ── MeChat ──────────────────────────────────────────────────────────────

// src/app/api/messages/route.ts GET → { threads, currentUserId }
struct ThreadListResponse: Decodable {
    let threads: [ChatThread]
    let currentUserId: String
}

struct ChatThread: Decodable, Identifiable {
    struct Peer: Decodable {
        let id: String?
        let username: String?
        let displayName: String?
        let avatarUrl: String?
    }
    struct LastMessage: Decodable {
        let content: String
        let senderId: String
        let createdAt: String
    }

    let id: String
    let title: String?
    let threadType: String?
    let memberCount: Int?
    let isEncrypted: Bool?
    let otherUser: Peer?
    let otherUsers: [Peer]?
    let lastMessage: LastMessage?
    let platform: String?
    let unread: Int?

    /// Never invented: a thread with no title is called what it is — the
    /// same rule the inbox holds (src/lib/inbox/read-inbox.ts).
    var displayName: String {
        if let title, !title.trimmingCharacters(in: .whitespaces).isEmpty { return title }
        return otherUser?.displayName ?? otherUser?.username ?? "Direct message"
    }
}

// src/app/api/messages/[threadId]/route.ts GET → { thread, messages }
struct ThreadResponse: Decodable {
    struct ThreadDetail: Decodable {
        struct Member: Decodable {
            struct MemberUser: Decodable {
                let id: String?
                let username: String?
                let displayName: String?
                let avatarUrl: String?
            }
            let userId: String
            let role: String?
            let notificationsMuted: Bool?
            let lastRead: String?
            let user: MemberUser?
        }
        let id: String
        let title: String?
        let threadType: String?
        let isEncrypted: Bool?
        let sourcePlatform: String?
        let isExternal: Bool?
        let members: [Member]
    }
    let thread: ThreadDetail
    let messages: [ChatMessage]
}

// serializeMessage in src/app/api/messages/[threadId]/route.ts
struct ChatMessage: Decodable, Identifiable {
    struct Sender: Decodable {
        let id: String?
        let username: String?
        let displayName: String?
        let avatarUrl: String?
    }
    struct ReplyTo: Decodable {
        let id: String
        let content: String
        let senderName: String
    }

    let id: String
    let content: String
    let senderId: String
    let threadId: String?
    let sourcePlatform: String?
    let messageType: String?
    let sourceUrl: String?
    let createdAt: Date
    let sender: Sender?
    let replyTo: ReplyTo?
}

// ── Flow / posts ────────────────────────────────────────────────────────

// src/app/api/flow/route.ts GET → { posts, hasMore, recycled }
struct FlowResponse: Decodable {
    let posts: [FeedPost]
    let hasMore: Bool
}

// src/app/api/feed/paginated/route.ts GET → { posts, hasMore, page, nextPage }
struct FeedPage: Decodable {
    let posts: [FeedPost]
    let hasMore: Bool
    let nextPage: Int?
}

// The FeedCardPost shape (src/lib/feed-data.ts) as JSON-serialized.
struct FeedPost: Decodable, Identifiable {
    struct Author: Decodable {
        let id: String
        let username: String
        let displayName: String
        let avatarUrl: String?
        let isVerified: Bool?
    }
    struct Media: Decodable {
        let id: String
        let url: String
        let type: String
        let posterUrl: String?
    }
    struct Counts: Decodable {
        let comments: Int
        let reactions: Int
        let reposts: Int
    }
    struct ExternalAuthor: Decodable {
        let name: String
        let username: String?
        let avatarUrl: String?
        let profileUrl: String?
    }

    let id: String
    let content: String
    let createdAt: String
    let author: Author
    let media: [Media]
    let _count: Counts
    let platform: String?
    let sourceId: String?
    let externalUrl: String?
    let postType: String?
    let externalAuthor: ExternalAuthor?
    let whyThis: String?
    let isNew: Bool?

    var isNative: Bool { (platform ?? "meshme").lowercased() == "meshme" }
    var authorName: String { externalAuthor?.name ?? author.displayName }
}

// ── Badges (src/app/api/layout/unread-counts/route.ts) ──────────────────
struct UnreadCounts: Decodable {
    let unreadNotifications: Int
    let unreadMessages: Int
    /// The gated wants-you judgement — obligations only, shared with the web
    /// nav badge and the Return Brief. One definition of owed.
    let needsYou: Int
}
