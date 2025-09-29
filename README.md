<div align=center>
  <img src="./src/assets/k2a-icon-512x512.png" alt="App Icon" width="512" />
</div>

# Kenmei to Anilist

> Effortlessly migrate and synchronize your manga library from Kenmei to AniList with a beautiful, modern desktop app. 🚀

---

## 📸 Screenshots

- **Home Page**  
  ![Home Page Screenshot](./docs/assets/home-page.png)
- **Import Kenmei CSV**  
  ![Import Screenshot](./docs/assets/import-page.png)
- **Smart Matching**  
  ![Matching Screenshot](./docs/assets/review-page.png)
- **Sync to AniList**  
  ![Sync Screenshot](./docs/assets/sync-page.png)
- **Settings**  
  ![Settings Screenshot](./docs/assets/settings-page.png)

---

## ✨ Features

- **Import from Kenmei**: Easily import your entire manga collection from a Kenmei CSV export.
- **Smart Matching**: An algorithm matches your manga to AniList entries.
- **One-Click Sync**: Synchronize your collection to AniList with a single click after reviewing matches.
- **Auto-Pause Manga**: Automatically pause manga that haven't been updated within a customizable time period.
- **Flexible Configuration**: Customize how synchronization works with priority settings for status, progress, and scores.

---

## 🛠️ How It Works

1. **Import**: Export your manga library from Kenmei as a CSV and import it into the app.
2. **Match**: The app automatically matches your manga to AniList entries. Review and adjust matches as needed.
3. **Review**: See a summary of your collection and any issues before syncing.
4. **Sync**: With one click, sync your collection to AniList, including status, progress, and privacy settings.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/RLAlpha49/KenmeiToAnilist.git
cd KenmeiToAnilist

# Install dependencies
npm install --force
# or
yarn install
```

### Running the App (Development)

```bash
npm start
# or
yarn start
```

### Building for Production

```bash
npm run make
# or
yarn make
```

### Environment Variables

Create a `.env` file in the root if you want to set the default AniList credentials:

```env
VITE_ANILIST_CLIENT_ID=your-client-id
VITE_ANILIST_CLIENT_SECRET=your-client-secret
```

> You can also configure credentials in the app's Settings page.

---

## 📚 Documentation

### For Users

- **[User Guide](./docs/guides/USER_GUIDE.md)** – How to use the application

### For Developers

- **[Architecture Documentation](./docs/guides/ARCHITECTURE.md)** – Technology choices, processes, structure, performance & security
- **[Storage Implementation Guide](./docs/guides/STORAGE_IMPLEMENTATION.md)** – Three‑layer storage architecture details
- **[AniList API Reference](./docs/guides/API_REFERENCE.md)** – GraphQL operations, auth, rate limiting, error handling

### Generated API (TypeDoc)

- **[TypeDoc Site](https://rlalpha49.github.io/KenmeiToAnilist/)** – Auto‑generated source/API docs

---

## 🙏 Credits

This project makes use of several external APIs and services:

- **[AniList](https://anilist.co/)** – The primary manga database and sync target.
- **[MangaDex](https://mangadex.org/)** – Used as a fallback source.
- **[Comick](https://comick.io/)** – Used as a fallback source.

---

## 🤝 Contributing

Contributions are welcome! Please:

- Fork the repo and create your branch
- Follow the code style
- Open a pull request with a clear description
- For major changes, open an issue first to discuss

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
