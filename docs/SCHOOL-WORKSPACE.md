# FindBox for schools: the principal's workspace and the staff app

Two different people use FindBox inside a school, with different jobs and different devices:

- **The principal (school administrator)** decides and oversees, at a desk. They use the school
  workspace at school.findbox.africa, which matches the operations workspace in layout and feel.
- **Staff who handle lost and found** (teachers, office staff, caretakers) log and hand back items,
  on their feet. They use the staff app on their phone.

Research inputs: published school and university lost-and-found policies, lost-and-found software
workflows, chain-of-custody practice, and guidance on what school leaders need from a dashboard.
Sources are listed at the end.

## 1. What the research says

**Lost and found**

- Log every item when it arrives: what it is, where it was found, who logged it, where it is stored.
- A photo and a category at intake make items findable later.
- Keep a private identifying detail that only the real owner would know, and use it to check claims.
- Record every handover: who collected it and how ownership was checked. Verbal claims with no check are where items go to the wrong person.
- Hold unclaimed items for a fixed period (schools commonly use about 30 days), then donate. Tell families before the deadline.
- Two people should agree before anything is given away.
- Keep the trail of who handled the item and when (chain of custody).

**What a principal needs**

- A short list of exceptions that need a decision, not a wall of numbers.
- A few measures tied to a decision: is the rollout working, are items getting home, who is doing the work.
- One simple next action from each item on the list.
- A report they can show to the board or parents each term.

## 2. The principal's workspace

| Area | What it does | Status |
|---|---|---|
| Overview | "Needs your decision" list, lost-and-found numbers, rollout health, houses, staff activity | Built |
| Summary band | Items found and returned per day, share of items back with owners, waiting in a box, waiting for approval | Built |
| Lost and found board | Reported lost, On its way, In the box, Unclaimed, Returned. Search, sort, filter by kind or overdue | Built |
| Item panel | Photo, owner, class, parent, collection date, actions and the custody trail | Built |
| Approvals | Parents adding a child, claims on unclaimed items, donation requests, in one place | Built |
| Students | Roster with search and status filter, add and edit, CSV import with a check before saving, export, house, invite a parent | Built |
| Families | Parent invitation link with QR and printable poster, new link, how many students are linked | Built |
| Staff | Team with last activity and items handled, invite a teacher, cancel an invitation, remove access | Built |
| Houses | Standings and who belongs where | Built |
| Collection boxes | Add and edit boxes, opening hours, in use or not | Built |
| Report | 30 days, term or year: items logged, returned, return rate, days to return; by kind, class, house and box; staff activity; export and print | Built |
| Settings | School contact, privacy basis, setup checklist, password and security, sign out | Built |
| Messages to parents from the school | Later | The company sends announcements today; school-sent messages need moderation rules first |
| Per-student loss history | Later | Left out on purpose for now: the report goes down to class level so no child is singled out |

## 3. The staff app

| Area | What it does | Status |
|---|---|---|
| Home | One big "Receive an item" button, four counts (to receive, in the box, overdue, unclaimed), what needs attention, where the boxes are | Built |
| Receive | Scan the item's QR and choose the box. No QR: describe it, add a photo and a private identifying detail | Built |
| Items | Search by item, student or class; filter by To receive, In the box, Overdue, Unclaimed, Returned | Built |
| Item sheet | Whose it is, class, parent, collection date; receive, hand back, give more time, ask to donate, raise or resolve an ownership dispute, review claims | Built |
| Hand back | Requires a note of who collected and how ownership was checked; saved on the record | Built |
| Custody trail | Every step with who did it and when | Built |
| Inbox | Notifications, mark all read | Built |
| Me | Role, school, light or dark, password and security, sign out; administrators get a link to the school workspace | Built |
| Works offline | Later | Needs a local queue that syncs when the phone is back online |
| Signature capture at hand-back | Later | The written check covers the need today |

## 4. Rules the system enforces

- **Hand-back needs a check.** Staff must write who collected the item and how they checked.
- **Disputed items are frozen.** An item with an open ownership dispute cannot be handed back until someone records how it was resolved.
- **Donation needs two people.** A staff member asks; the principal, a different person, approves. Only items past their collection date, or unclaimed for 30 days, can be donated.
- **Claims are checked against the private detail** staff recorded at intake.
- **Roles.** Teachers do not see the principal's figures or the term report. Parents and students cannot reach either tool.
- **Everything is on the record.** Each action is written to the item's custody trail and the school's audit history.

## 5. Sources

- Harvard Law School, Lost and Found Policy: https://hls.harvard.edu/facilities/campus-safety/hls-lost-and-found-policy
- Penn State, Procedure AD2001 Lost and Found Items: https://guru.psu.edu/Procedures/AD2001
- Iowa State University, "Lost and Found: how it works here": https://inside.iastate.edu/article/2012/11/29/lost
- Brigham Young University, Lost and Found procedures: https://lostandfound.byu.edu/procedures
- Minnetonka Schools, Lost and Found: https://ja.minnetonkaschools.org/schools/elementary/cs/parents/lost-and-found
- Aerosimple, Lost and Found: https://www.aerosimple.com/solutions/lost-and-found
- Gitnux, lost and found software overview: https://gitnux.org/best/lost-and-found-software/
- DEV Community, "Data dashboards every principal should have": https://dev.to/pulse-connect/data-dashboards-every-principal-should-have-3h8k
- DEV Community, "What data principals actually need each week": https://dev.to/pulse-connect/what-data-principals-actually-need-each-week-419l
- DaSy Center, dashboards toolkit: https://dasycenter.org/datavis-toolkit/dashboards/
