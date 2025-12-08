# Wiki Documentation

This directory contains all the documentation pages for the GitHub Wiki.

## 📚 Available Pages

1. **[Home.md](Home.md)** - Main wiki landing page
2. **[Features.md](Features.md)** - Complete feature documentation
3. **[Quick-Start.md](Quick-Start.md)** - 5-minute quick start guide
4. **[Admin-Guide.md](Admin-Guide.md)** - Administrator manual
5. **[API-Reference.md](API-Reference.md)** - Complete API documentation
6. **[Deployment-Guide.md](Deployment-Guide.md)** - Production deployment instructions

## 🚀 How to Upload to GitHub Wiki

### Method 1: Clone and Push (Recommended)

```bash
# 1. Clone the wiki repository
git clone https://github.com/humac/kars.wiki.git

# 2. Copy wiki files
cp wiki/*.md kars.wiki/

# 3. Commit and push
cd kars.wiki
git add .
git commit -m "Add comprehensive documentation"
git push origin master
```

### Method 2: Manual Upload via GitHub UI

1. Go to your repository's Wiki tab: `https://github.com/humac/kars/wiki`
2. Click "New Page" for each wiki page
3. Copy the content from each `.md` file
4. Paste into the wiki editor
5. Use the filename (without `.md`) as the page title
   - `Home.md` → Page title: "Home"
   - `Features.md` → Page title: "Features"
   - etc.
6. Save each page

### Method 3: GitHub CLI

```bash
# Install gh CLI if not installed
# https://cli.github.com/

# Enable wiki
gh repo edit humac/kars --enable-wiki

# Clone wiki
git clone https://github.com/humac/kars.wiki.git

# Copy files
cp wiki/*.md kars.wiki/

# Push
cd kars.wiki
git add .
git commit -m "Add documentation"
git push
```

## 📖 Wiki Structure

```
Wiki Home (Home.md)
├── Features
├── Quick Start
│   ├── For Users
│   ├── For Admins
│   ├── For Developers
│   └── For DevOps
├── Admin Guide
│   ├── First Admin Setup
│   ├── User Management
│   ├── Company Management
│   ├── System Monitoring
│   └── Security Best Practices
├── API Reference
│   ├── Authentication
│   ├── User Management
│   ├── Assets
│   ├── Companies
│   └── Audit & Reporting
└── Deployment Guide
    ├── Portainer Deployment
    ├── GitHub Actions
    ├── Cloudflare Tunnel
    └── Monitoring
```

## 🔗 Internal Links

The wiki pages use internal links like `[Features](Features)` which GitHub automatically converts to proper wiki links.

**Important:** When uploading to GitHub Wiki, ensure the page names match exactly:
- `Home` (not `Home.md`)
- `Features` (not `Features.md`)
- `Quick-Start` (not `Quick Start` or `Quick-Start.md`)
- etc.

## ✏️ Editing Wiki Pages

### Locally

1. Edit the `.md` files in the `wiki/` directory
2. Commit changes to the repository
3. Push to GitHub wiki repository (separate from main repo)

### On GitHub

1. Navigate to the Wiki tab
2. Click "Edit" on any page
3. Make changes in the editor
4. Save with commit message

**Note:** Changes made directly on GitHub Wiki won't sync back to this directory automatically.

## 🔄 Keeping Wiki Updated

When updating documentation:

1. **Update the `.md` files** in this directory
2. **Commit to main repository** (for version control)
3. **Copy to wiki repository** (for GitHub Wiki display)

```bash
# Quick update script
cd wiki
cp *.md ../kars.wiki/
cd ../kars.wiki
git add .
git commit -m "Update documentation"
git push
```

## 📝 Adding New Pages

1. **Create new `.md` file** in `wiki/` directory
2. **Add to Home.md** navigation
3. **Cross-reference** from related pages
4. **Upload to GitHub Wiki**

Example:
```markdown
<!-- In Home.md -->
- **[New Page](New-Page)** - Description of new page

<!-- In new file: wiki/New-Page.md -->
# New Page

Content here...
```

## 🎨 Formatting Guidelines

- Use **Markdown** formatting
- Include **Table of Contents** for long pages
- Use **code blocks** with language specification
- Add **emojis** for visual organization (sparingly)
- Include **examples** and **screenshots** where helpful
- Cross-reference related pages
- Keep paragraphs concise

## 📚 Documentation Standards

- **Clear headings** - Descriptive and hierarchical
- **Step-by-step** - Numbered lists for procedures
- **Examples** - Real-world use cases
- **Warnings** - Highlight important notes
- **Code snippets** - Well-formatted and tested
- **Links** - Internal and external references

## 🧪 Testing Documentation

Before uploading:
- [ ] Check all internal links work
- [ ] Verify code examples are accurate
- [ ] Test instructions on clean environment
- [ ] Review for typos and clarity
- [ ] Ensure screenshots are current

## 📞 Support

If you find errors or have suggestions:
1. Open an issue on GitHub
2. Submit a pull request with fixes
3. Update wiki pages directly (if you have access)

---

**Ready to upload?** Follow Method 1 above for the easiest process!
