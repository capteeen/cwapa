import ProjectDetail from "@/components/ProjectDetail";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <main className="px-6 pb-24 pt-14"><ProjectDetail projectId={params.id} /></main>;
}
