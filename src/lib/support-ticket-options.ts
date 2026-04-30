export const supportCategories = [
  { value: "accounts", label: "Account access" },
  { value: "meshi", label: "Meshi" },
  { value: "safety", label: "Safety or privacy" },
  { value: "billing", label: "Billing or Mesh Pro" },
  { value: "connected-platforms", label: "Connected platforms" },
  { value: "data", label: "Data export or deletion" },
  { value: "passwords", label: "Password or verification" },
  { value: "errors", label: "Bug or error" },
  { value: "other", label: "Something else" },
] as const;

export const supportPriorities = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" },
] as const;

export type SupportCategory = (typeof supportCategories)[number]["value"];
export type SupportPriority = (typeof supportPriorities)[number]["value"];

const categoryValues = new Set<string>(supportCategories.map((category) => category.value));
const priorityValues = new Set<string>(supportPriorities.map((priority) => priority.value));

export function isSupportCategory(value: string): value is SupportCategory {
  return categoryValues.has(value);
}

export function isSupportPriority(value: string): value is SupportPriority {
  return priorityValues.has(value);
}
