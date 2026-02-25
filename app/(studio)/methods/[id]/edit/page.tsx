import MethodForm from "@/components/studio/method-form";
import type { Id } from "@/convex/_generated/dataModel";

export default async function EditMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl">
      <MethodForm methodId={id as Id<"methods">} />
    </div>
  );
}
