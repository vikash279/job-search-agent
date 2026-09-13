import bcrypt from "bcryptjs";
import { prisma } from "../src/db/prisma.js";
import { persistJobs } from "../src/modules/job-discovery/service.js";
import { FIXTURE_JOBS } from "../src/modules/job-source-adapters/fixture.js";
import { ensureDefaultSources } from "../src/modules/job-source-adapters/registry.js";

async function main() {
  await ensureDefaultSources();
  const passwordHash = await bcrypt.hash("demo12345", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo Candidate",
      passwordHash,
      profile: {
        create: {
          headline: "Senior TypeScript Engineer",
          summary: "Full-stack engineer focused on TypeScript, React, and Node.js.",
          yearsExperience: 8,
          currentTitle: "Senior Software Engineer",
          currentCompany: "Independent",
          skills: ["TypeScript", "React", "Node", "PostgreSQL", "AWS"],
          experience: [
            {
              title: "Senior Software Engineer",
              company: "Independent",
              highlights: ["Built production TypeScript services"],
            },
          ],
          preferredRoles: ["Senior TypeScript Engineer", "Full Stack Engineer"],
          preferredLocations: ["Remote", "USA"],
          preferredWorkModes: ["remote", "hybrid"],
          verifiedFields: [
            "headline",
            "summary",
            "skills",
            "yearsExperience",
            "currentTitle",
            "expectedSalaryMin",
            "noticePeriodDays",
          ],
          expectedSalaryMin: 140000,
          expectedSalaryMax: 180000,
          noticePeriodDays: 30,
        },
      },
      preferences: {
        create: {
          targetRoles: ["TypeScript Engineer", "Full Stack Engineer"],
          preferredLocations: ["Remote", "USA"],
          workModes: ["remote", "hybrid"],
          preferredTech: ["TypeScript", "React", "Node"],
          salaryMin: 130000,
          searchKeywords: ["typescript", "react", "node"],
          minimumMatchScore: 50,
        },
      },
    },
  });

  await persistJobs(FIXTURE_JOBS);
  console.log(`Seeded demo user ${user.email} / demo12345`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
