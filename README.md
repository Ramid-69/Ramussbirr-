# CBEBirr Plus (Commercial Bank of Ethiopia Transfer System)

A full-stack banking transfer and receipt generation system with native Android USSD automated receiver name resolution.

## Features

- **CBEBirr Transfer UI**: Authentic Commercial Bank of Ethiopia interface with real-time transfer state management.
- **USSD Recipient Resolver**: Built-in Android `UssdAccessibilityService` that dials `*847*1*2*[account]#`, parses the returned `AccountName : [NAME]`, automatically dismisses the dialog, and populates the Receiver Name field directly into the app with zero interruption.
- **Official Receipts**: Authentic CBEBirr receipt generation with transaction reference FT codes, exact Disaster Response Fee 2-line layout, right-aligned amounts, and QR validation.
- **Instant Splash Transitions**: High-performance, in-place splash page transitions with zero sliding.
- **PWA & Native Support**: Installable Progressive Web App and standalone signed Android APK (`cbebirr-plus.apk`).
- **Automated GitHub Action**: `.github/workflows/build-apk.yml` automatically compiles and packages Android APKs on every git push.

## Project Structure

```text
├── android/                 # Native Android application source (Android Studio / Gradle)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/cbe/cbebirrtransfer/
│   │   │   ├── MainActivity.java
│   │   │   └── UssdAccessibilityService.java
│   │   └── res/
├── app/                     # Next.js 15 App Router pages and API routes
│   ├── api/ussd/            # Webhook and USSD receiver handlers
│   ├── api/receipt/         # Receipt saving and sharing endpoints
│   ├── page.tsx             # Main application entry point
│   └── layout.tsx
├── components/              # Full-screen CBEBirr UI components
├── public/                  # Static assets and ready-to-install APK
│   └── cbebirr-plus.apk     # Standalone signed Android APK
└── .github/workflows/       # CI/CD GitHub Actions for APK compilation
```

## Getting Started

### Web Application (Next.js)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Native Android App

- Download `public/cbebirr-plus.apk` directly to an Android phone.
- Or open the `android/` directory in Android Studio and click **Run**.

## Pushing to GitHub

1. Initialize git and commit:
```bash
git init
git add .
git commit -m "Initial commit of CBEBirr Plus app"
```

2. Link to your GitHub repository and push:
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```
