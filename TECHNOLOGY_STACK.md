# DAM Whisper - Technologies & Setup Guide

## 🛠️ Technology Stack

### **Frontend Technologies**
- **React 18.3.1** - Modern React with hooks and functional components
- **TypeScript 5.8.3** - Type-safe JavaScript for better development experience
- **Vite 5.4.19** - Fast build tool and development server
- **React Router DOM 6.30.1** - Client-side routing for SPA navigation

### **UI Framework & Styling**
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components built on Radix UI
- **Radix UI** - Unstyled, accessible UI primitives
- **Lucide React** - Beautiful & consistent icon library
- **class-variance-authority** - CSS-in-JS variant API
- **clsx & tailwind-merge** - Conditional CSS class management

### **Backend & Database**
- **Supabase** - Backend-as-a-Service (PostgreSQL database)
- **Supabase Edge Functions** - Serverless functions (Deno runtime)
- **Supabase Storage** - File storage with CDN
- **Supabase Auth** - Authentication & user management

### **AI & ML Integration**
- **Lovable AI Gateway** - AI chat completions and embeddings
- **Google Gemini 2.5 Flash** - Multimodal AI model for chat
- **Google Text Embedding 004** - Text embeddings for semantic search
- **Vision AI** - Image captioning and analysis

### **State Management & Data Fetching**
- **TanStack React Query 5.83.0** - Server state management
- **React Hook Form 7.61.1** - Form state management
- **Zod 3.25.76** - Schema validation

### **Development Tools**
- **ESLint 9.32.0** - Code linting and formatting
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Vite React SWC Plugin** - Fast React refresh with SWC
- **Autoprefixer** - CSS vendor prefixing

### **Additional Libraries**
- **date-fns** - Date manipulation library
- **Recharts** - Charts and data visualization
- **Embla Carousel** - Touch-friendly carousel component
- **Sonner** - Toast notifications
- **next-themes** - Theme switching (dark/light mode)

---

## 📋 Step-by-Step Setup Guide

### **Prerequisites**
- **Node.js 18+** - JavaScript runtime
- **npm or Bun** - Package manager
- **Git** - Version control
- **Supabase Account** - Backend services
- **Lovable API Key** - AI functionality (optional)

---

### **Step 1: Project Setup**

```bash
# Clone or download the project
cd "path/to/dam-whisper-main"

# Install dependencies
npm install

# Or with Bun (faster)
bun install
```

---

### **Step 2: Environment Configuration**

Create `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Get Supabase Credentials:**
1. Go to [supabase.com](https://supabase.com)
2. Create account and new project
3. Go to Settings → API
4. Copy Project URL and anon/public key

---

### **Step 3: Database Setup**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Run database migrations
supabase db push
```

---

### **Step 4: Supabase Functions Deployment**

```bash
# Deploy chat assistant function
supabase functions deploy chat-assistant

# Deploy other functions (optional)
supabase functions deploy backfill-embeddings
supabase functions deploy generate-embedding
```

**Set Function Environment Variables:**
In Supabase Dashboard → Edge Functions → Settings:
```
LOVABLE_API_KEY=your_lovable_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

### **Step 5: Storage Bucket Setup**

In Supabase Dashboard → Storage:
1. Create bucket named `assets`
2. Set appropriate policies for file access
3. Configure public/private access as needed

---

### **Step 6: Development Server**

```bash
# Start development server
npm run dev

# Or with Bun
bun run dev

# Server runs on http://localhost:8080
```

---

### **Step 7: Production Build**

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Files output to dist/ folder
```

---

## 🏗️ Project Architecture

### **Frontend Structure**
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── AppSidebar.tsx  # Main navigation
├── pages/              # Route components
│   ├── Auth.tsx        # Authentication
│   ├── Chat.tsx        # AI Chat Assistant
│   ├── Upload.tsx      # File upload
│   ├── Folders.tsx     # Folder management
│   └── Assets.tsx      # Asset management
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client & types
└── lib/                # Utility functions
```

### **Backend Structure**
```
supabase/
├── functions/          # Edge Functions (Deno)
│   └── chat-assistant/ # AI chat functionality
├── migrations/         # Database schema changes
└── config.toml        # Supabase configuration
```

---

## 🚀 Core Features

### **1. Digital Asset Management**
- File upload and organization
- Folder-based hierarchy
- Metadata and tagging
- Search and filtering

### **2. AI-Powered Chat Assistant**
- Natural language file operations
- Smart folder suggestions
- Automatic tagging and organization
- Semantic search capabilities

### **3. Advanced Search**
- Text-based search
- Semantic vector search
- Filter by file type, date, tags
- AI-powered content understanding

### **4. User Management**
- Multi-tenant architecture
- Role-based permissions
- Secure authentication
- User profiles and preferences

---

## 🔧 Development Workflow

### **Local Development**
1. **Start dev server**: `npm run dev`
2. **Make changes**: Hot reload active
3. **Test features**: Multiple browsers/devices
4. **Check console**: Debug information available

### **Function Development**
1. **Edit functions**: `supabase/functions/`
2. **Test locally**: `supabase functions serve`
3. **Deploy**: `supabase functions deploy [name]`
4. **Monitor logs**: Supabase dashboard

### **Database Changes**
1. **Create migration**: `supabase migration new [name]`
2. **Edit SQL**: Add schema changes
3. **Apply locally**: `supabase db reset`
4. **Deploy**: `supabase db push`

---

## 📊 Key Performance Features

- **Fast Build Times** - Vite + SWC
- **Code Splitting** - Automatic bundle optimization
- **Tree Shaking** - Dead code elimination
- **Hot Module Replacement** - Instant development feedback
- **TypeScript** - Compile-time error checking
- **Edge Functions** - Global serverless compute
- **CDN Storage** - Fast file delivery
- **Semantic Search** - Vector embeddings for smart search

This is a modern, full-stack application built with cutting-edge technologies for optimal performance, developer experience, and user functionality!