import SwiftUI
// The ONE sanctioned UIKit import in this app: SwiftUI's Color has no
// trait-following dynamic initializer of its own, so the light/dark bridge
// below rides UIColor. Everything else is pure SwiftUI — the gate holds that.
import UIKit

// THE PAPER SYSTEM, PORTED — not reinvented.
//
// Every value here is lifted verbatim from the web app's token sheet
// (src/app/tokens.css), which already speaks Apple's material language:
// paper-1 dark is #1c1c1e, the accent is #409cff, the radius ladder is
// concentric (innerRadius = outerRadius - padding). The native app and the
// website must read as ONE product; the way that stays true is one palette,
// declared twice, with the web's file as the source of truth. If a token
// moves there, it moves here — the swift-app gate holds the pairing.

enum MeshTheme {

    // ── Paper (backgrounds) ──────────────────────────────────────────────
    /// THE MAT — the page behind everything. tokens.css --paper-0.
    static let paper0 = dyn(light: 0xF2F2F7, dark: 0x000000)
    /// Card / sheet / panel. tokens.css --paper-1.
    static let paper1 = dyn(light: 0xFFFFFF, dark: 0x1C1C1E)
    /// RECESS — input wells, trays, sunken groups. tokens.css --paper-2.
    static let paper2 = dyn(light: 0xE9E9EE, dark: 0x2C2C2E)

    // ── Ink (text) ───────────────────────────────────────────────────────
    /// Primary text. tokens.css --ink-1.
    static let ink1 = dyn(light: 0x000000, dark: 0xFFFFFF)
    /// Secondary text. tokens.css --ink-2.
    static let ink2 = dyn(light: 0x48484A, dark: 0xD1D1D1)
    /// Muted text — the contrast floor. tokens.css --ink-3.
    static let ink3 = dyn(light: 0x636366, dark: 0xA8A8A8)

    // ── Accent ───────────────────────────────────────────────────────────
    /// The one product blue. tokens.css --accent.
    static let accent = dyn(light: 0x0056D6, dark: 0x409CFF)
    /// Hover/pressed accent. tokens.css --accent-hover.
    static let accentHover = dyn(light: 0x0062EA, dark: 0x5AA9FF)

    // ── Rules (borders) ──────────────────────────────────────────────────
    /// Hairline separators. tokens.css --rule.
    static let rule = Color(
        light: Color(red: 60 / 255, green: 60 / 255, blue: 67 / 255, opacity: 0.29),
        dark: Color(red: 84 / 255, green: 84 / 255, blue: 88 / 255, opacity: 0.65)
    )

    // ── Radius ladder ────────────────────────────────────────────────────
    // tokens.css --r-* (the canonical component scale, hard cap 20):
    // xs 6 · sm 8 (inputs, small buttons) · md 10 (buttons, list rows) ·
    // lg 14 (cards, feed posts) · xl 20 (modals, drawers, hero surfaces).
    static let radiusXS: CGFloat = 6
    static let radiusSM: CGFloat = 8
    static let radiusMD: CGFloat = 10
    static let radiusLG: CGFloat = 14
    static let radiusXL: CGFloat = 20

    // ── Motion ───────────────────────────────────────────────────────────
    // src/lib/motion.ts / globals.css: one ease-out workhorse, real press
    // physics (scale 0.97), hover never travels. SwiftUI speaks springs, so
    // the workhorse maps to a smooth spring and the press to a snappy one.
    static let easeOut = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.26)
    static let spring = Animation.spring(response: 0.34, dampingFraction: 0.82)
    static let pressScale: CGFloat = 0.97
    /// Base cascade step for list/grid staggers (globals.css --mesh-stagger).
    static let stagger: TimeInterval = 0.046

    // ── Helpers ──────────────────────────────────────────────────────────
    private static func dyn(light: UInt32, dark: UInt32) -> Color {
        Color(light: Color(hex: light), dark: Color(hex: dark))
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    /// A dynamic color that follows the system appearance — the app renders
    /// in whichever mode the device is in, same as the website's `.dark`.
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// ── Press physics ────────────────────────────────────────────────────────
// The web's one interaction law: hover never travels, pressing is real
// (--mesh-press-scale 0.97). This is the ONLY button style the app uses.
struct MeshPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? MeshTheme.pressScale : 1)
            .animation(MeshTheme.spring, value: configuration.isPressed)
    }
}
