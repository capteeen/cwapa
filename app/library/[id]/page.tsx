import ProjectDetail from "@/components/ProjectDetail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="px-6 pb-24 pt-14"><ProjectDetail projectId={id} /></main>;
}
