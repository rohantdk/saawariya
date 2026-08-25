import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Serve images straight from `public/` when the demo gate is on.
     *
     * `next/image` does not read local files off disk — it emits
     * `/_next/image?url=…` and the optimizer fetches that source over HTTP from
     * the server itself. That internal request carries no credentials, so with
     * DEMO_PASSWORD set it meets the Basic Auth challenge in src/proxy.ts, gets
     * a 401, and the optimizer reports "The requested resource isn't a valid
     * image". Every picture on the site breaks, while the pages around them
     * render perfectly — which is a confusing way to find out.
     *
     * Serving the files directly means the BROWSER requests them, and a browser
     * does send the credentials it already holds for the origin. So the gate
     * still covers the imagery, which is the reason it exists at all — see
     * public/editorial/CREDITS.md.
     *
     * Unlike the noindex header, this genuinely is a build-time decision: it
     * changes the markup `<Image>` emits. DEMO_PASSWORD therefore has to be set
     * when the demo is BUILT, not only when it runs. docs/DEPLOYMENT.md says so.
     *
     * The cost is small here. The catalogue photography was resized and
     * re-encoded before it was committed (public/catalogue/CREDITS.md), so the
     * optimizer was not saving much on top.
     */
    unoptimized: Boolean(process.env.DEMO_PASSWORD),
  },
};

export default nextConfig;
