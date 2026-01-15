// @ts-nocheck
import * as __fd_glob_8 from "../content/docs/guides/new-features.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/guides/mock-data.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/types.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/test.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/installation.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/api.mdx?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/guides/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "guides/meta.json": __fd_glob_1, }, {"api.mdx": __fd_glob_2, "index.mdx": __fd_glob_3, "installation.mdx": __fd_glob_4, "test.mdx": __fd_glob_5, "types.mdx": __fd_glob_6, "guides/mock-data.mdx": __fd_glob_7, "guides/new-features.mdx": __fd_glob_8, });