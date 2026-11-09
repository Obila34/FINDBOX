CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS schools (id text PRIMARY KEY, name text NOT NULL, join_hash text UNIQUE NOT NULL, collection_days integer NOT NULL DEFAULT 7 CHECK(collection_days BETWEEN 1 AND 90));
CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('parent','student','staff','manager')), school_id text REFERENCES schools(id), verified boolean NOT NULL DEFAULT false, guardian_id text REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_tokens (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, name text NOT NULL, description text NOT NULL, price_minor integer NOT NULL CHECK(price_minor>0), tag_count integer NOT NULL CHECK(tag_count>0), format text NOT NULL, image text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), request_key text NOT NULL, amount_minor integer NOT NULL CHECK(amount_minor>0), currency text NOT NULL DEFAULT 'KES', lines jsonb NOT NULL, school_id text NOT NULL REFERENCES schools(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','fulfilled','cancelled','refunded','expired')), payment_reference text UNIQUE NOT NULL, payment_url text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS tags (id text PRIMARY KEY, code text UNIQUE NOT NULL, activation_hash text NOT NULL, format text NOT NULL, product_id text NOT NULL REFERENCES products(id), order_id text REFERENCES orders(id), owner_id text REFERENCES users(id), status text NOT NULL DEFAULT 'stock' CHECK(status IN ('stock','reserved','allocated','active','retired')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS tags_order_idx ON tags(order_id);
CREATE TABLE IF NOT EXISTS items (id text PRIMARY KEY, tag_id text UNIQUE NOT NULL REFERENCES tags(id), owner_id text NOT NULL REFERENCES users(id), school_id text NOT NULL REFERENCES schools(id), name text NOT NULL, category text NOT NULL, child_name text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '', private_note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'with_owner', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS items_owner_idx ON items(owner_id);
CREATE TABLE IF NOT EXISTS boxes (id text PRIMARY KEY, school_id text NOT NULL REFERENCES schools(id), name text NOT NULL, directions text NOT NULL, opening_hours text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS cases (id text PRIMARY KEY, school_id text NOT NULL REFERENCES schools(id), item_id text REFERENCES items(id), box_id text REFERENCES boxes(id), title text NOT NULL, category text NOT NULL, private_note text NOT NULL DEFAULT '', status text NOT NULL CHECK(status IN ('reported_lost','awaiting_deposit','awaiting_collection','unclaimed','returned','closed')), due_at timestamptz, collected_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS cases_school_idx ON cases(school_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS cases_one_open_item ON cases(item_id) WHERE status NOT IN ('returned','closed');
CREATE TABLE IF NOT EXISTS claims (id text PRIMARY KEY, case_id text NOT NULL REFERENCES cases(id), user_id text NOT NULL REFERENCES users(id), evidence text NOT NULL, status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected')), UNIQUE(case_id,user_id));
CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY, case_id text NOT NULL REFERENCES cases(id), actor_id text REFERENCES users(id), action text NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), subject text NOT NULL, body text NOT NULL, attempts integer NOT NULL DEFAULT 0, sent_at timestamptz, next_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS reminders (case_id text NOT NULL REFERENCES cases(id), phase text NOT NULL, PRIMARY KEY(case_id,phase));
CREATE TABLE IF NOT EXISTS checkins (user_id text NOT NULL REFERENCES users(id), day text NOT NULL, PRIMARY KEY(user_id,day));
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS family_invites (token_hash text PRIMARY KEY, parent_id text NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL);

-- Memberships and authenticated session context; legacy primary school stays compatible.
CREATE TABLE IF NOT EXISTS memberships (user_id text NOT NULL REFERENCES users(id), school_id text NOT NULL REFERENCES schools(id), role text NOT NULL CHECK(role IN ('parent','student','staff','manager')), PRIMARY KEY(user_id,school_id));
INSERT INTO memberships(user_id,school_id,role) SELECT id,school_id,role FROM users WHERE school_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version=2) ON CONFLICT DO NOTHING;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_step bigint NOT NULL DEFAULT -1;
CREATE TABLE IF NOT EXISTS oauth_states (token_hash text PRIMARY KEY, browser_hash text NOT NULL, nonce text NOT NULL, verifier text NOT NULL, link_user_id text REFERENCES users(id), expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS identities (provider text NOT NULL, subject text NOT NULL, user_id text NOT NULL REFERENCES users(id), PRIMARY KEY(provider,subject), UNIQUE(provider,user_id));
CREATE TABLE IF NOT EXISTS recovery_codes (user_id text NOT NULL REFERENCES users(id), code_hash text NOT NULL, PRIMARY KEY(user_id,code_hash));
CREATE TABLE IF NOT EXISTS audit_log (id text PRIMARY KEY, user_id text REFERENCES users(id), action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS privacy_requests (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('deletion','correction')), status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS privacy_request_pending ON privacy_requests(user_id,kind) WHERE status='pending';
CREATE TABLE IF NOT EXISTS throttle_buckets (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS throttle_expiry_idx ON throttle_buckets(expires_at);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS users_guardian_idx ON users(guardian_id);
CREATE INDEX IF NOT EXISTS users_school_idx ON users(school_id);
CREATE INDEX IF NOT EXISTS items_school_page_idx ON items(school_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS cases_school_page_idx ON cases(school_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS orders_user_page_idx ON orders(user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS stock_lookup_idx ON tags(product_id,status,created_at);
CREATE INDEX IF NOT EXISTS notifications_user_page_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(next_at) WHERE sent_at IS NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card';
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION initial_school_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.school_id IS NOT NULL THEN INSERT INTO memberships(user_id,school_id,role) VALUES(NEW.id,NEW.school_id,NEW.role) ON CONFLICT DO NOTHING; END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS initial_school_membership_trigger ON users;
CREATE TRIGGER initial_school_membership_trigger AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION initial_school_membership();

CREATE TABLE IF NOT EXISTS support_tickets (
 id text PRIMARY KEY, user_id text REFERENCES users(id), name text NOT NULL, email text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('general','school','order','bug','suggestion','feedback')),
 subject text NOT NULL, message text NOT NULL, context text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
 assigned_to text REFERENCES users(id), request_key text NOT NULL, scope text NOT NULL,
 referral_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(scope,request_key));
CREATE INDEX IF NOT EXISTS support_owner ON support_tickets(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_queue ON support_tickets(status,created_at DESC);
CREATE TABLE IF NOT EXISTS support_replies(id text PRIMARY KEY,ticket_id text NOT NULL REFERENCES support_tickets(id),actor_id text NOT NULL REFERENCES users(id),message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS referral_codes(user_id text PRIMARY KEY REFERENCES users(id),code text UNIQUE NOT NULL);
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS recipient_email text;

ALTER TABLE products ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS company_access (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('admin','developer')),
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_action_time_idx ON audit_log(action,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_user_time_idx ON audit_log(user_id,created_at DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE items ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS request_key text UNIQUE;
CREATE TABLE IF NOT EXISTS company_profile (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),data jsonb NOT NULL DEFAULT '{}',revision integer NOT NULL DEFAULT 1);
INSERT INTO company_profile(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS operation_audit (id text PRIMARY KEY,actor_id text NOT NULL REFERENCES users(id),action text NOT NULL,entity_id text NOT NULL,reason text NOT NULL,changes jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS operation_audit_time ON operation_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS announcements (id text PRIMARY KEY,request_key text UNIQUE,actor_id text NOT NULL REFERENCES users(id),title text NOT NULL,message text NOT NULL,audience text NOT NULL CHECK(audience IN ('all','company','school')),school_id text REFERENCES schools(id),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS announcement_reads (announcement_id text NOT NULL REFERENCES announcements(id),user_id text NOT NULL REFERENCES users(id),PRIMARY KEY(announcement_id,user_id));
CREATE SEQUENCE IF NOT EXISTS invoice_numbers;
CREATE TABLE IF NOT EXISTS invoices (id text PRIMARY KEY,client_id text NOT NULL REFERENCES users(id),request_key text UNIQUE NOT NULL,number text UNIQUE,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','proforma','issued','void')),issuer jsonb NOT NULL,customer jsonb NOT NULL,lines jsonb NOT NULL,total_minor integer NOT NULL CHECK(total_minor>0),due_date date NOT NULL,notes text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 1,created_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),issued_at timestamptz);
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS invoice_id text REFERENCES invoices(id);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_mail_once ON outbox(invoice_id) WHERE invoice_id IS NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS company_email_verified boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS company_email_challenges (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL,code_hash text NOT NULL,
 sent_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0,delivered boolean NOT NULL DEFAULT false);

CREATE TABLE IF NOT EXISTS daraja_sandbox_attempts (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id),request_key text NOT NULL,
 callback_hash text UNIQUE NOT NULL,checkout_id text UNIQUE,amount_kes integer NOT NULL CHECK(amount_kes BETWEEN 1 AND 1000),
 phone_suffix text NOT NULL,status text NOT NULL CHECK(status IN ('starting','pending','confirmed','failed','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_key));

-- School onboarding and student records are independent of child login accounts.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('pending','active','suspended','archived'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS privacy_basis text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS school_admin_invites(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),user_id text NOT NULL REFERENCES users(id),token_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,accepted_at timestamptz,cancelled_at timestamptz,created_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS students(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),school_reference text NOT NULL,name text NOT NULL,class_name text NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','left','transferred','archived')),guardian_email text NOT NULL DEFAULT '',guardian_id text REFERENCES users(id),guardian_verified_at timestamptz,consent_reference text NOT NULL,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(school_id,school_reference));
CREATE INDEX IF NOT EXISTS students_school_idx ON students(school_id,status,name);
CREATE TABLE IF NOT EXISTS student_guardian_invites(token_hash text PRIMARY KEY,student_id text NOT NULL REFERENCES students(id),email text NOT NULL,expires_at timestamptz NOT NULL,accepted_at timestamptz);
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id);
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE outbox ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_reference_ci ON students(school_id,lower(school_reference));
CREATE TABLE IF NOT EXISTS invoice_adjustments(id text PRIMARY KEY,invoice_id text NOT NULL REFERENCES invoices(id),request_key text NOT NULL UNIQUE,kind text NOT NULL CHECK(kind IN ('payment','credit')),amount_minor integer NOT NULL CHECK(amount_minor>0),reference text NOT NULL,reason text NOT NULL,actor_id text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,reference));
CREATE TABLE IF NOT EXISTS case_reviews(id text PRIMARY KEY,case_id text NOT NULL REFERENCES cases(id),school_id text NOT NULL REFERENCES schools(id),kind text NOT NULL CHECK(kind IN ('dispute','collection_authorisation','correction','disposal_request','disposal_approved','reopen')),note text NOT NULL,actor_id text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id text UNIQUE REFERENCES users(id);

CREATE TABLE IF NOT EXISTS runtime_heartbeat(name text PRIMARY KEY,last_ok timestamptz NOT NULL,last_error_at timestamptz);
CREATE TABLE IF NOT EXISTS runtime_alerts(name text PRIMARY KEY,state text NOT NULL,notified_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ownership_transfers(id text PRIMARY KEY,item_id text NOT NULL REFERENCES items(id),school_id text NOT NULL REFERENCES schools(id),from_user text NOT NULL REFERENCES users(id),to_user text NOT NULL REFERENCES users(id),from_approver text NOT NULL REFERENCES users(id),to_approver text NOT NULL REFERENCES users(id),from_approved boolean NOT NULL DEFAULT false,to_approved boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','rejected')),item_revision integer NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS ownership_transfer_pending ON ownership_transfers(item_id) WHERE status='pending';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS public_listing boolean NOT NULL DEFAULT false;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS public_listing boolean NOT NULL DEFAULT false;

-- Complimentary demonstration stock, separate from paid orders and sales.
CREATE TABLE IF NOT EXISTS demo_tag_grants (
 tag_id text PRIMARY KEY REFERENCES tags(id),
 owner_id text NOT NULL REFERENCES users(id),
 school_id text NOT NULL REFERENCES schools(id),
 created_by text NOT NULL REFERENCES users(id),
 request_key text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Portals, device-aware sessions and trusted devices.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS portal text CHECK(portal IS NULL OR portal IN ('family','school','ops'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS trusted_devices(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,label text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS trusted_devices_user ON trusted_devices(user_id);
CREATE TABLE IF NOT EXISTS known_devices(user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,label text NOT NULL,first_seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,label));
-- Lets school administrators share a parent join link without rotating the code.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS join_code_sealed text;
-- School administrators invite their own teachers through the same private invitation.
ALTER TABLE school_admin_invites ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'manager' CHECK(role IN ('manager','staff'));
-- Parents ask to add their child; the school approves before the child joins the roster.
CREATE TABLE IF NOT EXISTS child_requests(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),guardian_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,class_name text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),student_id text REFERENCES students(id),decided_by text REFERENCES users(id),decided_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS child_requests_school ON child_requests(school_id,status);
-- Passkeys and their short-lived sign-in challenges.
CREATE TABLE IF NOT EXISTS passkeys(id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,public_key text NOT NULL,counter bigint NOT NULL DEFAULT 0,transports text NOT NULL DEFAULT '',label text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id);
CREATE TABLE IF NOT EXISTS webauthn_challenges(token_hash text PRIMARY KEY,challenge text NOT NULL,user_id text REFERENCES users(id) ON DELETE CASCADE,purpose text NOT NULL CHECK(purpose IN ('register','login')),expires_at timestamptz NOT NULL);
-- Personal profile: photo, tagline, accent colour and emoji.
CREATE TABLE IF NOT EXISTS user_profiles(user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,avatar text,tagline text NOT NULL DEFAULT '',accent text NOT NULL DEFAULT 'sage',emoji text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now());
-- Operations assistant: conversations, messages and proposed actions awaiting confirmation.
CREATE TABLE IF NOT EXISTS assistant_conversations(id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,title text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS assistant_conversations_user ON assistant_conversations(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS assistant_messages(id text PRIMARY KEY,conversation_id text NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,role text NOT NULL CHECK(role IN ('user','assistant')),content text NOT NULL,data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS assistant_messages_conversation ON assistant_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS assistant_actions(id text PRIMARY KEY,conversation_id text NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,tool text NOT NULL,summary text NOT NULL,details jsonb NOT NULL DEFAULT '[]',request jsonb NOT NULL,status text NOT NULL CHECK(status IN ('pending','done','cancelled','failed')),result jsonb,error text,created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz);
-- One QR per child: the child's code is printed on every label, and each item of that child hangs off it.
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_tag_id_key;
CREATE INDEX IF NOT EXISTS items_tag_idx ON items(tag_id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS student_id text REFERENCES students(id);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS student_id text REFERENCES students(id);
ALTER TABLE tags ALTER COLUMN product_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tags_one_child_code ON tags(student_id) WHERE student_id IS NOT NULL AND status='active';
-- Link existing family items to the child they were named for, and adopt that child's first tag as their code.
UPDATE items i SET student_id=s.id FROM students s WHERE i.student_id IS NULL AND s.guardian_id=i.owner_id AND i.child_name<>'' AND lower(s.name)=lower(i.child_name);
UPDATE tags t SET student_id=x.sid FROM (SELECT DISTINCT ON (i.student_id) i.student_id AS sid,i.tag_id FROM items i JOIN tags tt ON tt.id=i.tag_id AND tt.status='active' WHERE i.student_id IS NOT NULL ORDER BY i.student_id,i.created_at) x WHERE t.id=x.tag_id AND t.student_id IS NULL AND NOT EXISTS(SELECT 1 FROM tags t2 WHERE t2.student_id=x.sid AND t2.status='active');
-- Houses: green, red, blue and yellow. Parents choose when adding a child; students can choose once after signing up.
ALTER TABLE students ADD COLUMN IF NOT EXISTS house text CHECK(house IN ('green','red','blue','yellow'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS house text CHECK(house IN ('green','red','blue','yellow'));
ALTER TABLE child_requests ADD COLUMN IF NOT EXISTS house text CHECK(house IN ('green','red','blue','yellow'));
-- Ubuntu stars: one per item a student returned to someone else, earned once the item is safely back.
CREATE TABLE IF NOT EXISTS house_stars(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),house text NOT NULL CHECK(house IN ('green','red','blue','yellow')),user_id text REFERENCES users(id) ON DELETE SET NULL,case_id text UNIQUE REFERENCES cases(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS house_stars_school_idx ON house_stars(school_id,created_at);
-- Kit orders: where the parcel goes, and which child's QR the labels carry.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery text NOT NULL DEFAULT 'school' CHECK(delivery IN ('school','home'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS student_id text REFERENCES students(id);
