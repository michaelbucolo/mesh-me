import SwiftUI
import AVKit

// THE FLOW — the ranked stream, natively. Full-bleed vertical pager, one
// item per page, the same /api/flow ranking the web consumes (one algorithm
// across the platform). Videos with a direct media URL play inline; embed-only
// items (YouTube/TikTok pages) show their poster with an Open door — honest
// about what a native player can and cannot decode, until a later slice
// brings per-platform embed players.
struct FlowView: View {
    @State private var posts: [FeedPost] = []
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        GeometryReader { geo in
            Group {
                if loading && posts.isEmpty {
                    MeshTheme.paper0.ignoresSafeArea()
                } else if let loadError, posts.isEmpty {
                    ContentUnavailableView("The Flow couldn't load", systemImage: "play.slash", description: Text(loadError))
                } else {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 0) {
                            ForEach(posts) { post in
                                FlowCard(post: post)
                                    .frame(width: geo.size.width, height: geo.size.height)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)
                    .ignoresSafeArea(edges: .bottom)
                }
            }
        }
        .background(Color.black)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            // src/app/api/flow/route.ts GET → { posts, hasMore }
            let response: FlowResponse = try await MeshAPI.shared.get("/api/flow")
            posts = response.posts
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            loadError = "Check your connection."
        }
        loading = false
    }
}

private struct FlowCard: View {
    let post: FeedPost

    private var directVideoURL: URL? {
        guard let media = post.media.first(where: { $0.type.lowercased() == "video" }) else { return nil }
        guard let url = URL(string: media.url), let scheme = url.scheme, scheme.hasPrefix("http") else { return nil }
        // AVPlayer decodes files/streams, not web pages.
        let path = url.path.lowercased()
        let playable = [".mp4", ".mov", ".m4v", ".m3u8"].contains { path.hasSuffix($0) }
        return playable ? url : nil
    }

    private var posterURL: URL? {
        let poster = post.media.first?.posterUrl ?? post.media.first(where: { $0.type.lowercased() == "image" })?.url
        return poster.flatMap(URL.init(string:))
    }

    var body: some View {
        ZStack {
            if let videoURL = directVideoURL {
                InlinePlayer(url: videoURL)
            } else if let posterURL {
                AsyncImage(url: posterURL) { phase in
                    (phase.image ?? Image(systemName: "photo"))
                        .resizable()
                        .scaledToFill()
                }
                .clipped()
            } else {
                MeshTheme.paper1
            }

            LinearGradient(
                colors: [.clear, .clear, .black.opacity(0.72)],
                startPoint: .top, endPoint: .bottom
            )
            .allowsHitTesting(false)

            VStack {
                Spacer()
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            MeshAvatar(url: post.externalAuthor?.avatarUrl ?? post.author.avatarUrl, name: post.authorName, size: 30)
                            Text(post.authorName)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                            if let platform = post.platform, !post.isNative {
                                Text(platform.capitalized)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.white.opacity(0.85))
                            }
                        }
                        if !post.content.isEmpty {
                            Text(post.content)
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.92))
                                .lineLimit(2)
                        }
                        if let external = post.externalUrl, directVideoURL == nil, let url = URL(string: external) {
                            Link(destination: url) {
                                Label("Watch on \(post.platform?.capitalized ?? "the source")", systemImage: "arrow.up.right")
                                    .font(.caption.weight(.semibold))
                            }
                            .foregroundStyle(.white)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(16)
                .padding(.bottom, 8)
            }
        }
        .clipped()
    }
}

private struct InlinePlayer: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                let p = AVPlayer(url: url)
                p.isMuted = false
                p.play()
                player = p
            }
            .onDisappear {
                player?.pause()
                player = nil
            }
    }
}
