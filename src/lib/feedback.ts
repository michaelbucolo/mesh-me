import { impactFeedback, notificationFeedback } from "./native/haptics";
import { playSound } from "./sound";

export type FeedbackKind = "select" | "navigate" | "like" | "save" | "send" | "success" | "error";

// Call from an intentional action. Success belongs after the server confirms;
// selection and navigation belong on the gesture, so the UI answers instantly.
export function feedback(kind: FeedbackKind): void {
  if (kind === "success" || kind === "error") {
    void notificationFeedback(kind === "success" ? "SUCCESS" : "ERROR");
  } else {
    void impactFeedback(kind === "like" ? "MEDIUM" : "LIGHT");
  }
  if (kind !== "error") {
    playSound({ select: "pop", navigate: "land", like: "heart", save: "land", send: "send", success: "chime" }[kind] as Parameters<typeof playSound>[0]);
  }
}
