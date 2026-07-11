import {
  organizationSchema,
  softwareSchema,
  websiteSchema,
} from "@/core/config/structured-data";
import { FeaturesSection } from "@/components/features-section";
import { FileQuerySection } from "@/components/file-query-section";
import { ProvidersSection } from "@/components/providers-section";
import { QueryWorkflowSection } from "@/components/query-workflow-section";
import { DeferredGitHubStats } from "@/components/github-stats/deferred-github-stats";
import { Hero } from "@/components/hero";
import { getGitHubStats } from "@/core/github/get-github-stats";
import { getRelease } from "@/core/github/get-release";

export default async function HomeView() {
  const [stats, release] = await Promise.all([getGitHubStats(), getRelease()]);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationSchema,
            websiteSchema,
            softwareSchema(release?.tagName),
          ]),
        }}
        type="application/ld+json"
      />
      <Hero release={release} />
      <FeaturesSection />
      <FileQuerySection />
      <QueryWorkflowSection />
      <ProvidersSection />
      {stats ? <DeferredGitHubStats data={stats} /> : null}
    </>
  );
}
