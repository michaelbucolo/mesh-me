# Mesh signature UI

This release carries the sign-in page's personality through the existing social
platform: connected-world drawings, soft accent light, expressive page openings,
clear surface depth, and a mobile dock with a shared selection animation.

Changed surfaces include login, signup, password reset, guest navigation, the app
shell, Feed, Explore, profile banners, settings, MeChat, shared empty states, and
dialogs. Existing routes, audience permissions, media protection, and social actions
continue to use their established implementations.

Signup now shares the main entry experience, shows the actual password rules,
offers password visibility, reports errors next to fields, and focuses the first
invalid field. It uses the server's password policy and reads form controls for
password-manager autofill. Errors do not reset the form. OAuth options remain
conditional on deployment configuration; no provider credentials are added here.

Explore no longer creates four pointer-driven springs and an animated blur/sheen
for each tile. Decorative artwork has no loops, network requests, or event handlers.
New motion honors reduced motion; theme colors and solid text surfaces retain the
existing contrast foundation. No packages, database changes, or deployment-policy
changes are required.

Validation is recorded in the pull request. Static source and HTTP checks cannot
prove every authenticated gesture or device layout; live browser inspection is
limited to public surfaces when no signed-in session is available.
