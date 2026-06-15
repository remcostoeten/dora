import type { TRouteConfig } from '@/core/config/routes'

export type TGuideStep = {
    title: string
    body: string
}

export type TGuideConfig = {
    slug: string
    provider: string
    logo: string
    engine: 'PostgreSQL' | 'MySQL' | 'libSQL'
    title: string
    description: string
    lead: string
    keywords: string[]
    connectionString: string
    intro: string[]
    steps: TGuideStep[]
    notes: string[]
}

export const GUIDES_INDEX = {
    path: '/docs',
    title: 'Dora docs',
    description:
        'Connection guides and setup docs for Dora — connect Supabase, Neon, Turso, and any Postgres or libSQL database to the desktop app.',
    lead: 'Step-by-step guides for connecting your databases to Dora. Pick your host below — anything that speaks Postgres or libSQL works the same way.'
} as const

export const GUIDES: TGuideConfig[] = [
    {
        slug: 'supabase',
        provider: 'Supabase',
        logo: '/providers/supabase.svg',
        engine: 'PostgreSQL',
        title: 'Connect Supabase to Dora',
        description:
            'Connect Supabase to Dora, the desktop database GUI, in one click with OAuth — authorize in the browser and pick a project. Or paste the connection string the classic way.',
        lead: 'Supabase is the one provider Dora connects to with a single click: authorize in your browser, pick a project, and Dora builds the connection for you. Pasting a connection string still works too.',
        keywords: [
            'supabase gui',
            'supabase desktop client',
            'supabase database gui',
            'connect supabase postgres',
            'supabase sql client',
            'supabase oauth',
            'connect supabase one click'
        ],
        connectionString:
            'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres',
        intro: [
            'Every Supabase project is a full Postgres database, so Dora can always connect with a standard connection string. But Supabase is also a first-class integration: connect your account once and Dora lists your projects and assembles the connection details for you — no host, port, or pooler URL to look up.',
            'Authorization happens in your browser over OAuth. Dora never sees your Supabase account password; it receives a scoped token that is encrypted and stored only on your machine, and your project data never passes through Dora\'s servers.'
        ],
        steps: [
            {
                title: 'Choose Supabase and click "Connect with Supabase"',
                body: 'In Dora, create a new connection, pick Supabase from the provider grid, and click "Connect with Supabase". Your browser opens to the Supabase authorization screen.'
            },
            {
                title: 'Authorize Dora in the browser',
                body: 'Approve access on the Supabase screen. Dora stores the returned token encrypted on your device and brings you back to the app, now connected to your account.'
            },
            {
                title: 'Pick a project and connection mode',
                body: 'Dora lists your Supabase projects — search and select one. Choose a connection mode: Session pooler is recommended for a desktop client. Dora resolves the correct pooler host for that project automatically.'
            },
            {
                title: 'Enter the database password and connect',
                body: 'Supabase does not expose the database password through its API, so enter it once (reset it under Project Settings → Database if needed). Dora builds the connection and your schemas and tables appear in the sidebar.'
            }
        ],
        notes: [
            'The OAuth token is scoped and encrypted on your device. You can disconnect at any time from the connect dialog to remove the stored credentials.',
            'Connection modes: Session pooler (port 5432) is the right default for a desktop client; Transaction mode suits high-concurrency/serverless use; Direct is a persistent direct connection. Supabase requires SSL, which Dora applies automatically.',
            'Prefer not to authorize with OAuth? Click "Use a personal access token instead" and paste a token from supabase.com/dashboard/account/tokens — Dora lists your projects the same way.',
            'Fully manual path: in the Supabase dashboard go to Project Settings → Database, copy the URI connection string (postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres), and paste it into Dora. It parses the host, port, user, and database for you.'
        ]
    },
    {
        slug: 'neon',
        provider: 'Neon',
        logo: '/providers/neon.svg',
        engine: 'PostgreSQL',
        title: 'Connect Neon to Dora',
        description:
            'Connect a Neon serverless Postgres database to Dora, the desktop database GUI. Paste the Neon connection string, browse branches, and run SQL.',
        lead: 'Neon is serverless Postgres. Dora connects with the connection string from your Neon dashboard — here is where to find it.',
        keywords: [
            'neon database client',
            'neon postgres gui',
            'connect neon database',
            'neon desktop client',
            'neon sql client'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[ENDPOINT].neon.tech/[DBNAME]?sslmode=require',
        intro: [
            'Neon is standard Postgres with a serverless, branchable backend. From a client like Dora, it behaves exactly like any other Postgres database — paste the string and go.',
            'Each Neon branch has its own connection string, so you can point Dora at production, a preview branch, or a throwaway branch independently.'
        ],
        steps: [
            {
                title: 'Open Connection Details in Neon',
                body: 'In the Neon Console, open your project and find the "Connection Details" widget on the dashboard. Pick the branch and database you want to connect to.'
            },
            {
                title: 'Copy the connection string',
                body: 'Copy the connection string. It looks like postgresql://[USER]:[PASSWORD]@[ENDPOINT].neon.tech/[DBNAME]?sslmode=require. Reveal and include the password.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the string. Dora reads the host, database, user, and the sslmode parameter automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Test the connection, then connect. Neon tables and schemas load into the sidebar.'
            }
        ],
        notes: [
            'Neon requires SSL (sslmode=require). Keep that parameter in the string and Dora will connect securely.',
            'Neon offers a pooled connection (an endpoint with a -pooler suffix) and a direct one. For a desktop GUI, the direct endpoint is usually the right choice.',
            'To inspect a different branch, copy that branch’s connection string from the Console and add it as a separate connection in Dora.'
        ]
    },
    {
        slug: 'turso',
        provider: 'Turso',
        logo: '/providers/libsql.svg',
        engine: 'libSQL',
        title: 'Connect Turso to Dora',
        description:
            'Connect a Turso libSQL database to Dora, the desktop database GUI. Use the libsql:// URL and an auth token to browse and query your edge database.',
        lead: 'Turso runs libSQL (a SQLite fork). Dora connects with the database URL and an auth token from the Turso CLI — here is how.',
        keywords: [
            'turso desktop client',
            'turso gui',
            'libsql client',
            'connect turso database',
            'turso sql client'
        ],
        connectionString: 'libsql://[DATABASE]-[ORG].turso.io?authToken=[TOKEN]',
        intro: [
            'Turso databases speak libSQL, a fork of SQLite with a network protocol. Dora has a native libSQL path, so you connect with a URL plus an auth token instead of a username and password.',
            'You get the data viewer and SQL editor over your remote Turso database, the same as you would for a local SQLite file.'
        ],
        steps: [
            {
                title: 'Get the database URL',
                body: 'Run turso db show [DATABASE] in your terminal. Copy the URL — it looks like libsql://[DATABASE]-[ORG].turso.io.'
            },
            {
                title: 'Create an auth token',
                body: 'Run turso db tokens create [DATABASE] to mint a token. Copy it — Dora uses this in place of a password.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new libSQL connection in Dora. Paste the libsql:// URL and the auth token (or paste the full libsql://...?authToken=... string and Dora will split it out).'
            },
            {
                title: 'Test and connect',
                body: 'Test, then connect. Your Turso tables appear in the sidebar, ready to browse and query.'
            }
        ],
        notes: [
            'Auth tokens can be scoped and rotated. If a connection stops working, mint a fresh token with turso db tokens create.',
            'You can also point Dora at a local libSQL/SQLite file — the same engine, no token needed.',
            'Install the Turso CLI from the Turso docs if you do not have it; the dashboard can also surface the database URL.'
        ]
    },
    // TODO: add railway logo at /providers/railway.svg
    {
        slug: 'railway',
        provider: 'Railway',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Railway to Dora',
        description:
            'Connect a Railway Postgres database to Dora, the desktop database GUI. Copy the connection string from the Railway dashboard and browse your data instantly.',
        lead: 'Railway provisions standard Postgres databases. Dora connects with a single connection string — here is where to find it.',
        keywords: [
            'railway database gui',
            'railway postgres client',
            'railway desktop client',
            'railway sql client',
            'railway database viewer'
        ],
        connectionString:
            'postgresql://postgres:[PASSWORD]@[HOST].railway.app:[PORT]/railway',
        intro: [
            'Railway databases are standard PostgreSQL. Dora talks to them over the normal Postgres protocol — there is no Railway-specific driver or configuration required.',
            'You get the full Dora workbench: data viewer, schema browser, and SQL editor, all pointing at your Railway database.'
        ],
        steps: [
            {
                title: 'Open your Railway project',
                body: 'In the Railway dashboard, open your project and click the Postgres service (or whichever database service you added).'
            },
            {
                title: 'Copy the connection string',
                body: 'Go to the Connect tab. Copy the "Postgres Connection URL" under Public Networking. It looks like postgresql://postgres:[PASSWORD]@[HOST].railway.app:[PORT]/railway.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the string. Dora parses the host, port, user, database, and password automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test to confirm connectivity, then Connect. Your Railway tables appear in the sidebar.'
            }
        ],
        notes: [
            'Railway enables SSL on Postgres by default. Dora applies SSL automatically when it detects a Railway host.',
            'Railway also exposes a private URL for use inside the platform. For the Dora desktop app running on your machine, use the Public Networking URL.',
            'If you rotate the database password in Railway, update the connection string in Dora to match.'
        ]
    },
    // TODO: add fly logo at /providers/fly.svg
    {
        slug: 'fly',
        provider: 'Fly.io',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Fly.io Postgres to Dora',
        description:
            'Connect a Fly.io Postgres database to Dora, the desktop database GUI. Use fly proxy to forward the port to localhost, then paste the connection string.',
        lead: 'Fly Postgres runs in a private network. You need to forward the port to localhost first — here is the one-command way to do it.',
        keywords: [
            'fly.io postgres gui',
            'fly postgres desktop client',
            'fly postgres sql client',
            'fly.io database viewer',
            'fly postgres connect'
        ],
        connectionString:
            'postgresql://postgres:[PASSWORD]@localhost:5432/[DBNAME]',
        intro: [
            'Fly Postgres instances live inside Fly\'s private network and are not reachable from the public internet by default. To connect from the Dora desktop app on your machine, you forward the Fly port to localhost using the Fly CLI. This is a Fly networking constraint, not a Dora limitation.',
            'Once the port is forwarded, Dora connects to it exactly like any other local Postgres — paste the connection string with localhost as the host and you are done.'
        ],
        steps: [
            {
                title: 'Install the Fly CLI and authenticate',
                body: 'Install flyctl from fly.io/docs/hands-on/install-flyctl and run fly auth login if you have not already.'
            },
            {
                title: 'Forward the Postgres port to localhost',
                body: 'Run: fly proxy 5432 -a [your-postgres-app-name]\n\nThis forwards Fly port 5432 to localhost:5432 on your machine. Keep the terminal open while you use Dora.'
            },
            {
                title: 'Get the database credentials',
                body: 'Run: fly postgres connect -a [your-postgres-app-name] — this prints the DATABASE_URL. Note the password and database name from it.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new Postgres connection in Dora with host localhost, port 5432, and the credentials from the previous step. Or paste the full connection string with localhost substituted as the host.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test (with fly proxy still running in the terminal), then Connect. Your Fly Postgres tables load into the sidebar.'
            }
        ],
        notes: [
            'fly proxy must be running in a terminal for the duration of your Dora session. Closing it drops the connection — this is a Fly networking requirement.',
            'If you are on a machine connected to Fly via WireGuard, you can use the .internal or .flycast address directly without fly proxy.',
            'For production databases, fly proxy is safer than opening public ports — it forwards traffic through an authenticated SSH channel.'
        ]
    },
    // TODO: add aiven logo at /providers/aiven.svg
    {
        slug: 'aiven',
        provider: 'Aiven',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Aiven to Dora',
        description:
            'Connect an Aiven PostgreSQL service to Dora, the desktop database GUI. Copy the service URI from the Aiven console and connect in seconds.',
        lead: 'Aiven provides managed PostgreSQL with mandatory SSL. Dora handles SSL automatically — paste the service URI and go.',
        keywords: [
            'aiven postgres gui',
            'aiven database client',
            'aiven desktop client',
            'aiven sql client',
            'aiven postgresql viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].aivencloud.com:[PORT]/[DBNAME]?sslmode=require',
        intro: [
            'Aiven runs managed PostgreSQL (and other engines) across multiple cloud providers. From Dora\'s perspective, it is a standard Postgres host — just paste the service URI.',
            'Aiven enforces SSL on all connections. Dora applies SSL automatically when it sees an Aiven host, so nothing extra is needed on your end.'
        ],
        steps: [
            {
                title: 'Open your Aiven service',
                body: 'In the Aiven Console, navigate to your project and open the PostgreSQL service you want to connect to.'
            },
            {
                title: 'Copy the Service URI',
                body: 'On the Overview tab, find the "Service URI" field. Click the copy icon. The URI looks like postgresql://[USER]:[PASSWORD]@[HOST].aivencloud.com:[PORT]/[DBNAME]?sslmode=require.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the Service URI. Dora reads all fields — host, port, user, password, database, and SSL mode — from the string.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test to verify the connection, then Connect. Your Aiven tables and schemas appear in the sidebar.'
            }
        ],
        notes: [
            'Aiven requires SSL (sslmode=require). The Service URI includes this parameter, and Dora respects it automatically.',
            'Aiven also provides a CA certificate for sslmode=verify-full. For most desktop use, sslmode=require is sufficient and simpler.',
            'If you use Aiven\'s connection pooler (PgBouncer), the Service URI changes — find the pooler-specific URI under Advanced configuration in the Aiven console.'
        ]
    },
    // TODO: add render logo at /providers/render.svg
    {
        slug: 'render',
        provider: 'Render',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Render to Dora',
        description:
            'Connect a Render PostgreSQL database to Dora, the desktop database GUI. Copy the external connection string from the Render dashboard and start querying.',
        lead: 'Render provides managed Postgres with an external connection string for desktop tools. Here is how to find it.',
        keywords: [
            'render postgres gui',
            'render database client',
            'render desktop client',
            'render sql client',
            'render postgresql viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].oregon-postgres.render.com/[DBNAME]',
        intro: [
            'Render PostgreSQL databases are standard Postgres. Dora connects to the external hostname Render exposes for tools running outside the Render network.',
            'No special configuration is needed in Dora — paste the connection string and the database is ready to browse.'
        ],
        steps: [
            {
                title: 'Open your Render database',
                body: 'In the Render dashboard, go to your PostgreSQL service and click on it to open the info page.'
            },
            {
                title: 'Copy the External Database URL',
                body: 'Scroll to the "Connections" section. Copy the "External Database URL". It looks like postgresql://[USER]:[PASSWORD]@[HOST].oregon-postgres.render.com/[DBNAME].'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the External Database URL. Dora parses the credentials and host automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Render tables and schemas load into the sidebar.'
            }
        ],
        notes: [
            'Use the External Database URL, not the Internal URL. The internal URL only works within the Render private network.',
            'Render free-tier databases expire after 90 days. Check your Render dashboard if a connection that worked previously stops responding.',
            'Render enables SSL on Postgres connections. Dora connects securely without any extra SSL configuration.'
        ]
    },
    // TODO: add digitalocean logo at /providers/digitalocean.svg
    {
        slug: 'digitalocean',
        provider: 'DigitalOcean',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect DigitalOcean Managed Postgres to Dora',
        description:
            'Connect a DigitalOcean Managed PostgreSQL cluster to Dora, the desktop database GUI. Copy the connection string from the control panel and browse your data.',
        lead: 'DigitalOcean Managed Postgres clusters expose a standard connection string. Dora connects to them with no extra setup.',
        keywords: [
            'digitalocean postgres gui',
            'digitalocean database client',
            'digitalocean desktop client',
            'digitalocean managed database viewer',
            'do postgres sql client'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].db.ondigitalocean.com:[PORT]/[DBNAME]?sslmode=require',
        intro: [
            'DigitalOcean Managed Databases provides hosted PostgreSQL and MySQL clusters. Dora connects to the public endpoint using the connection string from the control panel.',
            'SSL is required on DigitalOcean managed databases. Dora applies it automatically when it detects a DigitalOcean host.'
        ],
        steps: [
            {
                title: 'Open your cluster in the control panel',
                body: 'In the DigitalOcean control panel, go to Databases and open your Postgres cluster.'
            },
            {
                title: 'Copy the connection string',
                body: 'Click the "Connection Details" dropdown and select "Connection string" from the mode selector. Copy the URI. It ends with ?sslmode=require.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the connection string. Dora reads the host, port, user, password, database, and SSL parameter from it.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your cluster\'s schemas and tables appear in the sidebar.'
            }
        ],
        notes: [
            'DigitalOcean requires sslmode=require on all managed database connections. The copied string already contains this.',
            'Dora connects to the public endpoint. If you have restricted incoming IPs on the cluster, add your machine\'s IP in Databases → your cluster → Settings → Trusted Sources.',
            'DigitalOcean also offers MySQL managed databases. Add a MySQL connection in Dora and use the MySQL connection string from the same control panel page.'
        ]
    },
    {
        slug: 'planetscale',
        provider: 'PlanetScale',
        logo: '/providers/mysql.svg',
        engine: 'MySQL',
        title: 'Connect PlanetScale to Dora',
        description:
            'Connect a PlanetScale MySQL-compatible database to Dora, the desktop database GUI. Browse tables, run queries, and inspect schemas — note the FK caveat below.',
        lead: 'PlanetScale is MySQL-compatible (powered by Vitess). Dora connects with a standard MySQL connection string — note that foreign-key constraints are not enforced.',
        keywords: [
            'planetscale gui',
            'planetscale database client',
            'planetscale desktop client',
            'planetscale sql client',
            'planetscale mysql viewer'
        ],
        connectionString:
            'mysql://[USER]:[PASSWORD]@[HOST].connect.psdb.cloud/[DBNAME]',
        intro: [
            'PlanetScale databases speak the MySQL wire protocol via Vitess. Dora can connect to them as a MySQL database and lets you browse tables, run queries, and inspect the schema.',
            'One honest caveat: PlanetScale\'s Vitess backend does not enforce foreign-key constraints. Schema views in Dora will not show FK relationships, because none are stored. Browsing and querying work normally.'
        ],
        steps: [
            {
                title: 'Create a password in PlanetScale',
                body: 'In the PlanetScale dashboard, open your database, go to Settings → Passwords, and create a new password for your branch. Note the username, password, and host.'
            },
            {
                title: 'Copy the connection string',
                body: 'On the password detail page, select "MySQL CLI" or the "Connection string" format. Copy the string — it looks like mysql://[USER]:[PASSWORD]@[HOST].connect.psdb.cloud/[DBNAME].'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new MySQL connection in Dora and paste the connection string, or fill in host, port (3306), user, password, and database manually. Enable SSL in the connection options.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your PlanetScale tables and columns appear in the sidebar, ready to browse and query.'
            }
        ],
        notes: [
            'PlanetScale uses Vitess under the hood. Foreign-key constraints are not enforced, so FK relationships will not appear in Dora\'s schema view — this is a PlanetScale platform characteristic.',
            'PlanetScale requires SSL on all connections. Enable SSL in the Dora connection dialog when connecting to a psdb.cloud host.',
            'Each PlanetScale branch has its own credentials. Create a separate password per branch and add each as its own connection in Dora.'
        ]
    },
    // TODO: add aws-rds logo at /providers/aws-rds.svg
    {
        slug: 'aws-rds',
        provider: 'AWS RDS',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect AWS RDS to Dora',
        description:
            'Connect an AWS RDS PostgreSQL or MySQL instance to Dora, the desktop database GUI. Use the RDS endpoint from the AWS Console to connect directly.',
        lead: 'AWS RDS instances expose a standard Postgres or MySQL endpoint. Dora connects to it the same way any client would.',
        keywords: [
            'aws rds gui',
            'aws rds desktop client',
            'rds postgres client',
            'rds mysql gui',
            'aws rds sql client'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[INSTANCE].rds.amazonaws.com:5432/[DBNAME]',
        intro: [
            'AWS RDS (Relational Database Service) provides managed PostgreSQL and MySQL instances. Dora connects to them over the standard protocol using the instance endpoint from the AWS Console.',
            'RDS instances can be public or private. Public instances connect directly; private instances require an SSH tunnel or VPN — Dora\'s built-in SSH tunnel feature covers both cases.'
        ],
        steps: [
            {
                title: 'Find the RDS endpoint',
                body: 'In the AWS Console, open RDS → Databases and select your instance. Under the Connectivity & security tab, copy the Endpoint (it ends in .rds.amazonaws.com) and Port.'
            },
            {
                title: 'Ensure the security group allows your IP',
                body: 'In the same tab, open the VPC security group and add an inbound rule for port 5432 (Postgres) or 3306 (MySQL) from your machine\'s IP, if not already present.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora. Enter the RDS endpoint as the host, the port, your master username, password, and database name. Optionally enable SSL in the connection settings.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your RDS tables and schemas load into the Dora sidebar.'
            }
        ],
        notes: [
            'SSL is optional on AWS RDS but recommended. RDS supports sslmode=require; you can enable it in the Dora connection dialog.',
            'For private RDS instances inside a VPC, configure Dora\'s SSH tunnel to jump through a bastion host in the same VPC.',
            'Aurora PostgreSQL and Aurora MySQL are also compatible engines — Dora connects to them the same way using the cluster or instance endpoint.'
        ]
    },
    {
        slug: 'cockroachdb',
        provider: 'CockroachDB Cloud',
        logo: '/providers/cockroach.svg',
        engine: 'PostgreSQL',
        title: 'Connect CockroachDB Cloud to Dora',
        description:
            'Connect a CockroachDB Cloud cluster to Dora, the desktop database GUI. Dora has full CockroachDB dialect support — browse tables, inspect schemas, and run SQL.',
        lead: 'CockroachDB Cloud clusters expose a Postgres-compatible endpoint. Dora has native CockroachDB dialect support, so the connection string works as-is.',
        keywords: [
            'cockroachdb gui',
            'cockroachdb desktop client',
            'cockroachdb cloud client',
            'crdb sql client',
            'cockroachdb database viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].cockroachlabs.cloud:26257/[DBNAME]?sslmode=verify-full&options=--cluster=[CLUSTER-ID]',
        intro: [
            'CockroachDB Cloud clusters use a Postgres-compatible wire protocol. Dora ships with a dedicated CockroachDB dialect that handles CockroachDB\'s type system and SQL extensions correctly.',
            'The connection string from CockroachDB Cloud includes two important parameters: options=--cluster=<cluster-id> (required for serverless clusters to route traffic) and sslmode=verify-full. Keep both — Dora passes them through.'
        ],
        steps: [
            {
                title: 'Open Connection String in CockroachDB Cloud',
                body: 'In the CockroachDB Cloud Console, select your cluster and click Connect. Choose "Connection string" from the method selector.'
            },
            {
                title: 'Copy the connection string',
                body: 'Copy the full connection string. It looks like postgresql://[USER]:[PASSWORD]@[HOST].cockroachlabs.cloud:26257/[DBNAME]?sslmode=verify-full&options=--cluster=[CLUSTER-ID]. Keep the options=--cluster parameter — it is required for serverless clusters.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the string. Dora parses the host, port, database, SSL mode, and the options parameter automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Dora uses its CockroachDB dialect, and your cluster\'s tables and schemas appear in the sidebar.'
            }
        ],
        notes: [
            'Keep sslmode=verify-full in the connection string. CockroachDB Cloud requires it for all external connections.',
            'The options=--cluster=<id> parameter is required for CockroachDB Serverless to route connections to the correct virtual cluster. Do not remove it.',
            'Dora has full CockroachDB dialect support — introspection, type mapping, and SQL syntax all account for CockroachDB\'s differences from vanilla Postgres.'
        ]
    },
    // TODO: add tidb logo at /providers/tidb.svg
    {
        slug: 'tidb',
        provider: 'TiDB Cloud',
        logo: '/providers/mysql.svg',
        engine: 'MySQL',
        title: 'Connect TiDB Cloud to Dora',
        description:
            'Connect a TiDB Cloud cluster to Dora, the desktop database GUI. TiDB is MySQL-compatible — paste the connection string from the TiDB console and start querying.',
        lead: 'TiDB Cloud speaks the MySQL wire protocol. Dora connects with a standard MySQL connection string from your TiDB console.',
        keywords: [
            'tidb cloud gui',
            'tidb database client',
            'tidb desktop client',
            'tidb sql client',
            'tidb cloud mysql viewer'
        ],
        connectionString:
            'mysql://[USER]:[PASSWORD]@[HOST].tidbcloud.com:4000/[DBNAME]',
        intro: [
            'TiDB Cloud clusters are MySQL-compatible, so Dora connects to them using the MySQL protocol. Browse tables, run queries, and inspect your TiDB schema from the desktop.',
            'TiDB requires SSL on all Cloud connections. Dora applies SSL automatically when connecting to TiDB Cloud hosts.'
        ],
        steps: [
            {
                title: 'Open Connect in TiDB Cloud',
                body: 'In the TiDB Cloud console, select your cluster and click Connect. Choose "General" or "MySQL CLI" as the connection method.'
            },
            {
                title: 'Copy the connection details',
                body: 'Note the host (ending in .tidbcloud.com), port (4000), username, and password. Copy the connection string if shown, or assemble it from those details.'
            },
            {
                title: 'Add a MySQL connection in Dora',
                body: 'Create a new MySQL connection in Dora. Enter the TiDB host, port 4000, username, password, and database name. Enable SSL in the connection settings.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your TiDB tables appear in the sidebar ready to browse and query.'
            }
        ],
        notes: [
            'TiDB Cloud requires SSL. Enable SSL in the Dora connection dialog when connecting to a TiDB Cloud host.',
            'TiDB is MySQL-compatible but is a distributed database — some MySQL-specific behavior may differ. Standard SELECT, INSERT, UPDATE, and DDL queries work as expected.',
            'TiDB Serverless and TiDB Dedicated both use the same connection method. The port is 4000 by default for TiDB Cloud.'
        ]
    },
    // TODO: add vercel-postgres logo at /providers/vercel-postgres.svg
    {
        slug: 'vercel-postgres',
        provider: 'Vercel Postgres',
        logo: '/providers/neon.svg',
        engine: 'PostgreSQL',
        title: 'Connect Vercel Postgres to Dora',
        description:
            'Connect a Vercel Postgres database to Dora, the desktop database GUI. Vercel Postgres is powered by Neon — use the connection string from your Vercel project.',
        lead: 'Vercel Postgres is Neon under the hood. Grab the connection string from Vercel\'s Storage dashboard and paste it into Dora.',
        keywords: [
            'vercel postgres gui',
            'vercel postgres desktop client',
            'vercel postgres sql client',
            'vercel database viewer',
            'vercel neon postgres client'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].vercel-storage.com/[DBNAME]?sslmode=require',
        intro: [
            'Vercel Postgres databases are provisioned by Neon and exposed through Vercel\'s Storage interface. They accept standard Postgres connections, so Dora connects to them directly with the connection string from your project.',
            'Vercel exposes both pooled and unpooled connection strings. For the Dora desktop app, the unpooled (direct) string is the right choice — pooled connections are designed for short-lived serverless function calls.'
        ],
        steps: [
            {
                title: 'Open Storage in the Vercel dashboard',
                body: 'In your Vercel project, go to Storage and select your Postgres database.'
            },
            {
                title: 'Copy the connection string',
                body: 'Under the ".env.local" tab or the "Quickstart" section, find POSTGRES_URL_NON_POOLING. Copy that value — it is the direct connection string and looks like postgresql://...@...vercel-storage.com/...'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the string. Dora reads all the fields including sslmode from the URL.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Vercel Postgres tables load into the sidebar.'
            }
        ],
        notes: [
            'Prefer POSTGRES_URL_NON_POOLING for desktop client use. Pooled connections (POSTGRES_URL) are designed for serverless function lifecycles and may drop persistent sessions.',
            'Vercel Postgres requires SSL. The connection string already includes sslmode=require.',
            'Since Vercel Postgres runs on Neon, the Neon console (accessible from the Vercel Storage page) gives additional visibility into branches and usage.'
        ]
    },
    // TODO: add crunchy-bridge logo at /providers/crunchy-bridge.svg
    {
        slug: 'crunchy-bridge',
        provider: 'Crunchy Bridge',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Crunchy Bridge to Dora',
        description:
            'Connect a Crunchy Bridge managed PostgreSQL cluster to Dora, the desktop database GUI. Copy the connection URI from the Crunchy Data console and connect.',
        lead: 'Crunchy Bridge provides fully managed Postgres by Crunchy Data. Dora connects with the standard connection URI from your cluster\'s dashboard.',
        keywords: [
            'crunchy bridge gui',
            'crunchy bridge postgres client',
            'crunchy data desktop client',
            'crunchy bridge sql client',
            'crunchy bridge database viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@p.[CLUSTER-ID].crunchybridge.com:5432/[DBNAME]?sslmode=require',
        intro: [
            'Crunchy Bridge is managed PostgreSQL from Crunchy Data, focused on production-grade Postgres with no compromises on SQL compatibility. Dora connects to it using the standard URI.',
            'All Crunchy Bridge clusters require SSL. Dora handles this automatically when connecting to a crunchybridge.com host.'
        ],
        steps: [
            {
                title: 'Open your cluster in Crunchy Bridge',
                body: 'Log into the Crunchy Bridge console and select your cluster from the dashboard.'
            },
            {
                title: 'Copy the connection string',
                body: 'Navigate to the Connect tab. Copy the "Connection URI". It looks like postgresql://[USER]:[PASSWORD]@p.[CLUSTER-ID].crunchybridge.com:5432/[DBNAME]?sslmode=require.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the connection URI. Dora reads the host, port, credentials, database, and SSL mode automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Crunchy Bridge schemas and tables appear in the Dora sidebar.'
            }
        ],
        notes: [
            'Crunchy Bridge enforces sslmode=require on all connections. The copied URI includes this parameter.',
            'Crunchy Bridge also offers superuser and application-user roles. Use the application user (non-superuser) for day-to-day browsing in Dora.',
            'Crunchy Bridge supports PostGIS and other Postgres extensions. Dora\'s schema browser will reflect these extra types and functions.'
        ]
    },
    // TODO: add timescale logo at /providers/timescale.svg
    {
        slug: 'timescale',
        provider: 'Timescale Cloud',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Timescale Cloud to Dora',
        description:
            'Connect a Timescale Cloud database to Dora, the desktop database GUI. Timescale is Postgres with time-series extensions — connect with the standard URI.',
        lead: 'Timescale Cloud is PostgreSQL with TimescaleDB extensions. Dora connects with a standard Postgres URI from the Timescale console.',
        keywords: [
            'timescale cloud gui',
            'timescaledb desktop client',
            'timescale postgres client',
            'timescale sql client',
            'timescale database viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[HOST].tsdb.io:5432/[DBNAME]?sslmode=require',
        intro: [
            'Timescale Cloud runs PostgreSQL with the TimescaleDB extension for time-series workloads. Dora connects to it using a standard Postgres connection string.',
            'You can browse hypertables, regular tables, and continuous aggregates in Dora the same way you browse any Postgres database. TimescaleDB-specific objects appear in the schema view.'
        ],
        steps: [
            {
                title: 'Open your service in Timescale Cloud',
                body: 'Log into the Timescale Cloud console and select your service.'
            },
            {
                title: 'Copy the service URL',
                body: 'On the Overview page, find the "Service URL" or "Connection info" section. Copy the full connection string. It ends with ?sslmode=require.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the service URL. Dora reads all connection parameters including SSL mode.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Timescale tables — including hypertables — appear in the Dora sidebar.'
            }
        ],
        notes: [
            'Timescale Cloud requires SSL (sslmode=require). The connection string from the console already includes this.',
            'Hypertables are exposed as regular tables in Dora\'s schema browser. You can query them with standard SQL, including TimescaleDB time-series functions.',
            'The Timescale console also provides a built-in SQL editor, but Dora gives you a richer desktop experience with schema diagrams and query history.'
        ]
    },
    // TODO: add azure logo at /providers/azure.svg
    {
        slug: 'azure',
        provider: 'Azure Database',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Azure Database for PostgreSQL to Dora',
        description:
            'Connect Azure Database for PostgreSQL (Flexible Server or Single Server) to Dora, the desktop database GUI. Copy the connection string from the Azure portal.',
        lead: 'Azure Database for PostgreSQL exposes a standard Postgres endpoint. Dora connects with the server name and credentials from the Azure portal.',
        keywords: [
            'azure postgres gui',
            'azure database desktop client',
            'azure postgresql client',
            'azure database sql client',
            'azure flexible server viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[SERVER].postgres.database.azure.com:5432/[DBNAME]?sslmode=require',
        intro: [
            'Azure Database for PostgreSQL (both Flexible Server and the legacy Single Server) runs standard Postgres with an endpoint under .postgres.database.azure.com. Dora connects to it the same way any Postgres client does.',
            'Azure requires SSL on managed Postgres connections by default. Dora applies SSL automatically.'
        ],
        steps: [
            {
                title: 'Open your server in the Azure portal',
                body: 'In the Azure portal, navigate to your Azure Database for PostgreSQL resource.'
            },
            {
                title: 'Find the connection string',
                body: 'Under Settings → Connection strings, select "psql" or "ADO.NET" to see the URI format. Note the server name (ending in .postgres.database.azure.com), port (5432), and admin username.'
            },
            {
                title: 'Configure firewall access',
                body: 'Under Security → Networking, add your machine\'s IP address to the firewall allowlist if you have not already done so.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora. Use the Azure server name as host, 5432 as port, your admin username, and your password. For Single Server, the username format is user@servername; for Flexible Server, just the username.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Azure Postgres schemas and tables appear in the sidebar.'
            }
        ],
        notes: [
            'Azure requires SSL. Use sslmode=require in the connection string or enable SSL in the Dora connection dialog.',
            'Flexible Server is the recommended deployment type; Single Server is being retired. The connection method in Dora is identical for both.',
            'Azure also offers Azure Database for MySQL. Add a MySQL connection in Dora using the .mysql.database.azure.com endpoint for MySQL workloads.'
        ]
    },
    // TODO: add google-cloud-sql logo at /providers/google-cloud-sql.svg
    {
        slug: 'google-cloud-sql',
        provider: 'Google Cloud SQL',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect Google Cloud SQL to Dora',
        description:
            'Connect a Google Cloud SQL PostgreSQL or MySQL instance to Dora, the desktop database GUI. Authorize your IP and connect to the public endpoint.',
        lead: 'Cloud SQL runs standard Postgres and MySQL. Authorize your IP in the Cloud Console, then connect to the public endpoint from Dora.',
        keywords: [
            'google cloud sql gui',
            'cloud sql postgres client',
            'cloud sql desktop client',
            'gcp postgres sql client',
            'cloud sql database viewer'
        ],
        connectionString:
            'postgresql://[USER]:[PASSWORD]@[PUBLIC-IP]:5432/[DBNAME]',
        intro: [
            'Google Cloud SQL provides managed PostgreSQL, MySQL, and SQL Server instances. Dora connects to Cloud SQL PostgreSQL and MySQL instances using the public IP after you authorize your machine\'s IP in the Cloud Console.',
            'The simplest path from a desktop app is to add your IP to the authorized networks and connect to the public IP directly — no proxy needed.'
        ],
        steps: [
            {
                title: 'Find the public IP',
                body: 'In the Google Cloud Console, go to SQL → your instance → Overview. Copy the "Public IP address" under Connect to this instance.'
            },
            {
                title: 'Add your IP to the allowlist',
                body: 'Under Connections → Networking, add your machine\'s IP address (or CIDR range) as an Authorized network. Without this, connections are rejected at the network level.'
            },
            {
                title: 'Note your credentials',
                body: 'Go to Users to confirm the database user and ensure you have the password. The default user is "postgres" for Postgres instances.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora. Use the public IP as host, 5432 as port (Postgres) or 3306 (MySQL), your username, password, and database name.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your Cloud SQL tables and schemas appear in the Dora sidebar.'
            }
        ],
        notes: [
            'If you prefer not to expose the public IP, install the Cloud SQL Auth Proxy on your machine and point Dora at localhost:5432 — it handles authentication and encryption automatically.',
            'SSL is optional for the public IP path but recommended. Cloud SQL supports sslmode=require; you can enable it in the Dora connection dialog.',
            'Cloud SQL also supports private IP access via VPC peering. For that path, configure Dora\'s SSH tunnel to jump through a bastion host inside the same VPC.'
        ]
    },
    // TODO: add yugabyte logo at /providers/yugabyte.svg
    {
        slug: 'yugabyte',
        provider: 'Yugabyte',
        logo: '/providers/postgresql.svg',
        engine: 'PostgreSQL',
        title: 'Connect YugabyteDB to Dora',
        description:
            'Connect a YugabyteDB Managed cluster to Dora, the desktop database GUI. YugabyteDB is PostgreSQL-compatible — connect with the standard Postgres URI.',
        lead: 'YugabyteDB speaks Postgres (YSQL). Dora connects to YugabyteDB Managed clusters using the connection string from the YugabyteDB console.',
        keywords: [
            'yugabyte gui',
            'yugabytedb desktop client',
            'yugabyte postgres client',
            'yugabyte sql client',
            'ysql database viewer'
        ],
        connectionString:
            'postgresql://admin:[PASSWORD]@[HOST].ybdb.io:5433/yugabyte?sslmode=require',
        intro: [
            'YugabyteDB is a distributed SQL database with full PostgreSQL compatibility (YSQL). Dora connects to YugabyteDB Managed clusters using the standard Postgres connection string.',
            'Note that YugabyteDB uses port 5433 by default for YSQL (not the standard 5432). Dora handles this correctly when you paste the full connection string.'
        ],
        steps: [
            {
                title: 'Open your cluster in YugabyteDB Managed',
                body: 'Log into cloud.yugabyte.com and open your cluster.'
            },
            {
                title: 'Add your IP to the allow list',
                body: 'Go to the Security tab → Network Allow List and add your machine\'s IP address. YugabyteDB Managed blocks all external IPs by default.'
            },
            {
                title: 'Copy the connection string',
                body: 'On the Connect tab, select "Connect to your Application" and copy the connection string. It looks like postgresql://admin:[PASSWORD]@[HOST].ybdb.io:5433/yugabyte?sslmode=require.'
            },
            {
                title: 'Add a connection in Dora',
                body: 'Create a new connection in Dora and paste the connection string. Dora reads the port 5433 and sslmode from the URL automatically.'
            },
            {
                title: 'Test and connect',
                body: 'Click Test, then Connect. Your YugabyteDB schemas and tables appear in the sidebar.'
            }
        ],
        notes: [
            'YugabyteDB YSQL uses port 5433, not the standard 5432. Make sure to include the port in the connection string.',
            'YugabyteDB Managed requires SSL (sslmode=require). The connection string from the console includes this.',
            'YugabyteDB is PostgreSQL-compatible, so standard SQL, joins, indexes, and transactions all work as expected in Dora.'
        ]
    }
]

const guideBySlug = new Map(GUIDES.map((guide) => [guide.slug, guide]))

export function getGuide(slug: string): TGuideConfig | undefined {
    return guideBySlug.get(slug)
}

export function getGuidePath(slug: string): string {
    return `/docs/connect/${slug}`
}

export function getGuideRouteEntries(): TRouteConfig[] {
    return GUIDES.map(function (guide) {
        return {
            path: getGuidePath(guide.slug),
            title: guide.title,
            description: guide.description,
            sitemap: true,
            index: true,
            priority: 0.7,
            changeFrequency: 'monthly' as const
        }
    })
}
