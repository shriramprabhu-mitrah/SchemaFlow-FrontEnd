const fs = require('fs');
const path = require('path');

const cmsDocsPath = path.join(__dirname, 'src/app/core/services/cms-docs.service.ts');
let content = fs.readFileSync(cmsDocsPath, 'utf8');

// 1. Bump version
content = content.replace(/dbnexus_cms_v38_/g, 'dbnexus_cms_v39_');
content = content.replace(/i <= 37/g, 'i <= 38');

// 2. Add section
const sectionToFind = "{ id: 'sec-version-history', title: 'Version History & Releases', slug: 'version-history-and-releases', sortOrder: 6, showHeading: true }";
const sectionToAdd = ",\n      { id: 'sec-legal', title: 'Legal & Policy', slug: 'legal-and-policy', sortOrder: 7, showHeading: true }";
content = content.replace(sectionToFind, sectionToFind + sectionToAdd);

// 3. Add pages
const privacyContent = fs.readFileSync(path.join(__dirname, 'src/assets/policy/privacy-policy.md'), 'utf8');
const termsContent = fs.readFileSync(path.join(__dirname, 'src/assets/policy/terms-of-service.md'), 'utf8');

const pagesToAdd = `
      // SECTION: LEGAL & POLICY
      ,{
        id: '113',
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        description: 'DB Nexus Privacy Policy detailing information collection, usage, and protection.',
        sectionId: 'sec-legal',
        content: \`${privacyContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-09-11T12:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '114',
        title: 'Terms of Service',
        slug: 'terms-of-service',
        description: 'DB Nexus Terms of Service outlining the rules and regulations for the use of our platform.',
        sectionId: 'sec-legal',
        content: \`${termsContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-09-11T12:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      }
    ];
  }
}
`;

content = content.replace(/\s*\];\s*\}\s*\}\s*$/, pagesToAdd);

fs.writeFileSync(cmsDocsPath, content);
console.log('Successfully updated cms-docs.service.ts');
