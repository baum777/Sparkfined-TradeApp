import { Navigate, useLocation } from "react-router-dom";

export default function Replay() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("view", "chart");
  params.set("replay", "true");
  const query = params.toString();

  return <Navigate to={`/research${query ? `?${query}` : ""}`} replace />;
}

