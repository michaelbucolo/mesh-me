import Foundation
import SwiftUI

// One session, owned in one place. The cookie itself lives in
// HTTPCookieStorage (URLSession maintains __Host-mesh_session exactly like a
// browser would); this store owns the QUESTION — who is signed in — and asks
// the backend rather than caching an answer that could go stale.

@MainActor
final class SessionStore: ObservableObject {
    enum State {
        case checking
        case signedOut
        case signedIn(MeshUser)
    }

    @Published private(set) var state: State = .checking

    var currentUser: MeshUser? {
        if case .signedIn(let user) = state { return user }
        return nil
    }

    /// Cold-start restore: the cookie either still names a live session or it
    /// does not — the backend is the only honest source of that answer.
    func restore() async {
        do {
            let user = try await MeshAPI.shared.currentUser()
            state = .signedIn(user)
        } catch {
            state = .signedOut
        }
    }

    /// Rides the backend's one sign-in definition (durable rate limits,
    /// lockouts, enumeration-proof errors — /api/auth/native-session).
    /// Returns a user-facing error message, or nil on success.
    func signIn(identifier: String, password: String) async -> String? {
        do {
            try await MeshAPI.shared.signIn(identifier: identifier, password: password)
            let user = try await MeshAPI.shared.currentUser()
            state = .signedIn(user)
            return nil
        } catch let MeshAPIError.server(message, _) {
            return message
        } catch {
            return "Could not reach mesh.me. Check your connection."
        }
    }

    func signOut() async {
        // Best-effort server-side destroy; locally the session ends either way.
        try? await MeshAPI.shared.signOut()
        state = .signedOut
    }
}
