import Foundation

// ONE CLIENT, ONE BACKEND.
//
// Every request the native app makes goes through here — the same JSON API
// the website consumes, at the same host. Contracts this file encodes were
// source-verified against the backend (see the route files cited on each
// call); scripts/swift-app-check.ts asserts every path string here exists as
// a real route under src/app/api/, so a renamed route fails CI before it can
// fail a user.
//
// ── AUTH MODEL ──────────────────────────────────────────────────────────────
// The session is the website's own __Host-mesh_session cookie
// (src/lib/auth.ts — httpOnly, secure, 30 days). URLSession's cookie storage
// carries it exactly as a browser would. Writes additionally send an explicit
// `Origin` header naming our own host: the backend's isSameOriginRequest
// (src/lib/request-guard.ts) demands positive same-origin proof and fails
// closed on headerless requests. A first-party app STATING its first party is
// the honest native equivalent of the browser's forbidden headers — and a
// cross-site page can never do it.
//
// ── HOST ────────────────────────────────────────────────────────────────────
// www.meshs.me, matching getSiteUrl()'s canonical fallback (src/lib/brand.ts).
// The guard compares Origin host to request Host as strings — apex and www
// are different hosts to it, so the app speaks ONE of them everywhere.

enum MeshAPIError: Error {
    /// The backend answered with an error body ({"error": "..."}).
    case server(String, Int)
    case decoding
}

private struct ServerErrorBody: Decodable { let error: String }
private struct EmptyBody: Decodable {}

final class MeshAPI {
    static let shared = MeshAPI()

    let base = URL(string: "https://www.meshs.me")!

    let urlSession: URLSession
    private let decoder: JSONDecoder

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config)

        let d = JSONDecoder()
        // Prisma DateTimes arrive as ISO-8601 strings with fractional seconds.
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoPlain = ISO8601DateFormatter()
        d.dateDecodingStrategy = .custom { dec in
            let value = try dec.singleValueContainer().decode(String.self)
            if let date = iso.date(from: value) ?? isoPlain.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: dec.codingPath, debugDescription: "Unrecognized date: \(value)"))
        }
        decoder = d
    }

    // ── Session (src/app/api/auth/native-session/route.ts) ──────────────

    func currentUser() async throws -> MeshUser {
        struct Wrapper: Decodable { let user: MeshUser }
        let wrapper: Wrapper = try await get("/api/auth/native-session")
        return wrapper.user
    }

    func signIn(identifier: String, password: String) async throws {
        struct Body: Encodable { let identifier: String; let password: String }
        let _: EmptyBody = try await post("/api/auth/native-session", body: Body(identifier: identifier, password: password))
    }

    func signOut() async throws {
        // src/app/api/auth/logout/route.ts POST — same-origin guarded.
        let _: EmptyBody = try await post("/api/auth/logout", body: nil as String?)
    }

    // ── Core verbs ──────────────────────────────────────────────────────

    func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var components = URLComponents(url: base.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        return try await run(request)
    }

    func post<T: Decodable, Body: Encodable>(_ path: String, body: Body?) async throws -> T {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = "POST"
        // Positive same-origin proof — see the header comment.
        request.setValue(origin, forHTTPHeaderField: "Origin")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        return try await run(request)
    }

    func patch<T: Decodable, Body: Encodable>(_ path: String, body: Body) async throws -> T {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = "PATCH"
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await run(request)
    }

    private var origin: String {
        "https://\(base.host() ?? "www.meshs.me")"
    }

    private func run<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await urlSession.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? decoder.decode(ServerErrorBody.self, from: data))?.error
            throw MeshAPIError.server(message ?? "mesh.me returned \(status)", status)
        }
        if T.self == EmptyBody.self, let empty = EmptyBody() as? T { return empty }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw MeshAPIError.decoding
        }
    }
}
