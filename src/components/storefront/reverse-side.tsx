import Image from "next/image";

/**
 * The reverse-side panel — SRS §58.
 *
 * On handloom the back of the cloth is where the quality actually shows. In a
 * kadhwa Banarasi each motif is woven with its own shuttle and tied off, so the
 * reverse is nearly as clean as the front; in the cheaper cutwork method the
 * threads are carried across the back between motifs and then trimmed, which
 * looks identical from the front and snags within a season. Nothing on the
 * front of a photograph distinguishes the two.
 *
 * So the panel has two states and both are useful. With a reverse frame, it is
 * the strongest quality signal on the page. Without one, it says so plainly
 * rather than being hidden — an absent answer is information too, and hiding it
 * would let a listing that has never been asked the question look the same as
 * one that passed it.
 */
export function ReverseSide({
  image,
  sellerName,
}: {
  image: { url: string; alt: string } | null;
  sellerName: string;
}) {
  return (
    <section className="mt-16 border-t border-ivory-400 pt-12">
      <div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:gap-12">
        <div className="relative aspect-[3/4] overflow-hidden bg-ivory-200">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 20rem, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-relaxed text-ink-400">
              No photograph of the reverse
              <br />
              has been supplied for this piece.
            </div>
          )}
        </div>

        <div className="max-w-xl">
          <p className="eyebrow mb-4">Turn it over</p>
          <h2 className="font-display text-2xl leading-tight sm:text-3xl">
            The reverse is where the work shows
          </h2>

          {image ? (
            <>
              <p className="mt-5 text-sm leading-relaxed text-ink-500">
                Short floats, tied off and trimmed close, mean each motif was
                woven with its own shuttle rather than carried across the back
                and cut away afterwards. It is the difference between a piece
                that lasts a decade and one that snags in a season, and it is
                invisible from the front.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                {sellerName} supplied this frame with the listing.
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-sm leading-relaxed text-ink-500">
                We ask every seller to photograph the back of the cloth, because
                it is the one view that cannot be flattered. This listing
                predates that requirement and has not been re-shot yet.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                We would rather tell you it is missing than quietly show you
                another picture of the front.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
