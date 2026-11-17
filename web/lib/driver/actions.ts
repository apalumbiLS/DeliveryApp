"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDriverApp } from "./require-driver";
import { isStepTarget } from "./steps";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Take a posted job. First accept wins, settled in `accept_job`: the loser is
 * sent back to the job page, which then says it was taken.
 */
export async function acceptJob(formData: FormData): Promise<void> {
  const { supabase, role } = await requireDriverApp();
  const orderId = String(formData.get("orderId") ?? "");
  if (!UUID.test(orderId) || role !== "driver") redirect("/driver");

  const { data, error } = await supabase.rpc("accept_job", {
    p_order_id: orderId,
  });

  revalidatePath("/driver");
  revalidatePath(`/driver/jobs/${orderId}`);
  revalidatePath("/dispatch/review");
  redirect(
    `/driver/jobs/${orderId}${!error && data === "accepted" ? "" : "?taken=1"}`,
  );
}

export type StepResult = { ok: true } | { ok: false; message: string };

/**
 * Move the job one step forward. A photo step takes the path of a photo
 * already uploaded to the evidence bucket, or a reason for skipping it;
 * `advance_job` checks the caller, the order of steps, and that the photo
 * exists under this job.
 */
export async function advanceJob(input: {
  orderId: string;
  to: string;
  photo?: { path: string; contentType: string; sizeBytes: number } | null;
  skipReason?: string | null;
}): Promise<StepResult> {
  const { supabase, role } = await requireDriverApp();
  if (
    role !== "driver" ||
    !UUID.test(input.orderId) ||
    !isStepTarget(input.to)
  ) {
    return { ok: false, message: "This step isn't available." };
  }

  const reason = input.skipReason?.trim() ?? "";
  if (reason.length > 500) {
    return { ok: false, message: "Keep the reason under 500 characters." };
  }

  const { error } = await supabase.rpc("advance_job", {
    p_order_id: input.orderId,
    p_to_status: input.to,
    p_photo_path: input.photo?.path ?? null,
    p_content_type: input.photo?.contentType ?? null,
    p_size_bytes: input.photo?.sizeBytes ?? null,
    p_skip_reason: reason || null,
  });

  if (error) {
    return {
      ok: false,
      message: error.message.includes("Photo or reason")
        ? "Add a photo, or say why you're skipping it."
        : "That didn't save. Refresh the page, and call dispatch if it keeps happening.",
    };
  }

  revalidatePath("/driver");
  revalidatePath(`/driver/jobs/${input.orderId}`);
  revalidatePath("/dispatch/review");
  return { ok: true };
}
