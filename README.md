# AIVA - Digital Asset Management Platform

## Project Overview

**AIVA** is an intelligent Digital Asset Management platform built with modern web technologies, providing comprehensive AI-powered tools for organizing, managing, and securing digital assets.

## Project info

## Features

- 🤖 **AI-Powered Asset Management** - Intelligent organizing and managing of digital files
- 🔐 **Secure Authentication** - Multi-tenant security with Supabase
- 💬 **AIVA Assistant** - Natural language asset management
- 📊 **Analytics Dashboard** - Comprehensive asset insights
- 🎨 **AIVA Design System** - Professional branding and UX
- 🌙 **Dark Mode Support** - Complete theme switching
- 📱 **Responsive Design** - Mobile-first approach

## How can I edit this code?

**Use your preferred IDE**

You can work locally using your preferred IDE by cloning this repo and pushing changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS



## How can I deploy this to the web?

You can deploy this project to various platforms:

1. **Vercel**: Connect your GitHub repo to Vercel for automatic deployments
2. **Netlify**: Deploy directly from your Git repository  
3. **Traditional hosting**: Build with `npm run build` and upload the `dist` folder

## Setting up Google API Integration

1. Get your Google API key from [Google AI Studio](https://aistudio.google.com/)
2. Set up environment variables in your hosting platform
3. Deploy the Supabase functions with your Google API key
4. Configure your frontend environment variables

See `GOOGLE_API_CONFIGURATION.md` for detailed setup instructions.
