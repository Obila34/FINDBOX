import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, Clock, House, MapPin, Package, PackageCheck, ScanLine, School } from "lucide-react";
import type { User, Workspace } from "./api";

/** Home for parents, students and teachers: greeting, live counts, quick actions and first steps. */
export function HomeDashboard({ user, workspace, staff }: { user: User; workspace: Workspace; staff: boolean }) {
                  const waiting = workspace.cases.filter((c) => c.status === "awaiting_collection");
                  const overdue = waiting.filter((c) => c.due_at && Date.parse(c.due_at) < Date.now());
                  const incoming = workspace.cases.filter((c) => ["awaiting_deposit", "reported_lost"].includes(c.status));
                  const open = workspace.cases.filter((c) => !["returned", "closed"].includes(c.status));
                  const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
                  const steps = staff ? [] : [
                    { done: user.verified, label: "Verify your email", hint: "Check your inbox for our link.", to: "" },
                    { done: !!workspace.school, label: "Join your school", hint: "Use your school's link or poster.", to: "/app/security" },
                    { done: user.role === "student" || workspace.children.length > 0, label: "Add your child", hint: "Your school approves it.", to: "/app/children" },
                    { done: workspace.orders.length > 0 || workspace.items.length > 0, label: "Get a tag pack", hint: "Stickers, labels and tags.", to: "/app/shop" },
                    { done: workspace.items.length > 0, label: "Activate your tags", hint: "One code activates the whole pack.", to: "/app/register" },
                  ];
                  const left = steps.filter((x) => !x.done).length;
                  const kpi = (to: string, tone: string, Icon: typeof House, label: string, value: number, hint: string) => (
                    <Link to={to} className={"db-kpi tone-" + tone}><div className="db-kpi-top"><span className="db-kpi-icon"><Icon size={18} /></span><span className="db-kpi-label">{label}</span></div><strong>{value}</strong><div className="db-kpi-foot"><small>{hint}</small></div></Link>
                  );
                  return (
                    <div className="db-vars fp-dash">
                      <section className="db-hero fp-hero2">
                        <div className="db-hero-art" aria-hidden="true"><i /><i /><i /></div>
                        <div className="db-hero-main">
                          <span className={"db-status is-" + ((staff ? overdue.length : waiting.length) ? "warning" : "good")}><i />
                            {staff
                              ? overdue.length ? `${overdue.length} past the collection date` : waiting.length ? `${waiting.length} waiting for families` : "All clear today"
                              : waiting.length ? `${waiting.length} ${waiting.length === 1 ? "item is" : "items are"} waiting for you` : "Nothing lost right now"}
                          </span>
                          <h1>{hello}, {user.name.split(" ")[0]}.</h1>
                          <p>{staff ? "Receive found items, then hand them back to their families." : "Your belongings, tags and school, all in one place."}</p>
                          <div className="db-quick">
                            {staff ? <>
                              <Link to="/manage/log"><ScanLine size={17} />Receive an item</Link>
                              <Link to="/manage/collect"><PackageCheck size={17} />Hand back</Link>
                              {user.role === "manager" && <Link to="/app/school-admin"><School size={17} />School workspace</Link>}
                            </> : <>
                              <Link to="/app/register"><ScanLine size={17} />Activate tags</Link>
                              <Link to="/app/report"><AlertTriangle size={17} />Report something lost</Link>
                              <Link to="/app/found"><PackageCheck size={17} />I found something</Link>
                            </>}
                          </div>
                        </div>
                      </section>
                      <div className="db-kpis">
                        {staff ? <>
                          {kpi("/manage/collect", "amber", Clock, "Waiting for families", waiting.length, "Ready to hand back")}
                          {kpi("/manage/collect", "coral", AlertTriangle, "Past collection date", overdue.length, "Remind or extend")}
                          {kpi("/manage", "sky", ScanLine, "To receive", incoming.length, "Reported or on the way")}
                          {kpi("/app/boxes", "mint", MapPin, "Collection boxes", workspace.boxes.length, "Where items wait")}
                        </> : <>
                          {kpi("/app/items", "mint", Package, "Belongings", workspace.items.length, "Protected by a tag")}
                          {kpi("/app/cases", "amber", Clock, "Waiting for you", waiting.length, "Ready to collect")}
                          {kpi("/app/cases", "sky", AlertTriangle, "Open recoveries", open.length, "Being looked for")}
                          {kpi("/app/boxes", "lilac", MapPin, "Collection boxes", workspace.boxes.length, "At your school")}
                        </>}
                      </div>
                      {left > 0 && (
                        <section className="db-card fp-steps">
                          <header><h3><CheckCircle2 size={18} />Getting started</h3><span className="fp-steps-count">{steps.length - left} of {steps.length} done</span></header>
                          <div className="fp-steps-bar"><span style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} /></div>
                          <ol>{steps.map((x, i) => (
                            <li key={x.label} className={x.done ? "is-done" : ""}>
                              <span className="sa-step">{x.done ? <Check size={15} /> : i + 1}</span>
                              <div><strong>{x.label}</strong><small>{x.hint}</small></div>
                              {!x.done && x.to && <Link to={x.to}>Start <ArrowUpRight size={14} /></Link>}
                            </li>
                          ))}</ol>
                        </section>
                      )}
                    </div>
                  );
}
