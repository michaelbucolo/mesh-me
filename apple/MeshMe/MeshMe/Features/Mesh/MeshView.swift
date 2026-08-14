import SwiftUI

// THE MESH TAB — what, across everything, actually wants you right now.
//
// The web mesh is a canvas scene; the native slice-1 renders the scene's
// HEART instead of imitating its body: the cross-platform triage no platform
// can offer (src/lib/mesh/wants-you.ts — "Instagram cannot tell you a
// Twitter DM is unanswered"). Owed things first, everything else after,
// muted never counted. The canvas comes in a later slice; the answer to
// "why open mesh.me" is already here.
struct MeshView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var entries: [InboxEntry] = []
    @State private var needsYou = 0
    @State private var loading = true
    @State private var loadError: String?

    private var owed: [InboxEntry] { entries.filter { $0.awaitingYou == true } }
    private var rest: [InboxEntry] { entries.filter { $0.awaitingYou != true } }

    var body: some View {
        NavigationStack {
            Group {
                if loading && entries.isEmpty {
                    MeshTheme.paper0.ignoresSafeArea()
                } else if let loadError, entries.isEmpty {
                    ContentUnavailableView("The Mesh couldn't load", systemImage: "circle.hexagongrid", description: Text(loadError))
                } else {
                    List {
                        Section {
                            if owed.isEmpty {
                                // The finite state, stated plainly — never a
                                // cheery card, never a manufactured number.
                                Text("Nothing needs you right now.")
                                    .font(.subheadline)
                                    .foregroundStyle(MeshTheme.ink3)
                                    .listRowBackground(MeshTheme.paper1)
                            } else {
                                ForEach(owed) { entry in
                                    InboxRowView(entry: entry, owed: true)
                                        .listRowBackground(MeshTheme.paper1)
                                }
                            }
                        } header: {
                            Text(owed.isEmpty ? "Needs you" : "Needs you · \(owed.count)")
                                .foregroundStyle(MeshTheme.ink2)
                        }

                        Section {
                            ForEach(rest.prefix(60)) { entry in
                                InboxRowView(entry: entry, owed: false)
                                    .listRowBackground(MeshTheme.paper1)
                            }
                        } header: {
                            Text("Everything else")
                                .foregroundStyle(MeshTheme.ink2)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .refreshable { await load() }
                }
            }
            .background(MeshTheme.paper0)
            .navigationTitle("Mesh")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let user = session.currentUser {
                            Text("@\(user.username)")
                        }
                        Button("Sign out", role: .destructive) {
                            Task { await session.signOut() }
                        }
                    } label: {
                        MeshAvatar(url: session.currentUser?.avatarUrl, name: session.currentUser?.displayName ?? "Me", size: 30)
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            // src/app/api/inbox/route.ts GET — readInbox as JSON: the one
            // owed judgement, never re-derived on this side.
            let inbox: InboxRead = try await MeshAPI.shared.get("/api/inbox")
            entries = inbox.entries
            needsYou = inbox.counts.needsYou
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            loadError = "Check your connection."
        }
        loading = false
    }
}

// src/lib/inbox/read-inbox.ts InboxRead / InboxEntry, serialized by
// src/app/api/inbox/route.ts.
struct InboxRead: Decodable {
    struct Counts: Decodable {
        let needsYou: Int
        let all: Int
        let messages: Int
    }
    let entries: [InboxEntry]
    let counts: Counts
    let platforms: [String]
    let nowMs: Double
}

struct InboxEntry: Decodable, Identifiable {
    struct Who: Decodable {
        let name: String?
        let avatarUrl: String?
    }
    let id: String
    let kind: String
    let platform: String
    let who: Who?
    let title: String
    let preview: String?
    let atMs: Double
    let unread: Bool?
    let awaitingYou: Bool?
    let href: String
}

private struct InboxRowView: View {
    let entry: InboxEntry
    let owed: Bool

    var body: some View {
        HStack(spacing: 12) {
            MeshAvatar(url: entry.who?.avatarUrl, name: entry.who?.name ?? entry.title, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(entry.title)
                        .font(.subheadline.weight(owed || entry.unread == true ? .semibold : .regular))
                        .foregroundStyle(MeshTheme.ink1)
                        .lineLimit(1)
                    if entry.platform != "mesh" {
                        Text(entry.platform.capitalized)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeshTheme.ink3)
                    }
                }
                if let preview = entry.preview, !preview.isEmpty {
                    Text(preview)
                        .font(.footnote)
                        .foregroundStyle(MeshTheme.ink3)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if owed {
                Circle()
                    .fill(MeshTheme.accent)
                    .frame(width: 8, height: 8)
                    .accessibilityLabel("Waiting on you")
            }
            Text(Date(timeIntervalSince1970: entry.atMs / 1000), style: .relative)
                .font(.caption2)
                .foregroundStyle(MeshTheme.ink3)
        }
        .padding(.vertical, 2)
    }
}
