import SwiftUI

// One conversation. The read fetches the latest window and bumps lastRead
// (the endpoint does that server-side on GET); send is a plain POST that the
// backend fans out — muted members' notifications stay silenced by the
// server, never re-decided here.
struct MeChatThreadView: View {
    let threadId: String
    let currentUserId: String

    @State private var thread: ThreadResponse.ThreadDetail?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var sending = false
    @State private var loadError: String?
    @State private var pollTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            MessageBubble(message: message, isMine: message.senderId == currentUserId)
                                .id(message.id)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                }
                .background(MeshTheme.paper0)
                .onChange(of: messages.last?.id) { _, lastId in
                    if let lastId { withAnimation(MeshTheme.easeOut) { proxy.scrollTo(lastId, anchor: .bottom) } }
                }
            }

            if let loadError {
                Text(loadError)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.vertical, 4)
            }

            composer
        }
        .navigationTitle(thread.map(title(for:)) ?? "MeChat")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await load()
            // The web thread polls every few seconds; the native thread does
            // the same, merging by id so nothing paged-in is ever wiped.
            pollTask = Task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(5))
                    await load()
                }
            }
        }
        .onDisappear { pollTask?.cancel() }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(MeshTheme.paper2, in: RoundedRectangle(cornerRadius: MeshTheme.radiusSM))
                .foregroundStyle(MeshTheme.ink1)

            Button(action: send) {
                Image(systemName: "arrow.up")
                    .fontWeight(.bold)
                    .frame(width: 38, height: 38)
                    .background(MeshTheme.accent, in: Circle())
                    .foregroundStyle(.white)
            }
            .buttonStyle(MeshPressStyle())
            .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(MeshTheme.paper1)
    }

    private func title(for thread: ThreadResponse.ThreadDetail) -> String {
        if let title = thread.title, !title.isEmpty { return title }
        let other = thread.members.first { $0.userId != currentUserId }
        return other?.user?.displayName ?? other?.user?.username ?? "Direct message"
    }

    private func load() async {
        do {
            // src/app/api/messages/[threadId]/route.ts GET (latest window;
            // bumps the caller's lastRead server-side).
            let response: ThreadResponse = try await MeshAPI.shared.get("/api/messages/\(threadId)")
            thread = response.thread
            // Poll-merge by id, never replace-and-lose (the MeChat law).
            var byId = Dictionary(uniqueKeysWithValues: messages.map { ($0.id, $0) })
            for message in response.messages { byId[message.id] = message }
            messages = byId.values.sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            if messages.isEmpty { loadError = "Check your connection." }
        }
    }

    private func send() {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, !sending else { return }
        sending = true
        draft = ""
        Task {
            struct Body: Encodable { let content: String }
            // 201 { message } — src/app/api/messages/[threadId]/route.ts POST
            struct Sent: Decodable { let message: ChatMessage? }
            do {
                let _: Sent = try await MeshAPI.shared.post("/api/messages/\(threadId)", body: Body(content: content))
                await load()
            } catch {
                // The draft is the user's words — never eaten by a failure.
                draft = content
                loadError = "Couldn't send. Try again."
            }
            sending = false
        }
    }
}

private struct MessageBubble: View {
    let message: ChatMessage
    let isMine: Bool

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 48) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                if let reply = message.replyTo {
                    Text("\(reply.senderName): \(reply.content)")
                        .font(.caption2)
                        .foregroundStyle(MeshTheme.ink3)
                        .lineLimit(1)
                }
                Text(message.content)
                    .font(.subheadline)
                    .foregroundStyle(isMine ? .white : MeshTheme.ink1)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 9)
                    .background(
                        isMine ? MeshTheme.accent : MeshTheme.paper1,
                        in: RoundedRectangle(cornerRadius: MeshTheme.radiusLG)
                    )
                Text(message.createdAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundStyle(MeshTheme.ink3)
            }
            if !isMine { Spacer(minLength: 48) }
        }
    }
}
