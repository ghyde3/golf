import { SetPasswordForm } from "./SetPasswordForm";

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; invite?: string };
}) {
  const initial =
    searchParams.token ?? searchParams.invite ?? "";
  return <SetPasswordForm initialToken={initial} />;
}
