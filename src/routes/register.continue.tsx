import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "./register";

export const Route = createFileRoute("/register/continue")({
  component: RegisterPage,
});
