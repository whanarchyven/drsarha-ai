import ModelForm from "@/components/studio/model-form";
import type { Id } from "@/convex/_generated/dataModel";

export default async function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <ModelForm modelId={id as Id<"models">} />
    </div>
  );
}
