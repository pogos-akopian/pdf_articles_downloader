# 📄 Article PDF Scraper

Automated script for bulk downloading articles from websites as PDFs. Supports authentication and works with paywalled content.

## ✨ Features

* 🔐 **Authentication** - saves session, login required only once
* 📥 **Bulk downloading** - automatically collects and downloads all articles from a page
* 🎯 **Smart filtering** - excludes duplicates, navigation links, external URLs
* 💾 **Auto-save progress** - skips already downloaded files
* 🔄 **Error recovery** - resume from any article
* 📊 **Detailed statistics** - shows successful/failed downloads
* 📸 **Error screenshots** - saves screenshots of problematic pages
* 🎨 **High-quality PDF** - preserves formatting, images, styles

## 📋 Requirements

* [Node.js](https://nodejs.org/) version 14 or higher
* npm (installed with Node.js)

## 🚀 Quick Start

### 1. Installation

Clone the repository:
```bash
git clone https://github.com/pogos-akopian/article-scraper.git
cd article-scraper
```

Install dependencies:
```bash
npm install puppeteer
```

### 2. Configuration

Open `scraper.js` and modify settings in the CONFIG section:

```javascript
const CONFIG = {
  startUrl: 'https://example.com/articles',
  linkSelector: 'a[href]',
  filterPattern: null,
  delay: 4000,
  outputFolder: './downloaded_articles',
  headless: false,
};
```

### 3. Run

```bash
node scraper.js
```

### 4. Authentication (if required)

* Script will open Chrome browser
* Log in to the website manually
* Make sure you can see protected content
* Return to terminal and press **Enter**
* Cookies will be saved to `session.json` - no login needed next time!

### 5. Download Process

The script will automatically:

* Collect all article links
* Show list of found URLs
* Start downloading with specified delay
* Save PDFs to `downloaded_articles/` folder

## ⚙️ Configuration Options

### Main Parameters

**startUrl** - URL of page with article list (required)

**linkSelector** - CSS selector for finding links (default: `'a[href]'`)

**filterPattern** - URL filter, only download links containing this string (default: `null` for all links)

**delay** - Delay between articles in milliseconds (default: `4000`)

**outputFolder** - Folder for saving PDFs (default: `'./downloaded_articles'`)

**headless** - Run browser in headless mode (default: `false`)

**maxArticles** - Limit number of articles to download (default: `null` for unlimited)

**startFrom** - Start from Nth article, zero-indexed (default: `0`)

### Additional Parameters

**excludePatterns** - Array of patterns to exclude (default: `['#', 'javascript:', 'mailto:', 'tel:']`)

**onlyInternalLinks** - Only download links from same domain (default: `true`)

**sessionFile** - File for storing cookies (default: `'./session.json'`)

### PDF Settings

```javascript
pdfOptions: {
  format: 'A4',
  printBackground: true,
  margin: {
    top: '20px',
    bottom: '20px',
    left: '20px',
    right: '20px'
  }
}
```

## 💡 Usage Examples

### Download only 10 articles for testing

```javascript
maxArticles: 10,
```

### Continue from 50th article

```javascript
startFrom: 49,
```

### Filter only articles containing /post/ in URL

```javascript
filterPattern: '/post/',
```

### Use specific CSS selector

```javascript
linkSelector: 'a.article-link',
```

### Run in headless mode (faster, no browser window)

```javascript
headless: true,
```

### Increase delay for slow websites

```javascript
delay: 8000,
```

## 🔧 Troubleshooting

### Links not found

Try changing the CSS selector:

```javascript
linkSelector: 'a.article-title',
linkSelector: 'article a',
linkSelector: '[href*="/post/"]',
```

### Downloading wrong pages

Use a filter pattern:

```javascript
filterPattern: '/articles/',
```

### Paywall or no access

* Make sure you are logged in during the authentication step
* Check if `session.json` file exists and contains cookies
* Open error screenshot `error_N.png` to see what went wrong
* Try deleting `session.json` and logging in again

### Too fast or server blocking requests

Increase the delay:

```javascript
delay: 6000,
```

### Resume after failure

Check how many files were downloaded:

```bash
ls downloaded_articles/ | wc -l
```

Continue from that number:

```javascript
startFrom: 25,
```

## 📁 File Structure

```
article-scraper/
├── scraper.js
├── package.json
├── session.json
├── downloaded_articles/
│   ├── article_0001.pdf
│   ├── article_0002.pdf
│   ├── errors.json
│   ├── error_15.png
│   └── error_23.png
└── README.md
```

## 📊 Example Output

```
🚀 Article Scraper - Automatic article downloading to PDF

⚙️  Settings:
   📂 Folder: ./downloaded_articles
   ⏱️  Delay: 4000ms
   🎯 Filter: none

🌐 Starting browser...
✓ Loaded saved session (authentication)

📄 Opening: https://example.com/articles

🔍 Collecting article links...
✓ Found 144 unique links

======================================================================
📥 STARTING DOWNLOAD OF 144 ARTICLES
======================================================================

[1/144] 📄 https://example.com/article-1
   ✅ Saved: article_0001.pdf (245.67 KB)
   ⏳ Waiting 4.0s... done

[2/144] 📄 https://example.com/article-2
   ✅ Saved: article_0002.pdf (189.23 KB)
   ⏳ Waiting 4.0s... done

======================================================================
📊 STATISTICS:
   ✅ Successfully downloaded: 142
   ❌ Errors: 2
   📂 Folder: /path/to/downloaded_articles
======================================================================

✨ Done! All articles downloaded.
```

## 🛡️ Ethical Guidelines

* Use only for content you have legal access to
* Respect website terms of service
* Use reasonable delays between requests
* Do not overload servers
* Do not use to bypass paid content without subscription
* Do not redistribute downloaded content without permission

## 📝 License

MIT License - free to use, modify, and distribute.

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## ⚠️ Disclaimer

This tool is intended for personal use and archiving content you have legal access to. The author is not responsible for misuse.

## 📧 Support

If you encounter issues, create an [Issue](https://github.com/pogos-akopian/article-scraper/issues) with:

* Node.js version (run `node --version`)
* Error message
* Screenshot (if available)

---

⭐ If this project was helpful, give it a star on GitHub!
