import type { PrismaClient } from "../../src/generated/prisma/client";
import { CATALOGUE_IMAGES } from "./images";

/**
 * Weaving clusters — the places the catalogue actually comes from.
 *
 * Each is named for the town already recorded on the sellers who work there
 * (Seller.city), not for a more evocative nearby village, so the cluster page
 * and the "Sold by … · Varanasi" line on every product card can never disagree.
 * The finer place names — Madanpura, Bagru, Sanganeri, Phulia — belong in the
 * description, where they are context rather than a second source of truth.
 *
 * Only five of the seven seeded sellers sit in one. Surat is a powerloom and
 * trading centre rather than a handloom cluster, and the Delhi account is a
 * distribution depot; both are left unlinked, which is why Seller.clusterId is
 * nullable. A cluster list that quietly invented a tradition for a warehouse in
 * Delhi would undo the point of having the list at all.
 */

export type ClusterSeed = {
  slug: string;
  name: string;
  state: string;
  tradition: string;
  blurb: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  /** SellerSeed.key values that trade from here. */
  sellers: string[];
};

export const CLUSTERS: ClusterSeed[] = [
  {
    slug: "varanasi",
    name: "Varanasi",
    state: "Uttar Pradesh",
    tradition: "Banarasi brocade",
    blurb: "Silk brocade worked in gold and silver zari, on jacquard and pit looms.",
    description:
      "Banaras has woven figured silk since at least the sixteenth century, and the trade still runs street by street — Madanpura, Alaipura, Lallapura — with weaving, dyeing, zari-making and finishing each held by different households. A kadhwa saree is woven motif by motif with a separate shuttle for every flower, so the reverse carries no long floats and nothing is cut away; it is slower than cutwork by weeks, and it is the difference a buyer feels in twenty years' time. Pure zari here means silver thread gilded with gold, wound on a silk core.",
    imageUrl: CATALOGUE_IMAGES.banarasi[0],
    sortOrder: 0,
    sellers: ["anil"],
  },
  {
    slug: "kanchipuram",
    name: "Kanchipuram",
    state: "Tamil Nadu",
    tradition: "Kanjivaram silk",
    blurb: "Heavy mulberry silk with contrast borders joined by the korvai method.",
    description:
      "A Kanjivaram is woven from thick mulberry silk, three ply in the warp, and its border is very often a different colour from its body. In a true korvai saree that border is not printed or stitched on: it is interlocked with the body on the loom, by hand, which takes two weavers working the same piece and leaves a join that will not part. Temple towers, mangoes and checks recur because the motifs came off the walls of the temples the weavers lived beside.",
    imageUrl: CATALOGUE_IMAGES.kanjivaram[0],
    sortOrder: 1,
    sellers: ["meenakshi"],
  },
  {
    slug: "chanderi",
    name: "Chanderi",
    state: "Madhya Pradesh",
    tradition: "Chanderi silk-cotton",
    blurb: "Sheer silk-cotton woven on pit looms, light enough to read through.",
    description:
      "Chanderi's transparency is not a finish applied afterwards — it comes from refusing to degum the raw yarn, which leaves the single flature silk stiff and glassy and lets light through the ground. The cloth is woven on pit looms in the town and in Pranpur village next to it, with small gold booti added by hand needle as the weaving advances. It is the fabric people reach for in a Madhya Pradesh summer, and it creases exactly as honestly as that suggests.",
    imageUrl: CATALOGUE_IMAGES.chanderi[0],
    sortOrder: 2,
    sellers: ["chanderi"],
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    state: "Rajasthan",
    tradition: "Bagru and Sanganeri block print",
    blurb: "Hand block printing in natural dye, in the villages around the city.",
    description:
      "Two neighbouring traditions, told apart by their ground. Sanganeri prints fine floral repeats on white; Bagru, thirty kilometres west, prints on cloth first steeped in fuller's earth and turmeric, which is why its ground reads cream or buff rather than white. Both work in natural dye — indigo from the vat, madder and alizarin for red, pomegranate rind for yellow — and both use dabu, a mud resist, to hold out the areas that must stay pale. Each colour is a separate block and a separate pass, so a four-colour print is four alignments made by eye.",
    imageUrl: CATALOGUE_IMAGES.blockprint[0],
    sortOrder: 3,
    sellers: ["rajwadi"],
  },
  {
    slug: "nadia",
    name: "Nadia",
    state: "West Bengal",
    tradition: "Jamdani and Bengal tant",
    blurb: "Discontinuous supplementary weft, worked freehand without a draft.",
    description:
      "Jamdani is the hardest thing on a handloom to do well and the hardest to fake. The motif is not woven across the full width and then trimmed; each one is built by lifting individual warp threads with a fine bamboo point and laying in a separate thick weft by hand, from memory, with no punch card and no drawing pinned to the loom. Two weavers sit at one loom and a good saree takes months. The plainer Bengal tant from the same district — crisp, light cotton for daily wear — comes off the same looms between commissions.",
    imageUrl: CATALOGUE_IMAGES.jamdani[0],
    sortOrder: 4,
    sellers: ["bengal"],
  },
];

export async function seedClusters(
  prisma: PrismaClient,
  sellerIds: Map<string, string>,
) {
  for (const seed of CLUSTERS) {
    const cluster = await prisma.cluster.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        state: seed.state,
        tradition: seed.tradition,
        blurb: seed.blurb,
        description: seed.description,
        imageUrl: seed.imageUrl,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        state: seed.state,
        tradition: seed.tradition,
        blurb: seed.blurb,
        description: seed.description,
        imageUrl: seed.imageUrl,
        sortOrder: seed.sortOrder,
      },
    });

    for (const key of seed.sellers) {
      const sellerId = sellerIds.get(key);
      if (!sellerId) {
        throw new Error(`Cluster "${seed.slug}" references missing seller "${key}"`);
      }
      await prisma.seller.update({
        where: { id: sellerId },
        data: { clusterId: cluster.id },
      });
    }
  }

  const linked = CLUSTERS.reduce((n, c) => n + c.sellers.length, 0);
  console.log(
    `  clusters: ${CLUSTERS.length} (${linked} of ${sellerIds.size} sellers linked)`,
  );
}
