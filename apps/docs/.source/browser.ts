// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"api.mdx": () => import("../content/docs/api.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "installation.mdx": () => import("../content/docs/installation.mdx?collection=docs"), "test.mdx": () => import("../content/docs/test.mdx?collection=docs"), "types.mdx": () => import("../content/docs/types.mdx?collection=docs"), "guides/mock-data.mdx": () => import("../content/docs/guides/mock-data.mdx?collection=docs"), "guides/new-features.mdx": () => import("../content/docs/guides/new-features.mdx?collection=docs"), }),
};
export default browserCollections;