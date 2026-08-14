import SwiftUI

// EXPLORE — the open internet's supply, natively: the same discover lane the
// web feed serves (/api/feed/paginated?source=discover), with search over
// people and posts (/api/search). Guests browse, acting asks for an account —
// but the native app is always signed in by the time it's here.
struct ExploreView: View {
    @State private var posts: [FeedPost] = []
    @State private var query = ""
    @State private var results: SearchResults?
    @State private var loading = true
    @State private var loadError: String?
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if !query.isEmpty, let results {
                    searchList(results)
                } else if loading && posts.isEmpty {
                    MeshTheme.paper0.ignoresSafeArea()
                } else if let loadError, posts.isEmpty {
                    ContentUnavailableView("Explore couldn't load", systemImage: "safari", description: Text(loadError))
                } else {
                    discoverGrid
                }
            }
            .background(MeshTheme.paper0)
            .navigationTitle("Explore")
            .searchable(text: $query, prompt: "Search people and posts")
            .onChange(of: query) { _, newValue in
                searchTask?.cancel()
                guard !newValue.trimmingCharacters(in: .whitespaces).isEmpty else {
                    results = nil
                    return
                }
                searchTask = Task {
                    // Debounce a keystroke's worth — the backend rate-limits
                    // searches and a request per letter is rude to it.
                    try? await Task.sleep(for: .milliseconds(350))
                    guard !Task.isCancelled else { return }
                    await search(newValue)
                }
            }
        }
        .task { await load() }
    }

    private var discoverGrid: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 10)], spacing: 10) {
                ForEach(posts) { post in
                    ExploreCard(post: post)
                }
            }
            .padding(12)
        }
        .refreshable { await load() }
    }

    private func searchList(_ results: SearchResults) -> some View {
        List {
            if !results.users.isEmpty {
                Section("People") {
                    ForEach(results.users, id: \.username) { user in
                        HStack(spacing: 12) {
                            MeshAvatar(url: user.avatarUrl, name: user.displayName ?? user.username ?? "", size: 38)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(user.displayName ?? user.username ?? "")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(MeshTheme.ink1)
                                if let username = user.username {
                                    Text("@\(username)")
                                        .font(.caption)
                                        .foregroundStyle(MeshTheme.ink3)
                                }
                            }
                        }
                        .listRowBackground(MeshTheme.paper1)
                    }
                }
            }
            if !results.posts.isEmpty {
                Section("Posts") {
                    ForEach(results.posts) { post in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(post.authorName)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeshTheme.ink2)
                            Text(post.content)
                                .font(.subheadline)
                                .foregroundStyle(MeshTheme.ink1)
                                .lineLimit(3)
                        }
                        .listRowBackground(MeshTheme.paper1)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func load() async {
        do {
            // src/app/api/feed/paginated/route.ts GET — the discover lane.
            let page: FeedPage = try await MeshAPI.shared.get(
                "/api/feed/paginated",
                query: [
                    URLQueryItem(name: "page", value: "1"),
                    URLQueryItem(name: "limit", value: "40"),
                    URLQueryItem(name: "source", value: "discover"),
                    URLQueryItem(name: "content", value: "all"),
                ]
            )
            posts = page.posts
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            loadError = "Check your connection."
        }
        loading = false
    }

    private func search(_ text: String) async {
        // src/app/api/search/route.ts GET ?q=
        let found: SearchResults? = try? await MeshAPI.shared.get(
            "/api/search",
            query: [URLQueryItem(name: "q", value: text)]
        )
        if !Task.isCancelled { results = found }
    }
}

// src/app/api/search/route.ts GET — the app renders users + posts today;
// the other arrays are declared so decoding stays honest about the payload.
struct SearchResults: Decodable {
    struct FoundUser: Decodable {
        let username: String?
        let displayName: String?
        let avatarUrl: String?
    }
    let users: [FoundUser]
    let posts: [FeedPost]
}

private struct ExploreCard: View {
    let post: FeedPost

    private var imageURL: URL? {
        let candidate = post.media.first(where: { $0.type.lowercased() == "image" })?.url
            ?? post.media.first?.posterUrl
        return candidate.flatMap(URL.init(string:))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    (phase.image ?? Image(systemName: "photo"))
                        .resizable()
                        .scaledToFill()
                }
                .frame(height: 150)
                .clipped()
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(post.authorName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MeshTheme.ink2)
                    .lineLimit(1)
                if !post.content.isEmpty {
                    Text(post.content)
                        .font(.footnote)
                        .foregroundStyle(MeshTheme.ink1)
                        .lineLimit(imageURL == nil ? 5 : 2)
                }
            }
            .padding(10)
        }
        .background(MeshTheme.paper1)
        .clipShape(RoundedRectangle(cornerRadius: MeshTheme.radiusLG))
        .overlay(
            RoundedRectangle(cornerRadius: MeshTheme.radiusLG)
                .strokeBorder(MeshTheme.rule, lineWidth: 0.5)
        )
    }
}
