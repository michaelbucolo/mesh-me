import SwiftUI

// The one avatar: a face when there is one, initials on paper when there
// isn't — never a placeholder glyph, never an emoji.
struct MeshAvatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 40

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }
        let joined = parts.joined()
        return joined.isEmpty ? "M" : joined.uppercased()
    }

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var fallback: some View {
        ZStack {
            MeshTheme.paper2
            Text(initials)
                .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
                .foregroundStyle(MeshTheme.ink2)
        }
    }
}
