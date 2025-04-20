import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContextDefinition";
import { AuthContextType } from "../types/auth";

// Custom hook to use the auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
