import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/dashboard/",
          "/account/",
          "/mentor/workspace/",
          "/current-affairs/workspace/",
          "/current-affairs/admin/",
          "/api/",
          "/verify-email",
          "/forgot-password",
          "/reset-password"
        ]
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
