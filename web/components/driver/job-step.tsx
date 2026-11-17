"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, button } from "@/components/ui/button";
import { CameraIcon } from "@/components/ui/icons";
import { advanceJob } from "@/lib/driver/actions";
import type { JobStep as Step } from "@/lib/driver/steps";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Long edge of an uploaded photo. Enough to read a receipt. */
const MAX_EDGE = 2000;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Shrinks a phone photo to a JPEG before upload, so it goes up quickly on a
 * weak signal. A format the browser cannot draw (HEIC outside Safari) goes up
 * as taken.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * The job's next step. A photo step asks for the photo first and lets the
 * driver skip it only with a reason, which the dispatcher sees.
 */
export function JobStep({ orderId, step }: { orderId: string; step: Step }) {
  const router = useRouter();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Sets the photo and its thumbnail, releasing the previous thumbnail. */
  function choosePhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      let uploaded: {
        path: string;
        contentType: string;
        sizeBytes: number;
      } | null = null;

      if (step.photo && photo && !skipping) {
        const blob = await shrink(photo);
        const contentType = blob.type || photo.type || "image/jpeg";
        const path = `${orderId}/${step.photo}-${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? "jpg"}`;
        const { error: uploadError } = await createClient()
          .storage.from("evidence")
          .upload(path, blob, { contentType, upsert: false });
        if (uploadError) {
          setError(
            "The photo didn't upload. Check your signal and try again, or skip it with a reason.",
          );
          return;
        }
        uploaded = { path, contentType, sizeBytes: blob.size };
      }

      const result = await advanceJob({
        orderId,
        to: step.to,
        photo: uploaded,
        skipReason: skipping ? reason : null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      choosePhoto(null);
      setSkipping(false);
      setReason("");
      router.refresh();
    });
  }

  const ready =
    !step.photo || (skipping ? reason.trim() !== "" : photo !== null);

  return (
    <div>
      <p className="text-center text-[13.5px] leading-relaxed text-ink-muted">
        {step.hint}
      </p>

      {step.photo && !skipping ? (
        <div className="mt-3 flex items-center gap-3">
          {/* A thumbnail beside the retake button rather than a full preview:
              this panel is pinned to the bottom of short phone screens. */}
          {preview ? (
            // A local preview of the photo just taken; next/image cannot load
            // blob URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`The ${step.photo} photo you took`}
              className="h-12 w-12 shrink-0 rounded-control border border-hairline object-cover"
            />
          ) : null}
          <label
            htmlFor={inputId}
            className={cn(
              button({ intent: photo ? "secondary" : "primary", size: "md" }),
              "min-w-0 flex-1",
            )}
          >
            <CameraIcon className="h-4.5 w-4.5" />
            {photo ? "Retake photo" : `Photograph the ${step.photo}`}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              setError(null);
              choosePhoto(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}

      {step.photo && skipping ? (
        <label className="mt-3 block text-[13.5px] font-medium text-ink">
          Why are you skipping the photo?
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1.5 block w-full rounded-field border border-hairline bg-card px-3 py-2 text-[15px] font-normal text-ink"
          />
          <span className="mt-1 block text-[12.5px] font-normal text-ink-faint">
            The dispatcher sees this on the order.
          </span>
        </label>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-[13.5px] leading-relaxed text-danger-ink"
        >
          {error}
        </p>
      ) : null}

      {!step.photo || photo || skipping ? (
        <Button
          size="md"
          className="mt-3 w-full"
          disabled={!ready || pending}
          onClick={submit}
        >
          {pending ? "Saving…" : step.label}
        </Button>
      ) : null}

      {step.photo ? (
        <Button
          intent="ghost"
          size="md"
          className="mt-1.5 w-full"
          disabled={pending}
          onClick={() => {
            setError(null);
            setSkipping((value) => !value);
          }}
        >
          {skipping ? "Take a photo instead" : "Skip the photo"}
        </Button>
      ) : null}
    </div>
  );
}
