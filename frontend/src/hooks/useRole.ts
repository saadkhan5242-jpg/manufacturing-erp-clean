import { useAuth } from "./useAuth.jsx";
import { UserRole } from "../types/erpTypes.ts";

export function useRole() {
  const { user } = useAuth();

  const role: UserRole = user?.role || "viewer";

  const hasRole = (...allowedRoles: UserRole[]) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return allowedRoles.includes(user.role);
  };

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager" || isAdmin;
  const isOperator = user?.role === "operator";
  const isFinance = user?.role === "finance" || isAdmin;

  return { role, user, hasRole, isAdmin, isManager, isOperator, isFinance };
}
