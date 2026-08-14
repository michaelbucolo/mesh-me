import SwiftUI
import Charts

// ANALYTICS — the dashboard's raw numbers, natively charted.
//
// /api/analytics/series is the FREE tier's own data as CSV (two sections:
// daily series, then per-platform comparison — src/app/api/analytics/series/
// route.ts). The app charts exactly what the account owns; the deeper Mesh
// Report stays a MeshPro document, and a consent-withheld 403 renders as the
// backend's own words, never softened.
struct AnalyticsView: View {
    @State private var daily: [DailyPoint] = []
    @State private var platforms: [PlatformRow] = []
    @State private var loading = true
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && daily.isEmpty {
                    MeshTheme.paper0.ignoresSafeArea()
                } else if let loadError, daily.isEmpty {
                    ContentUnavailableView("Analytics unavailable", systemImage: "chart.bar.xaxis", description: Text(loadError))
                } else {
                    List {
                        Section {
                            Chart(daily) { point in
                                LineMark(x: .value("Day", point.date), y: .value("Engagement", point.engagement))
                                    .foregroundStyle(MeshTheme.accent)
                                    .interpolationMethod(.monotone)
                                AreaMark(x: .value("Day", point.date), y: .value("Engagement", point.engagement))
                                    .foregroundStyle(MeshTheme.accent.opacity(0.14))
                                    .interpolationMethod(.monotone)
                            }
                            .frame(height: 180)
                            .listRowBackground(MeshTheme.paper1)
                        } header: {
                            Text("Engagement").foregroundStyle(MeshTheme.ink2)
                        }

                        Section {
                            Chart(daily) { point in
                                BarMark(x: .value("Day", point.date), y: .value("Posts", point.content))
                                    .foregroundStyle(MeshTheme.accent.opacity(0.8))
                            }
                            .frame(height: 140)
                            .listRowBackground(MeshTheme.paper1)
                        } header: {
                            Text("Content published").foregroundStyle(MeshTheme.ink2)
                        }

                        if !platforms.isEmpty {
                            Section {
                                ForEach(platforms) { row in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(row.platform.capitalized)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(MeshTheme.ink1)
                                            Text("\(row.followers) followers · \(row.posts) posts")
                                                .font(.caption)
                                                .foregroundStyle(MeshTheme.ink3)
                                        }
                                        Spacer()
                                        Text(row.engagementRate)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(MeshTheme.accent)
                                    }
                                    .listRowBackground(MeshTheme.paper1)
                                }
                            } header: {
                                Text("Platforms").foregroundStyle(MeshTheme.ink2)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .refreshable { await load() }
                }
            }
            .background(MeshTheme.paper0)
            .navigationTitle("Analytics")
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let csv: String = try await MeshAPI.shared.getText("/api/analytics/series")
            let sections = csv.components(separatedBy: "\n\n")
            daily = Self.parseDaily(sections.first ?? "")
            platforms = sections.count > 1 ? Self.parsePlatforms(sections[1]) : []
            loadError = nil
        } catch let MeshAPIError.server(message, _) {
            loadError = message
        } catch {
            loadError = "Check your connection."
        }
        loading = false
    }

    // date,engagement,follower_growth,content_published,activity
    static func parseDaily(_ csv: String) -> [DailyPoint] {
        csv.split(separator: "\n").dropFirst().compactMap { line in
            let cells = splitCSV(String(line))
            guard cells.count >= 5, let date = ISO8601DateFormatter.dateOnly.date(from: cells[0] + "T00:00:00Z") else { return nil }
            return DailyPoint(
                date: date,
                engagement: Double(cells[1]) ?? 0,
                followerGrowth: Double(cells[2]) ?? 0,
                content: Double(cells[3]) ?? 0,
                activity: Double(cells[4]) ?? 0
            )
        }
    }

    // platform,platform_username,followers,following,posts,...,engagement_rate,follower_growth
    static func parsePlatforms(_ csv: String) -> [PlatformRow] {
        csv.split(separator: "\n").dropFirst().compactMap { line in
            let cells = splitCSV(String(line))
            guard cells.count >= 13 else { return nil }
            return PlatformRow(
                platform: cells[0],
                followers: Int(cells[2]) ?? 0,
                posts: Int(cells[4]) ?? 0,
                engagementRate: cells[12]
            )
        }
    }

    /// Minimal CSV cell split honoring the backend's quoting (csvCell wraps
    /// cells containing commas/quotes/newlines in doubled-quote escaping).
    static func splitCSV(_ line: String) -> [String] {
        var cells: [String] = []
        var current = ""
        var quoted = false
        var iterator = line.makeIterator()
        while let ch = iterator.next() {
            if quoted {
                if ch == "\"" {
                    if let next = iterator.next() {
                        if next == "\"" { current.append("\"") } else if next == "," {
                            quoted = false
                            cells.append(current)
                            current = ""
                        } else {
                            quoted = false
                            current.append(next)
                        }
                    } else {
                        quoted = false
                    }
                } else {
                    current.append(ch)
                }
            } else if ch == "\"" && current.isEmpty {
                quoted = true
            } else if ch == "," {
                cells.append(current)
                current = ""
            } else {
                current.append(ch)
            }
        }
        cells.append(current)
        return cells
    }
}

struct DailyPoint: Identifiable {
    var id: Date { date }
    let date: Date
    let engagement: Double
    let followerGrowth: Double
    let content: Double
    let activity: Double
}

struct PlatformRow: Identifiable {
    var id: String { platform }
    let platform: String
    let followers: Int
    let posts: Int
    let engagementRate: String
}

private extension ISO8601DateFormatter {
    static let dateOnly: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

extension MeshAPI {
    /// Text (non-JSON) GET — the analytics series speaks CSV. Same session,
    /// same cookie jar as every other call.
    func getText(_ path: String) async throws -> String {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = "GET"
        let (data, response) = try await urlSession.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw MeshAPIError.server(message ?? "mesh.me returned \(status)", status)
        }
        return String(decoding: data, as: UTF8.self)
    }
}
