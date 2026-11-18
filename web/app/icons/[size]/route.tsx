import { appIcon } from "@/lib/app-icon";

/** The manifest's icons, for Android's home screen and install prompt. */
const SIZES = [192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  context: RouteContext<"/icons/[size]">,
) {
  const size = Number((await context.params).size);
  if (!SIZES.includes(size)) {
    return new Response(null, { status: 404 });
  }
  return appIcon(size);
}
