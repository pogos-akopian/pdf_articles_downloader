// Install dependencies: npm install puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ====== CONFIGURATION ======
const CONFIG = {
  startUrl: 'https://www.yoursite.com/etc/etc/etc',  // Page URL with list of articles
  linkSelector: 'a[href]',                         // CSS selector for all links on the page
  filterPattern: null,                             // URL filter (e.g., '/article/') or null for all links
  delay: 4000,                                     // Delay between downloads in milliseconds
  outputFolder: './downloaded_articles',           // Folder to save PDFs
  headless: false,                                 // false = visible browser, true = headless mode
  sessionFile: './session.json',                   // File to store cookies (session)
  
  // Additional filters
  excludePatterns: ['#', 'javascript:', 'mailto:', 'tel:'],  // Exclude these link types
  onlyInternalLinks: true,                         // Keep only internal links from same domain
  maxArticles: null,                               // Max number of articles (null = all)
  startFrom: 1,                                    // Start from N-th article (for continuation)
  
  // PDF settings
  pdfOptions: {
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  }
};

// ====== MAIN SCRIPT ======
async function main() {
  console.log('🚀 Article Scraper - Automatic article-to-PDF downloader\n');
  console.log('⚙️  Settings:');
  console.log(`   📂 Folder: ${CONFIG.outputFolder}`);
  console.log(`   ⏱️  Delay: ${CONFIG.delay}ms`);
  console.log(`   🎯 Filter: ${CONFIG.filterPattern || 'none'}\n`);
  
  // Create output folder if it doesn't exist
  if (!fs.existsSync(CONFIG.outputFolder)) {
    fs.mkdirSync(CONFIG.outputFolder, { recursive: true });
    console.log(`✓ Folder created: ${CONFIG.outputFolder}\n`);
  }
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set a user agent to mimic a real browser
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Load saved session cookies if available
  if (fs.existsSync(CONFIG.sessionFile)) {
    const cookies = JSON.parse(fs.readFileSync(CONFIG.sessionFile));
    await page.setCookie(...cookies);
    console.log('✓ Loaded saved session (authorization)\n');
  } else {
    console.log('ℹ️  No saved session found – manual login may be required\n');
  }
  
  // Open the start page
  console.log(`📄 Opening: ${CONFIG.startUrl}`);
  await page.goto(CONFIG.startUrl, { 
    waitUntil: 'networkidle2',
    timeout: 60000 
  });
  
  // Pause for manual login
  console.log('\n' + '='.repeat(70));
  console.log('⏸️  AUTHENTICATION (if required):');
  console.log('   1. Log into your account in the opened browser');
  console.log('   2. Ensure you can see protected content');
  console.log('   3. Press Enter in the console to continue...');
  console.log('='.repeat(70) + '\n');
  await waitForEnter();
  
  // Save cookies after successful login
  const cookies = await page.cookies();
  fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(cookies, null, 2));
  console.log('✓ Session saved (no login needed next time)\n');
  
  // Collect all article links
  console.log('🔍 Collecting article links...');
  const articleLinks = await page.evaluate((config) => {
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    
    // Extract all <a> elements and filter valid hrefs
    const allLinks = Array.from(document.querySelectorAll(config.selector))
      .map(a => {
        try {
          const href = a.href;
          if (!href || config.excludePatterns.some(pattern => href.startsWith(pattern))) {
            return null;
          }
          return href;
        } catch (e) {
          return null;
        }
      })
      .filter(href => href !== null);
    
    // Remove duplicates
    let filtered = [...new Set(allLinks)];
    
    // Keep only internal links
    if (config.onlyInternal) {
      filtered = filtered.filter(link => link.startsWith(baseUrl));
    }
    
    // Apply custom filter pattern if provided
    if (config.filterPattern) {
      filtered = filtered.filter(link => link.includes(config.filterPattern));
    }
    
    // Exclude the current page itself
    filtered = filtered.filter(link => !link.includes(currentPath));
    
    return filtered;
  }, {
    selector: CONFIG.linkSelector,
    excludePatterns: CONFIG.excludePatterns,
    onlyInternal: CONFIG.onlyInternalLinks,
    filterPattern: CONFIG.filterPattern
  });
  
  console.log(`✓ Found ${articleLinks.length} unique links\n`);
  
  if (articleLinks.length === 0) {
    console.log('❌ No links found!');
    console.log('💡 Try adjusting:');
    console.log('   - CSS selector (currently: ' + CONFIG.linkSelector + ')');
    console.log('   - Filter pattern (currently: ' + CONFIG.filterPattern + ')');
    console.log('   - Ensure you are logged in');
    await browser.close();
    return;
  }
  
  // Preview first few found links
  console.log('📋 First found links:');
  articleLinks.slice(0, 5).forEach((link, i) => {
    console.log(`   ${i + 1}. ${link}`);
  });
  if (articleLinks.length > 5) {
    console.log(`   ...and ${articleLinks.length - 5} more`);
  }
  console.log('');
  
  // Apply start offset and article limit
  let linksToDownload = articleLinks;
  if (CONFIG.startFrom > 0) {
    linksToDownload = linksToDownload.slice(CONFIG.startFrom);
    console.log(`⏩ Starting from article #${CONFIG.startFrom + 1}\n`);
  }
  if (CONFIG.maxArticles) {
    linksToDownload = linksToDownload.slice(0, CONFIG.maxArticles);
    console.log(`🎯 Limit: downloading ${CONFIG.maxArticles} articles\n`);
  }
  
  console.log('='.repeat(70));
  console.log(`📥 BEGINNING DOWNLOAD OF ${linksToDownload.length} ARTICLES`);
  console.log('='.repeat(70) + '\n');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Loop through each link and download as PDF
  for (let i = 0; i < linksToDownload.length; i++) {
    const link = linksToDownload[i];
    const articleNumber = CONFIG.startFrom + i + 1;
    const filename = `article_${String(articleNumber).padStart(4, '0')}.pdf`;
    const filepath = path.join(CONFIG.outputFolder, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`[${articleNumber}/${articleLinks.length}] ⏭️  Skipping (already exists): ${filename}`);
      successCount++;
      continue;
    }
    
    console.log(`\n[${articleNumber}/${articleLinks.length}] 📄 ${link}`);
    
    try {
      // Open article page
      await page.goto(link, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Wait for content to fully load
      await sleep(3000);
      
      // Save page as PDF
      await page.pdf({
        path: filepath,
        ...CONFIG.pdfOptions
      });
      
      const fileSize = (fs.statSync(filepath).size / 1024).toFixed(2);
      console.log(`   ✅ Saved: ${filename} (${fileSize} KB)`);
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
      errors.push({ number: articleNumber, link, error: error.message });
      
      // Take screenshot of the error page
      try {
        const errorScreenshot = path.join(CONFIG.outputFolder, `error_${articleNumber}.png`);
        await page.screenshot({ path: errorScreenshot });
        console.log(`   📸 Error screenshot: error_${articleNumber}.png`);
      } catch (e) {}
    }
    
    // Wait between downloads
    if (i < linksToDownload.length - 1) {
      const delaySeconds = (CONFIG.delay / 1000).toFixed(1);
      process.stdout.write(`   ⏳ Waiting ${delaySeconds}s...`);
      await sleep(CONFIG.delay);
      process.stdout.write(' done\n');
    }
  }
  
  // Final statistics
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📂 Folder: ${path.resolve(CONFIG.outputFolder)}`);
  console.log('='.repeat(70) + '\n');
  
  // Log errors to file
  if (errors.length > 0) {
    console.log('❌ ERRORS:');
    errors.forEach(err => {
      console.log(`   [${err.number}] ${err.link}`);
      console.log(`        → ${err.error}`);
    });
    console.log('');
    
    const errorLog = path.join(CONFIG.outputFolder, 'errors.json');
    fs.writeFileSync(errorLog, JSON.stringify(errors, null, 2));
    console.log(`💾 Error log saved: ${errorLog}\n`);
  }
  
  console.log('✨ Done! All articles downloaded.\n');
  
  await browser.close();
}

// Helper function – wait for Enter key
function waitForEnter() {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('', () => {
      readline.close();
      resolve();
    });
  });
}

// Helper function – sleep/delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Critical error:', error);
  process.exit(1);
});

// Start script
main().catch(console.error);