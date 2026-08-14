import SwiftUI

// THE FIVE TABS ARE LAW.
//
// Mesh, MeChat, Flow, Explore, Analytics — exactly the five the owner set
// (src/components/layout/navigation-config.*, "one navigation, not two").
// Nothing gets added here without the same word that created them. Icons are
// SF Symbols chosen to mirror the web's lucide glyphs; never emoji — the
// no-emoji-in-chrome rule crosses platforms with the palette.
struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        TabView {
            MeshView()
                .tabItem { Label("Mesh", systemImage: "circle.hexagongrid") }
            MeChatListView()
                .tabItem { Label("MeChat", systemImage: "bubble.left.and.bubble.right") }
            FlowView()
                .tabItem { Label("Flow", systemImage: "play.rectangle.on.rectangle") }
            ExploreView()
                .tabItem { Label("Explore", systemImage: "safari") }
            AnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.bar.xaxis") }
        }
        .background(MeshTheme.paper0)
    }
}
