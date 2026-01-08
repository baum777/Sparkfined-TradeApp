import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Legacy route wrapper (Theme Group 1)
 * /chart?q=... -> /research?view=chart&q=...
 */
export default function Chart() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("view", "chart");
  const query = params.toString();
  return <Navigate to={`/research${query ? `?${query}` : ""}`} replace />;
}
