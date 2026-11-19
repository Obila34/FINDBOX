# FindBox Operations CRM: requirements and build status

The operations workspace (ops.findbox.africa) is FindBox's CRM. This document maps what a proper CRM
needs onto what FindBox actually sells and to whom, and records what is built, what is partly built and
what is deliberately left for later.

Research inputs: the owner's own requirements list (five areas), small-business CRM feature guides,
CRM UX pattern write-ups, customer health-score frameworks and Kenya's Data Protection Act guidance
for education and children's data. Sources are listed at the end.

## 1. Who the customers are

A generic CRM talks about contacts, companies and deals. FindBox has its own shapes:

| CRM concept | FindBox meaning | Where the data lives |
|---|---|---|
| Lead / opportunity | A school that is not a partner yet | `crm_leads` (new) |
| Account / company | A partner school | `schools`, `boxes`, `memberships`, `students` |
| Contact | A parent or guardian (and school staff) | `users`, `students`, `orders` |
| Deal pipeline | School lead: New, Contacted, Demo, Proposal, Won, Lost | `crm_leads.stage` |
| Onboarding / success | School rollout: Invited, Setting up, Rolling out, Live, Paused | derived from live data |
| Orders | Label orders: To fulfil, To deliver, Delivered | `orders` |
| Tickets | Support requests: New, In progress, Resolved | `support_tickets` |
| Product outcome | Lost items that came home | `cases` |

Two operator roles use the workspace, with different jobs:

- **Company admin** runs the business: leads, schools, families, orders, support, invoices, announcements.
- **Developer** runs the platform: school access, accounts, items and labels, mail, privacy requests, health.

## 2. Requirements by area

Status key: **Built** (in the workspace now), **Partly** (works, with a stated limit), **Later** (not built; reason given).

### 2.1 Core data and customer records

| Requirement | Status | Notes |
|---|---|---|
| One customer record with everything linked | Built | The record panel for a school, family or lead shows facts, people, orders, tickets and one timeline |
| Chronological timeline per record | Built | Operator actions (audit), notes, tasks, orders, tickets and lead stage changes |
| Notes on any record (call, meeting, email, note) | Built | `crm_notes`; author and time kept; notes cannot be edited after saving |
| Duplicate detection | Built | Leads: same school name or contact email is refused with a pointer to the existing lead |
| Validation rules | Built | Required fields per stage: a lead cannot move to Proposal without an estimated size, or to Lost without a reason |
| Role-based access | Built | Admin and developer see different sections; every endpoint checks the role server-side |
| Audit trail | Built | Every change writes to `operation_audit` with actor, reason and before/after |
| Custom objects and fields | Later | The schema is fixed on purpose; add columns as the business needs them |
| Bulk enrichment / import | Later | No lead volume yet to justify it; CSV export exists |

### 2.2 Lead generation and marketing

| Requirement | Status | Notes |
|---|---|---|
| Lead capture into the CRM | Built | "Enquire for your school" on the website creates a support ticket; one click turns a school ticket into a lead. Leads can also be added by hand |
| Lead source tracking | Built | Source on every lead (website, referral, event, outreach, other) and a breakdown on the dashboard |
| Lead scoring | Built | 0 to 100 from fit (school size), intent (source, a booked next step) and engagement (notes, recent activity) |
| Segmentation | Partly | Filters by stage, owner, source and health; saved custom segments are later |
| Announcements to families and schools | Built | Existing announcements tool |
| Automated drip campaigns (email, SMS, WhatsApp) | Later | SMS and WhatsApp need paid provider accounts. Email nurture is possible on the existing mailer once there are enough leads |
| Multi-touch campaign attribution | Later | Needs ad-platform integrations; source tracking covers the current need |

### 2.3 Sales pipeline

| Requirement | Status | Notes |
|---|---|---|
| Visual pipeline with clear stages | Built | Kanban boards for leads, onboarding, orders and support |
| Entry and exit rules per stage | Built | See validation above; Won asks which school it became |
| Next step and follow-up date per deal | Built | Shown on the card; overdue next steps are flagged red and appear in Tasks |
| Stalled-deal alerts | Built | A lead with no activity for 7 days is marked "Stalled" and listed in Tasks |
| Tasks and reminders | Built | Tasks with owner, due date and linked record; "My tasks" and team view |
| Weighted forecast | Built | Pipeline value x stage probability on the leads board and dashboard |
| Win rate, cycle length, conversion by stage | Built | Dashboard |
| Quotes and invoices | Partly | Invoices with branded PDFs exist; quote builder and e-signature are later |
| Two-way email sync, call recording | Later | Needs Gmail/Outlook and telephony integrations; calls and emails are logged as notes for now |

### 2.4 Service and customer success

| Requirement | Status | Notes |
|---|---|---|
| Ticket queue with customer history | Built | Support board; the ticket panel shows the sender's record |
| Response-time targets | Built | A new ticket older than 24 hours, or an open one older than 72 hours, is flagged "Overdue" |
| Reply from the workspace | Built | Existing reply flow (emails the customer, keeps the thread) |
| School health score | Built | 0 to 100, green / amber / red. See section 3 |
| Churn-risk alerts | Built | Red schools appear in Tasks as "Check in with ..." |
| Renewal tracking | Later | No school contracts or renewal dates exist yet |
| Self-service help centre | Partly | Help page and FAQ exist; a searchable knowledge base is later |
| Omnichannel inbox (WhatsApp, phone, chat) | Later | Needs paid provider accounts |

### 2.5 Analytics, integrations and platform

| Requirement | Status | Notes |
|---|---|---|
| Executive dashboard | Built | New customers, return rate, pipeline, revenue, orders, support and school health |
| Activity feed | Built | Everything operators did, filterable |
| Team view | Built | Operators, role and last activity in the sidebar |
| AI assist | Built | The self-hosted assistant (no paid API) is one click away in the sidebar |
| CSV export | Built | Customers and leads |
| Mobile | Partly | The workspace works on a phone (sidebar collapses, boards scroll sideways); no offline mode |
| Accounting / ERP sync, webhooks, public API | Later | No external systems to sync with yet |

### 2.6 Privacy and compliance (Kenya Data Protection Act)

| Requirement | Status | Notes |
|---|---|---|
| Children's data minimised | Built | Boards and dashboards never show children's names; a family's record shows them only to the roles that fulfil labels |
| Guardian consent recorded | Built | `students.consent_reference`, guardian verification time |
| Data subject requests | Built | Privacy requests queue (developer); export and deletion requests from the app |
| Access is logged | Built | Opening a customer record writes an audit entry |
| Reason required for risky actions | Built | Existing rule: access, ownership and money changes need a written reason and a recent sign-in |

## 3. School health score

Weighted, not averaged, following the common customer-success pattern (usage, adoption, support,
commercial), adapted to what FindBox can measure:

| Signal | Weight | Measured as |
|---|---|---|
| Adoption | 35 | Share of rostered students with a linked guardian |
| Usage | 30 | Items labelled per linked family, and scans or returns in the last 30 days |
| Outcomes | 15 | Share of lost items that came home in the last 90 days |
| Setup | 10 | Has an active collection box and at least one school manager |
| Support | 10 | No open tickets older than 72 hours from this school |

Green is 70 and above, amber 40 to 69, red below 40. A school younger than 14 days is shown as "New"
instead of red, so onboarding schools do not raise false alarms. The weights are a starting point and
should be checked against which schools actually stay.

## 4. Layout

Modelled on the reference the owner supplied: a calm, light workspace.

- **Left sidebar:** workspace links with counts, pipelines, role-specific sections, team members, signed-in operator and sign out.
- **Top bar:** search, sort, filters, "Me" (only my records) and one primary Add button whose meaning follows the page.
- **Summary band:** a small bar chart, a gauge and two headline numbers that link to their detail.
- **Boards:** columns with a count and sort, cards with a title, one line of context, a date chip and note/task counts. The open card is highlighted.
- **Record panel:** slides in from the right; facts, health, timeline, notes, tasks and related records.

## 5. Sources

- Nutshell, "What CRM features do small businesses actually use?": https://www.nutshell.com/blog/most-important-crm-features-small-businesses
- Eleken, "CRM UX design": https://www.eleken.co/blog-posts/crm-ux-design
- Lazarev, "CRM dashboard design": https://www.lazarev.agency/articles/crm-dashboard-design
- Explo, "CRM dashboards: key elements and best practices": https://explo.co/blog/crm-dashboards-key-elements-best-practices
- Basedash, "How to build a customer health score": https://www.basedash.com/blog/how-to-build-a-customer-health-score-signals-weighting-and-sql
- Enterpret, "The 5 inputs a customer health score needs beyond product usage": https://www.enterpret.com/guides/the-5-inputs-a-customer-health-score-needs-beyond-product-usage
- Meritto, "CRM for EdTech": https://meritto.com/crm-for-edtech/
- ODPC, Guidance Note for the Education Sector: https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-for-the-Education-Sector.pdf
- ODPC, Guidance Note for Processing Children's Data: https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-–-Guidance-Note-for-Processing-Childrens-Data.pdf
- DLA Piper, Data Protection in Kenya: https://www.dlapiperdataprotection.com/?c=KE&t=law
