import SwiftUI

// MECHAT — one inbox for every platform's conversations, natively.
// The list shows REAL THINGS (faces, platform, last line — the inbox law
// from src/components/inbox/inbox-view.tsx), unread rows carry real weight,
// and muted never means hidden.
struct MeChatListView: View {
    @State private var threads: [ChatThread] = []
    @State private var currentUserId = ""
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && threads.isEmpty {
                    MeshTheme.paper0.ignoresSafeArea()
                } else if let loadError, threads.isEmpty {
                    ContentUnavailableView("MeChat couldn't load", systemImage: "bubble.left.and.exclamationmark.bubble.right", description: Text(loadError))
                } else if threads.isEmpty {
                    ContentUnavailableView("No conversations yet", systemImage: "bubble.left.and.bubble.right", description: Text("Messages from mesh.me and your connected platforms land here."))
                } else {
                    List(threads) { thread in
                        NavigationLink(value: thread.id) {
                            ThreadRow(thread: thread, currentUserId: currentUserId)
                        }
                        .listRowBackground(MeshTheme.paper1)
                    }
                    .listStyle(.plain)
                    .refreshable { await load() }
                }
            }
            .navigationTitle("MeChat")
            .navigationDestination(for: String.self) { threadId in
                MeChatThreadView(threadId: threadId, currentUserId: currentUserId)
            }
            .background(MeshTheme.paper0)
        }
        .task { await load() }
    }

    private func load() async {
        do {
            // src/app/api/messages/route.ts GET
            let response: ThreadListResponse = try await MeshAPI.shared.get("/api/messages")
            threads = response.threads
            currentUserId = response.currentUserId
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            loadError = "Check your connection."
        }
        loading = false
    }
}

private struct ThreadRow: View {
    let thread: ChatThread
    let currentUserId: String

    private var unread: Bool { (thread.unread ?? 0) > 0 }

    var body: some View {
        HStack(spacing: 12) {
            MeshAvatar(url: thread.otherUser?.avatarUrl, name: thread.displayName, size: 44)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(thread.displayName)
                        .font(.subheadline.weight(unread ? .bold : .semibold))
                        .foregroundStyle(MeshTheme.ink1)
                        .lineLimit(1)
                    if let platform = thread.platform, platform != "mesh" {
                        Text(platform.capitalized)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeshTheme.ink3)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(MeshTheme.paper2, in: Capsule())
                    }
                }
                if let last = thread.lastMessage {
                    Text(last.senderId == currentUserId ? "You: \(last.content)" : last.content)
                        .font(.footnote.weight(unread ? .medium : .regular))
                        .foregroundStyle(unread ? MeshTheme.ink2 : MeshTheme.ink3)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            if unread {
                Text("\(min(thread.unread ?? 0, 99))")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(MeshTheme.accent, in: Capsule())
            }
        }
        .padding(.vertical, 4)
    }
}
