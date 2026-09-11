# Terms of Service

**Last Updated: September 11, 2026**

Welcome to **DB Nexus**. These Terms of Service ("Terms") govern your access to and use of the DB Nexus website, applications, APIs, workspaces, and related services (collectively, the **"Platform"** or **"Service"**).

By creating an account, accessing, or using DB Nexus, you acknowledge that you have read, understood, and agree to these Terms.

**Important:** If you do not agree with these Terms, please do not access or use DB Nexus.

## 1. About DB Nexus

DB Nexus is a web-based database schema design and collaboration platform built around **DBML (Database Markup Language)**.

The Platform enables developers, database administrators, software architects, and engineering teams to design, visualize, document, and collaborate on database schemas.

DB Nexus provides tools for transforming declarative database definitions into interactive visual representations and production-ready SQL scripts.

### Core Services

DB Nexus may provide the following capabilities:

1. **DBML Schema Design** — Create and edit database schemas using DBML.
2. **Visual ER Diagrams** — Visualize tables, columns, relationships, indexes, and constraints.
3. **SQL Import** — Import supported SQL DDL definitions and convert them into database schemas.
4. **SQL Generation** — Generate SQL DDL for supported database engines.
5. **Table Groups** — Organize database tables into logical domains or functional groups.
6. **Schema Documentation** — Document database structures, columns, relationships, and business definitions.
7. **Workspaces** — Organize schemas and projects within personal or collaborative workspaces.
8. **Collaboration** — Share and work on database designs with authorized team members.
9. **Export** — Export supported schemas and diagrams into available formats.

Features may vary depending on your account type, subscription, or plan.

## 2. Account Registration

Certain DB Nexus features require an account.

When creating an account, you agree to provide accurate and current information.

You are responsible for:

- Maintaining the confidentiality of your login credentials.
- Keeping your account information accurate.
- Protecting access to your account.
- All activities performed through your account.
- Notifying DB Nexus if you believe your account has been compromised.

You must not use another person's account without authorization.

**Warning:** Never store database passwords, API keys, access tokens, private keys, or other credentials inside DB Nexus schema definitions.

## 3. Workspaces and Collaboration

DB Nexus may allow users to create personal or collaborative workspaces.

Workspace owners and administrators are responsible for managing workspace access.

This may include:

- Inviting users.
- Removing users.
- Assigning permissions.
- Managing workspace members.
- Controlling access to schemas.
- Managing shared database documentation.

Users who are granted access to a workspace may be able to view, modify, or export workspace content depending on their assigned permissions.

**Note:** Sharing a workspace or schema with another user may give that user access to the information contained within the shared resource. Always verify permissions before sharing confidential database designs.

## 4. Customer Data

For purposes of these Terms, **"Customer Data"** means information submitted, created, uploaded, or stored by you through DB Nexus.

Customer Data may include:

- DBML definitions.
- SQL schema definitions.
- Table structures.
- Column definitions.
- Relationships.
- Index definitions.
- Constraints.
- Table groups.
- Diagram configurations.
- Documentation.
- Schema descriptions.
- Workspace content.

You retain ownership of your Customer Data.

DB Nexus does not claim ownership of your database schemas, diagrams, or documentation.

You grant DB Nexus a limited, non-exclusive right to host, store, process, reproduce, transmit, and display Customer Data only as reasonably necessary to provide, maintain, secure, and improve the Service.

## 5. Database Schema Information

DB Nexus is primarily designed for **database schema design and documentation**.

The Platform is not intended to act as a database hosting service.

For example, a schema may contain:

```dbml
Table Users {
    id int [pk]
    username varchar
    email varchar
}

Table Orders {
    id int [pk]
    user_id int
}
```

This represents database **structure**, rather than the actual records stored inside the database.

DB Nexus users are responsible for determining what information they submit to the Platform.

**Warning:** Do not intentionally upload production database records, database credentials, passwords, authentication tokens, encryption keys, or other secrets unless a specific DB Nexus feature explicitly requires and supports such information.

## 6. Acceptable Use

You agree to use DB Nexus only for lawful and authorized purposes.

You must not:

1. Attempt to gain unauthorized access to another user's account or workspace.
2. Circumvent authentication or security controls.
3. Upload malicious software or harmful code.
4. Interfere with the operation of the Platform.
5. Abuse APIs, automated systems, or infrastructure.
6. Perform unauthorized security testing against the Platform.
7. Attempt to reverse engineer security mechanisms.
8. Scrape or systematically collect Platform data without authorization.
9. Impersonate another person or organization.
10. Use DB Nexus to violate applicable laws or regulations.
11. Upload content that infringes third-party intellectual property rights.
12. Use the Platform to distribute malware, phishing content, or other harmful material.

DB Nexus may restrict, suspend, or terminate accounts that violate these requirements.

## 7. Intellectual Property

DB Nexus and its underlying technology are protected by applicable intellectual property laws.

This includes, where applicable:

- Software.
- Source code.
- User interface.
- Platform architecture.
- Visual designs.
- Branding.
- Logos.
- Documentation.
- APIs.
- Proprietary functionality.

Except for rights expressly granted under these Terms, no ownership rights are transferred to you.

Your use of DB Nexus does not grant you ownership of the DB Nexus Platform or its underlying technology.

## 8. Your Content and Rights

You are responsible for ensuring that you have the necessary rights to submit Customer Data to DB Nexus.

You represent that your Customer Data:

- Does not unlawfully infringe third-party rights.
- Does not violate applicable laws.
- Does not contain unauthorized confidential information.
- Can legally be processed by DB Nexus for the purposes described in these Terms.

DB Nexus does not claim ownership of your original database schemas or documentation.

## 9. Sharing and Public Content

DB Nexus may provide functionality for sharing schemas, diagrams, documentation, or workspaces.

If you choose to make content publicly accessible, you understand that other users or Internet users may be able to access that content depending on the sharing configuration.

You are responsible for determining whether content should be:

- Private.
- Shared with selected users.
- Shared with a workspace.
- Publicly accessible.

**Warning:** Do not publish proprietary database architecture, confidential business information, credentials, or sensitive information through public sharing features.

## 10. Third-Party Services

DB Nexus may rely on third-party services to provide certain functionality.

These services may include:

- Cloud infrastructure.
- Authentication providers.
- Database services.
- File storage.
- Email providers.
- Payment processors.
- Analytics services.
- Monitoring services.

Your use of certain third-party services may also be subject to their respective terms and privacy policies.

DB Nexus is not responsible for the independent operation of third-party services.

## 11. Platform Availability

DB Nexus is designed to provide a reliable and continuously available service.

However, we do not guarantee that the Platform will always be:

- Available.
- Error-free.
- Uninterrupted.
- Completely secure.
- Free from defects.

Service interruptions may occur because of:

- Scheduled maintenance.
- Infrastructure failures.
- Software updates.
- Network failures.
- Security incidents.
- Third-party service failures.
- Events outside our reasonable control.

## 12. Local-First and Cloud Synchronization

Certain DB Nexus functionality may use a **local-first architecture**, where schema drafts or temporary application state may be stored within your browser or local device before synchronization with a connected workspace.

Depending on the feature being used, data may subsequently be synchronized with DB Nexus cloud services.

Users are responsible for maintaining appropriate backups of important schemas and documentation.

**Note:** Local browser storage should not be considered a guaranteed backup or permanent storage mechanism.

## 13. Subscription Plans

Certain DB Nexus features may require a paid subscription.

Subscription plans may define:

| Category | Examples |
| --- | --- |
| **Users** | Number of workspace members |
| **Projects** | Number of available projects |
| **Storage** | Available cloud storage |
| **Collaboration** | Team collaboration capabilities |
| **Exports** | Supported export functionality |
| **Documentation** | Documentation capabilities |
| **API Usage** | API or integration limits |

Specific limits and features depend on the plan selected by the customer.

DB Nexus may introduce new plans or modify existing plans.

## 14. Billing and Renewal

Paid subscriptions are billed according to the billing period selected during purchase.

Depending on the applicable subscription:

- Subscriptions may automatically renew.
- Applicable taxes may be added.
- Payment information must remain valid.
- Subscription fees may be non-refundable except where required by law or explicitly stated otherwise.

You authorize DB Nexus or its payment provider to charge applicable subscription fees.

## 15. Cancellation

You may cancel a subscription using the cancellation mechanisms provided by DB Nexus.

Cancellation generally prevents future renewal but does not automatically provide a refund for a previously paid subscription period unless otherwise specified.

After cancellation or expiration:

- Paid features may become unavailable.
- Workspace limits may change.
- Export functionality may be restricted.
- Additional storage may no longer be available.

## 16. Data Export

DB Nexus may provide tools for exporting database schemas, diagrams, documentation, or other supported content.

Supported export formats may include:

- DBML.
- PostgreSQL SQL.
- MySQL SQL.
- Microsoft SQL Server SQL.
- SQLite SQL.
- SVG.
- PDF.
- Other formats introduced by the Platform.

Export availability may depend on the applicable plan.

**Tip:** We recommend maintaining independent backups of important database schemas and documentation.

## 17. Data Deletion

Users may request deletion of their account or applicable Customer Data.

When data is deleted, it may become permanently unrecoverable.

Certain information may be retained where reasonably necessary for:

- Legal compliance.
- Accounting requirements.
- Fraud prevention.
- Security investigations.
- Dispute resolution.
- Enforcement of contractual rights.
- Backup and disaster-recovery processes.

Backup copies may remain temporarily until they are overwritten or securely deleted according to applicable retention procedures.

## 18. Security

DB Nexus implements reasonable technical and organizational safeguards designed to protect Customer Data against unauthorized access, modification, disclosure, or destruction.

Security measures may include:

- Authentication controls.
- Authorization mechanisms.
- Access controls.
- Encryption where appropriate.
- Infrastructure security.
- Monitoring and logging.
- Backup and recovery procedures.

However, no Internet-based system can guarantee absolute security.

You are responsible for maintaining appropriate security practices when using the Platform.

## 19. Privacy

Your use of DB Nexus is also governed by the applicable **Privacy Policy**.

The Privacy Policy explains how DB Nexus may collect, use, store, process, and protect personal information.

Personal information may include information such as:

- Account information.
- Contact information.
- Authentication information.
- Usage information.
- Device and technical information.
- Workspace activity.

The Privacy Policy forms an important part of your relationship with DB Nexus.

## 20. Confidentiality

DB Nexus will treat Customer Data as confidential and will not intentionally disclose Customer Data except where reasonably necessary to:

- Provide the Service.
- Maintain the Platform.
- Provide customer support.
- Protect the security of the Platform.
- Prevent fraud or abuse.
- Comply with applicable law.
- Protect the rights or safety of users and third parties.

You are responsible for determining whether information is appropriate to store or share through DB Nexus.

## 21. Feedback

You may provide DB Nexus with suggestions, feature requests, ideas, or other feedback.

By submitting feedback, you grant DB Nexus the right to use that feedback to improve the Platform without compensation or obligation to you.

Feedback does not include your Customer Data.

## 22. Service Changes

DB Nexus may modify the Platform from time to time.

Changes may include:

- Adding new features.
- Improving existing features.
- Changing user interfaces.
- Removing obsolete functionality.
- Changing technical architecture.
- Introducing new subscription plans.

We may provide notice for material changes where reasonably appropriate.

## 23. Suspension and Termination

DB Nexus may suspend or terminate access to the Platform if:

- You materially violate these Terms.
- You fail to pay applicable fees.
- Your account presents a security risk.
- Your activities threaten the Platform or other users.
- You engage in fraudulent activity.
- Required by applicable law.

Where reasonably possible, DB Nexus may provide notice and an opportunity to resolve the issue before termination.

## 24. Disclaimer of Warranties

To the maximum extent permitted by applicable law, DB Nexus is provided on an **"AS IS"** and **"AS AVAILABLE"** basis.

DB Nexus does not guarantee that:

- The Platform will satisfy every business requirement.
- The Platform will always be available.
- The Platform will be completely error-free.
- All schemas will parse successfully.
- Generated SQL will be suitable for every production environment.
- Imported schemas will always exactly reproduce the original database.
- Data will never be lost.

You are responsible for reviewing generated SQL and validating database changes before applying them to production systems.

**Warning:** SQL generated by DB Nexus should always be reviewed and tested before being executed against a production database.

## 25. Limitation of Liability

To the maximum extent permitted by applicable law, DB Nexus will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages.

This may include damages resulting from:

- Loss of profits.
- Loss of revenue.
- Loss of business opportunities.
- Loss of data.
- Business interruption.
- Service interruption.
- Unauthorized access.
- Reliance on generated database scripts.

To the maximum extent permitted by law, DB Nexus's total liability arising from or relating to the Service will be limited to the amount paid by you for the Service during the applicable period preceding the event giving rise to the claim.

Nothing in these Terms excludes liability that cannot legally be excluded or limited.

## 26. Indemnification

You agree to defend, indemnify, and hold harmless DB Nexus and its operators, affiliates, employees, contractors, and service providers from claims, damages, liabilities, costs, and expenses arising from:

1. Your violation of these Terms.
2. Your misuse of the Platform.
3. Your Customer Data.
4. Your violation of applicable law.
5. Your infringement of third-party rights.
6. Unauthorized use of your account.

## 27. Changes to These Terms

DB Nexus may update these Terms from time to time.

When material changes are made, DB Nexus may provide reasonable notice through:

- The Platform.
- Website notifications.
- Email.
- Other appropriate communication methods.

Your continued use of DB Nexus after the updated Terms become effective constitutes acceptance of the revised Terms to the extent permitted by applicable law.

## 28. Governing Law

These Terms are governed by the laws applicable to the legal entity operating DB Nexus, unless otherwise required by applicable law.

Any dispute relating to DB Nexus will be handled by the courts or dispute-resolution mechanism having appropriate jurisdiction.

The applicable governing law and dispute-resolution provisions may be specified further in an enterprise agreement or other written agreement with DB Nexus.

## 29. Contact

If you have questions regarding these Terms, DB Nexus, your account, or Customer Data, please contact the DB Nexus support team through the contact information provided on the Platform.

**DB Nexus**
Database Schema Design & Collaboration Platform

**Important:** This Terms of Service document is intended as a product-policy draft for DB Nexus. It should be reviewed and finalized by a qualified legal professional before being published as the binding legal agreement for your company.
