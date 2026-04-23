export type AuthUser = {
  id: string;
  onboarded: boolean;
};

export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>;
}
