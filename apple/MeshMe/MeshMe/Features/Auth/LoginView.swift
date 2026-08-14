import SwiftUI

// THE NORTH STAR, NATIVELY.
//
// The web's sign-in screen is the product's calm benchmark: a quiet mat, the
// wordmark, two wells, one key. Nothing animates at you, nothing sells. This
// is that screen in SwiftUI — same palette, same radii, same restraint.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var identifier = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var signingIn = false
    @FocusState private var focus: Field?

    private enum Field { case identifier, password }

    var body: some View {
        ZStack {
            MeshTheme.paper0.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 8) {
                    Text("mesh.me")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(MeshTheme.ink1)
                    Text("Your World, Your Way")
                        .font(.subheadline)
                        .foregroundStyle(MeshTheme.ink3)
                }
                .padding(.bottom, 36)

                VStack(spacing: 12) {
                    Text("Log in")
                        .font(.headline)
                        .foregroundStyle(MeshTheme.ink1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    well {
                        TextField("Email, username, or phone", text: $identifier)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .identifier)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                    }

                    well {
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .focused($focus, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { submit() }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button(action: submit) {
                        Group {
                            if signingIn {
                                ProgressView().tint(.white)
                            } else {
                                Text("Log in").fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(MeshTheme.accent, in: RoundedRectangle(cornerRadius: MeshTheme.radiusMD))
                        .foregroundStyle(.white)
                    }
                    .buttonStyle(MeshPressStyle())
                    .disabled(signingIn || identifier.isEmpty || password.isEmpty)
                    .padding(.top, 4)
                }
                .padding(20)
                .background(MeshTheme.paper1, in: RoundedRectangle(cornerRadius: MeshTheme.radiusXL))
                .overlay(
                    RoundedRectangle(cornerRadius: MeshTheme.radiusXL)
                        .strokeBorder(MeshTheme.rule, lineWidth: 1)
                )
                .frame(maxWidth: 420)

                Spacer()
                Spacer()

                // Accounts are created on the website today; the native screen
                // says so plainly instead of hiding the door.
                Link("New here? Create your account at meshs.me",
                     destination: URL(string: "https://meshs.me/signup")!)
                    .font(.footnote)
                    .foregroundStyle(MeshTheme.ink3)
                    .padding(.bottom, 16)
            }
            .padding(.horizontal, 24)
        }
    }

    // Input wells: paper-2 recess at --r-sm (8) inside the --r-xl (20) hero
    // card — the canonical component roles from tokens.css.
    private func well<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(MeshTheme.paper2, in: RoundedRectangle(cornerRadius: MeshTheme.radiusSM))
            .foregroundStyle(MeshTheme.ink1)
    }

    private func submit() {
        guard !signingIn, !identifier.isEmpty, !password.isEmpty else { return }
        signingIn = true
        errorMessage = nil
        Task {
            errorMessage = await session.signIn(identifier: identifier, password: password)
            signingIn = false
        }
    }
}
