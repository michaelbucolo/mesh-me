import SwiftUI

// mesh.me, natively. One product, one backend, one palette — this target
// renders the surfaces in SwiftUI instead of a WKWebView (that wrapper lives
// in ios/App and stays for what it does; this app is the real thing).
@main
struct MeshMeApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                switch session.state {
                case .checking:
                    // The calm the sign-in screen promises starts at launch:
                    // a quiet mat, no spinner theater.
                    MeshTheme.paper0.ignoresSafeArea()
                case .signedOut:
                    LoginView()
                case .signedIn:
                    RootView()
                }
            }
            .environmentObject(session)
            .tint(MeshTheme.accent)
            .task { await session.restore() }
        }
    }
}
