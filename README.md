<div align="center">

# 📊 Work Report Application

### A Modern Enterprise Work Report Management System

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

<p align="center">
  <strong>Streamline your organization's daily work reporting with role-based dashboards, real-time analytics, and seamless team management.</strong>
</p>

[Features](#-features) •
[Quick Start](#-quick-start) •
[User Roles](#-user-roles) •
[Pages](#-pages) •
[Tech Stack](#-tech-stack) •
[API Reference](#-api-reference) •
[Deployment](#-deployment) •
[Configuration](#-configuration)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📝 Work Report Management
- **Daily Reports** - Employees submit daily work reports
- **Status Tracking** - Track working/leave status
- **On-Duty Marking** - Special on-duty designation
- **Edit Permissions** - Configurable edit access per role
- **Late Submission Tracking** - Visual indicators for late reports

</td>
<td width="50%">

### 👥 Multi-Role System
- **5 User Roles** - Employee, Manager, Admin, Super Admin, Board Member
- **Granular Permissions** - Page-level access control
- **Role-Based Dashboards** - Tailored experience per role
- **Team Management** - Managers oversee department teams
- **Configurable Edit Rights** - Super admin controls who can edit

</td>
</tr>
<tr>
<td width="50%">

### 📊 Analytics & Reporting
- **Interactive Charts** - Visual data representation
- **Department Analytics** - Cross-team comparisons
- **Submission Statistics** - Track completion rates
- **Export Ready** - Data backup to Google Sheets
- **Attendance Rate** - Automatic calculation per employee

</td>
<td width="50%">

### 🏢 Organization Structure
- **Entity Management** - Multi-company support
- **Branch System** - Location-based organization
- **Department Hierarchy** - Structured teams
- **Bulk Operations** - CSV import for users
- **Manager-Department Mapping** - Flexible team assignments

</td>
</tr>
<tr>
<td width="50%">

### 📱 Progressive Web App (PWA)
- **Installable** - Add to home screen on mobile/desktop
- **Offline Support** - Service worker for caching
- **Native Feel** - Standalone app experience
- **Auto Updates** - Seamless background updates

</td>
<td width="50%">

### 🔧 System Administration
- **Database Maintenance** - WAL checkpoint, vacuum, optimization
- **Health Monitoring** - Real-time system stats
- **Queue Management** - Async task processing
- **IST Timezone** - Indian Standard Time support

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm**, **yarn**, **pnpm**, or **bun**

### Installation

```bash
# Clone the repository
git clone https://github.com/mohammedtaufeeqahmed/work-report-application.git
cd work-report-application

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 🔑 Default Login Credentials

| Role | Employee ID | Password |
|------|-------------|----------|
| Super Admin | `ADMIN001` | `admin123` |

> ⚠️ **Important:** Change the default password immediately after first login!

---

## 👤 User Roles

```mermaid
graph TD
    SA[🔐 Super Admin] --> A[👔 Admin]
    SA --> BM[📊 Board Member]
    A --> M[👥 Manager]
    M --> E[👤 Employee]
    
    style SA fill:#ff6b6b,stroke:#333,stroke-width:2px,color:#fff
    style A fill:#4ecdc4,stroke:#333,stroke-width:2px,color:#fff
    style BM fill:#9b59b6,stroke:#333,stroke-width:2px,color:#fff
    style M fill:#3498db,stroke:#333,stroke-width:2px,color:#fff
    style E fill:#2ecc71,stroke:#333,stroke-width:2px,color:#fff
```

<details>
<summary><b>👤 Employee</b> - Basic access for daily reporting</summary>

| Permission | Access |
|------------|--------|
| Submit Work Reports | ✅ |
| View Own Reports | ✅ |
| Employee Dashboard | ✅ |
| Edit Own Reports | Configurable |
| Employee Reports | ❌ |
| Management Dashboard | ❌ |
| Admin Dashboard | ❌ |

</details>

<details>
<summary><b>👥 Manager</b> - Team oversight and reporting</summary>

| Permission | Access |
|------------|--------|
| Submit Work Reports | ✅ |
| View Team Reports | ✅ |
| Dashboard | ✅ |
| Employee Reports | ✅ |
| Management Dashboard | ✅ |
| Edit Team Reports | Configurable |
| Admin Dashboard | ❌ |

</details>

<details>
<summary><b>📊 Board Member</b> - Read-only analytics access</summary>

| Permission | Access |
|------------|--------|
| Submit Work Reports | ❌ |
| View All Reports | ✅ |
| Dashboard | ✅ |
| Employee Reports | ✅ |
| Management Dashboard | ✅ |
| Admin Dashboard | ❌ |

</details>

<details>
<summary><b>👔 Admin</b> - User management for entity/branch</summary>

| Permission | Access |
|------------|--------|
| Submit Work Reports | ✅ |
| Create/Manage Users | ✅ |
| Dashboard | ✅ |
| Admin Dashboard | ✅ |
| Edit Reports | Configurable |
| Entity Management | ❌ |
| Super Admin Dashboard | ❌ |

</details>

<details>
<summary><b>🔐 Super Admin</b> - Full system control</summary>

| Permission | Access |
|------------|--------|
| All Admin Permissions | ✅ |
| Entity Management | ✅ |
| Branch Management | ✅ |
| Department Management | ✅ |
| Bulk User Upload | ✅ |
| System Settings | ✅ |
| Edit Permissions Config | ✅ |
| Database Maintenance | ✅ |
| Super Admin Dashboard | ✅ |

</details>

---

## 📄 Pages

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Home page with app overview | Public |
| `/login` | User authentication | Public |
| `/reset-password` | Password recovery | Public |
| `/work-report` | Submit daily work reports | Authenticated |
| `/employee-dashboard` | Personal dashboard with stats & history | Employee+ |
| `/employee-reports` | View employee reports | Manager+ |
| `/admin` | User management dashboard | Admin+ |
| `/super-admin` | Full administrative control | Super Admin |
| `/management-dashboard` | Analytics with charts | Manager+ |
| `/managers-dashboard` | Team management view | Manager+ |

---

## 🛠 Tech Stack

<table>
<tr>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=nextjs" width="48" height="48" alt="Next.js" />
<br><strong>Next.js 16</strong>
<br><sub>App Router</sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=react" width="48" height="48" alt="React" />
<br><strong>React 19</strong>
<br><sub>UI Library</sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=ts" width="48" height="48" alt="TypeScript" />
<br><strong>TypeScript 5</strong>
<br><sub>Type Safety</sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=tailwind" width="48" height="48" alt="Tailwind" />
<br><strong>Tailwind 4</strong>
<br><sub>Styling</sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=postgresql" width="48" height="48" alt="PostgreSQL" />
<br><strong>PostgreSQL</strong>
<br><sub>Database</sub>
</td>
</tr>
</table>

### Additional Technologies

| Category | Technology |
|----------|------------|
| **UI Components** | [Shadcn/ui](https://ui.shadcn.com/) with Radix UI primitives |
| **Charts** | [Recharts](https://recharts.org/) for data visualization |
| **Forms** | React Hook Form + Zod validation |
| **Authentication** | Custom JWT-based auth with bcrypt |
| **Database** | PostgreSQL with Drizzle ORM (node-postgres/pg) |
| **PWA** | next-pwa for Progressive Web App support |
| **Backup** | Google Sheets API (write-only backup) |
| **Icons** | Lucide React |
| **Theming** | next-themes for dark/light mode |
| **Notifications** | Sonner toast notifications |
| **Timezone** | IST (Indian Standard Time) support |

---

## 📡 API Reference

<details>
<summary><b>🔐 Authentication</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login |
| `GET` | `/api/auth/google` | Initiate Google OAuth login |
| `GET` | `/api/auth/google/callback` | Google OAuth callback handler |
| `POST` | `/api/auth/logout` | User logout |
| `GET` | `/api/auth/session` | Get current session |
| `POST` | `/api/auth/reset-password` | Reset password |

</details>

<details>
<summary><b>📝 Work Reports</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/work-reports` | Get all work reports |
| `POST` | `/api/work-reports/submit` | Submit a work report (async pipeline) |
| `GET` | `/api/work-reports/status` | Poll a queued submission |
| `PUT` | `/api/work-reports/[id]` | Update a work report |
| `POST` | `/api/work-reports/mark-present` | Manager mark employee present |
| `POST` | `/api/work-reports/mark-absent` | Manager mark employee absent |

</details>

<details>
<summary><b>👥 Admin - Users</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create new user |
| `GET` | `/api/admin/users/[id]` | Get user details |
| `PUT` | `/api/admin/users/[id]` | Update user |
| `DELETE` | `/api/admin/users/[id]` | Deactivate user |
| `GET` | `/api/admin/users/[id]/departments` | Get manager departments |
| `PUT` | `/api/admin/users/[id]/departments` | Update manager departments |

</details>

<details>
<summary><b>🏢 Admin - Organization</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/entities` | List entities |
| `POST` | `/api/admin/entities` | Create entity |
| `GET` | `/api/admin/branches` | List branches |
| `POST` | `/api/admin/branches` | Create branch |
| `GET` | `/api/admin/departments` | List departments |
| `POST` | `/api/admin/departments` | Create department |
| `DELETE` | `/api/admin/departments/[id]` | Delete department |

</details>

<details>
<summary><b>⚙️ Settings & Permissions</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/settings` | Get edit permissions (Super Admin) |
| `PUT` | `/api/admin/settings` | Update edit permissions (Super Admin) |
| `GET` | `/api/settings/permissions` | Get permissions for current user |

</details>

<details>
<summary><b>📊 Analytics</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics` | Get analytics data |
| `GET` | `/api/reports/monthly-status` | Monthly status report |

</details>

<details>
<summary><b>🔧 Database & System</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/db/stats` | Get database & queue statistics |
| `POST` | `/api/db/maintenance` | Run database maintenance |
| `GET` | `/api/db/maintenance` | Get maintenance info |
| `POST` | `/api/db/init` | Initialize database |
| `POST` | `/api/db/reset` | Reset database (dev only) |
| `GET` | `/api/queue` | Get queue status |

**Maintenance Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `checkpoint` | boolean | `true` | Run WAL checkpoint |
| `vacuum` | boolean | `true` | Run incremental vacuum |
| `optimize` | boolean | `true` | Run ANALYZE |
| `clearQueue` | boolean | `false` | Clear queue history |
| `vacuumPages` | number | `100` | Pages to vacuum |

</details>

---

## 🚀 Deployment

Full deployment options (Docker, PM2, VPS, EC2, SSL, backups) are documented in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Quick deploy (Docker + PostgreSQL)

On a server with PostgreSQL already running:

```bash
curl -sSL https://raw.githubusercontent.com/mohammedtaufeeqahmed/work-report-application/main/deploy-production.sh | bash
```

Or clone and run:

```bash
git clone https://github.com/mohammedtaufeeqahmed/work-report-application.git
cd work-report-application
chmod +x deploy-production.sh
sudo ./deploy-production.sh
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (PostgreSQL connection string)
DATABASE_URL=postgresql://user:password@host:5432/database_name

# Authentication
JWT_SECRET=your-super-secret-jwt-key
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth (Optional - for Google Workspace login)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_ALLOWED_DOMAINS=domain1.com,domain2.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Sheets Backup (Optional)
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id

# Email Service (Optional - for password reset)
EMAIL_SERVICE_API_KEY=your-email-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Environment
NODE_ENV=development
```

### Google OAuth Setup (Optional)

To enable Google Workspace login:

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create a new project** or select an existing one
3. **Enable APIs:**
   - Go to "APIs & Services" → "Library"
   - Enable "Google+ API" or "People API"
4. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Authorized redirect URIs: `{YOUR_APP_URL}/api/auth/google/callback`
     - Example: `http://localhost:3000/api/auth/google/callback` (development)
     - Example: `https://your-domain.com/api/auth/google/callback` (production)
5. **Copy credentials** to your `.env.local`:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client Secret → `GOOGLE_CLIENT_SECRET`
6. **Configure allowed domains:**
   - Set `GOOGLE_ALLOWED_DOMAINS` to comma-separated list of workspace domains
   - Example: `company.com,subsidiary.com`
   - Users must have an account in your database (matched by email)

**Note:** The same OAuth credentials work for multiple domains. Domain validation happens on the backend after authentication.

### Edit Permissions Configuration

Super Admins can configure who can edit work reports:

| Setting | Description |
|---------|-------------|
| `employee_can_edit_own_reports` | Allow employees to edit their own reports |
| `manager_can_edit_team_reports` | Allow managers to edit team member reports |
| `admin_can_edit_reports` | Allow admins to edit reports in their scope |
| `superadmin_can_edit_reports` | Allow super admins to edit any report |

---

## 📁 Project Structure

```
work-report-application/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login, reset-password
│   │   ├── (dashboard)/         # Role-based dashboards (admin, employee-dashboard, etc.)
│   │   ├── api/                 # API routes (auth, admin, work-reports, db, etc.)
│   │   ├── employee-reports/
│   │   ├── work-report/
│   │   └── page.tsx
│   ├── components/              # UI components, navbar, work-report-form
│   ├── lib/                     # db, auth, queue, utils, google-sheets
│   ├── types/
│   └── middleware.ts
├── data/                        # Optional local data (e.g. backups)
├── public/                      # Static assets, PWA icons, manifest
├── scripts/                     # backup-db.sh, generate-icons.mjs
├── deploy-production.sh        # One-command production deploy (Docker + PostgreSQL)
├── Dockerfile
├── docker-compose.production.yml
├── DEPLOYMENT.md                # Full deployment guide
├── next.config.ts
├── package.json
└── README.md
```

---

## 🔄 Data Flow Architecture

```mermaid
flowchart LR
    subgraph Client
        A[👤 User] --> B[📱 React UI / PWA]
    end
    
    subgraph Server
        B --> C[🔀 API Routes]
        C --> D[📋 Queue System]
        D --> E[(🗄️ PostgreSQL)]
        D -.-> F[📊 Google Sheets]
    end
    
    E --> G[📈 Analytics]
    G --> B
    
    subgraph Maintenance
        H[🔧 Cron Jobs] --> I[Backup to S3]
        H --> J[DB Maintenance]
    end
    
    E --> I
    
    style A fill:#2ecc71,stroke:#333
    style E fill:#3498db,stroke:#333
    style F fill:#f1c40f,stroke:#333
    style H fill:#9b59b6,stroke:#333
```

> **Note:** Google Sheets is used as a backup only. All operations read from PostgreSQL.

---

## 📈 Future Roadmap

- [x] PWA Support
- [x] Employee Dashboard
- [x] Edit Permissions System
- [x] Database Maintenance API
- [x] IST Timezone Support
- [x] PostgreSQL database
- [ ] Email notifications for report submissions
- [ ] Advanced reporting with date ranges
- [ ] Team performance metrics
- [ ] Integration with HR systems
- [ ] Mobile app (React Native)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Next.js and modern web technologies**

⭐ Star this repo if you find it helpful!

</div>

<!--
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
docker exec work-report-app printenv DATABASE_URL
docker logs -f work-report-app
-->