import { Navigate, useSearchParams } from "react-router-dom";
import Chart from "@/pages/Chart";

export default function Research() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  const normalizedView = view?.toLowerCase();

  if (normalizedView !== "chart") {
    const params = new URLSearchParams(searchParams);
    params.set("view", "chart");
    const query = params.toString();

    return <Navigate to={`/research${query ? `?${query}` : ""}`} replace />;
  }

  return <Chart />;
}

