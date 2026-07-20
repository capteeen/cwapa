import ResetPasswordPanel from "@/components/ResetPasswordPanel";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="min-h-[75vh] bg-surface/40 px-6 py-20"><ResetPasswordPanel token={token} /></main>;
}
