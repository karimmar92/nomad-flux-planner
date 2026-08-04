import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/record")({
  component: () => <Outlet />,
});
