export type AppRole = "employee" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  firstName: string;
  lastName?: string | null;
  fullName?: string | null;
  role: AppRole;
  organizationId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  isActive?: boolean;
};