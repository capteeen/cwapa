import ResetPasswordPanel from "@/components/ResetPasswordPanel";

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <main className="min-h-[75vh] bg-surface/40 px-6 py-20"><ResetPasswordPanel token={searchParams.token} /></main>;
}
