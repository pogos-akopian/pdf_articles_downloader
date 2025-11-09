// Установите зависимости: npm install puppeteer
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ====== НАСТРОЙКИ ======
const CONFIG = {
  startUrl: 'https://www.news.aakashg.com/p/complete-courses-pm?open=false#%C2%A7the-complete-ai-pm-certification',  // ВСТАВЬТЕ URL страницы со списком статей
  linkSelector: 'a[href]',                         // Все ссылки на странице
  filterPattern: null,                             // Фильтр по URL (например: '/article/' или null для всех)
  delay: 4000,                                     // Задержка между статьями (мс)
  outputFolder: './downloaded_articles',           // Папка для сохранения PDF
  headless: false,                                 // false = видите процесс, true = невидимый режим
  sessionFile: './session.json',                   // Файл для cookies
  
  // Дополнительные настройки
  excludePatterns: ['#', 'javascript:', 'mailto:', 'tel:'],  // Исключаем эти ссылки
  onlyInternalLinks: true,                         // Только ссылки с того же домена
  maxArticles: null,                               // Ограничение количества (null = все)
  startFrom: 1,                                    // Начать с N-ной статьи (для продолжения)
  
  // Настройки PDF
  pdfOptions: {
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  }
};

// ====== ОСНОВНОЙ КОД ======
async function main() {
  console.log('🚀 Article Scraper - Автоматическое скачивание статей в PDF\n');
  console.log('⚙️  Настройки:');
  console.log(`   📂 Папка: ${CONFIG.outputFolder}`);
  console.log(`   ⏱️  Задержка: ${CONFIG.delay}ms`);
  console.log(`   🎯 Фильтр: ${CONFIG.filterPattern || 'нет'}\n`);
  
  // Создаем папку для PDF
  if (!fs.existsSync(CONFIG.outputFolder)) {
    fs.mkdirSync(CONFIG.outputFolder, { recursive: true });
    console.log(`✓ Создана папка: ${CONFIG.outputFolder}\n`);
  }
  
  // Запускаем браузер
  console.log('🌐 Запускаем браузер...');
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
  
  // Устанавливаем User-Agent чтобы выглядеть как обычный браузер
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Загружаем сохраненную сессию (cookies) если есть
  if (fs.existsSync(CONFIG.sessionFile)) {
    const cookies = JSON.parse(fs.readFileSync(CONFIG.sessionFile));
    await page.setCookie(...cookies);
    console.log('✓ Загружена сохраненная сессия (авторизация)\n');
  } else {
    console.log('ℹ️  Сессия не найдена - потребуется авторизация\n');
  }
  
  // Переходим на страницу со списком статей
  console.log(`📄 Открываем: ${CONFIG.startUrl}`);
  await page.goto(CONFIG.startUrl, { 
    waitUntil: 'networkidle2',
    timeout: 60000 
  });
  
  // ПАУЗА ДЛЯ АВТОРИЗАЦИИ
  console.log('\n' + '='.repeat(70));
  console.log('⏸️  АВТОРИЗАЦИЯ (если нужна):');
  console.log('   1. Войдите в аккаунт в открывшемся браузере');
  console.log('   2. Убедитесь что видите защищённый контент');
  console.log('   3. Нажмите Enter в консоли для продолжения...');
  console.log('='.repeat(70) + '\n');
  await waitForEnter();
  
  // Сохраняем cookies после авторизации
  const cookies = await page.cookies();
  fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(cookies, null, 2));
  console.log('✓ Сессия сохранена (в следующий раз авторизация не нужна)\n');
  
  // Собираем все ссылки на статьи
  console.log('🔍 Собираем ссылки на статьи...');
  const articleLinks = await page.evaluate((config) => {
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    
    // Находим все ссылки
    const allLinks = Array.from(document.querySelectorAll(config.selector))
      .map(a => {
        try {
          const href = a.href;
          // Пропускаем пустые и специальные ссылки
          if (!href || 
              config.excludePatterns.some(pattern => href.startsWith(pattern))) {
            return null;
          }
          return href;
        } catch (e) {
          return null;
        }
      })
      .filter(href => href !== null);
    
    // Фильтруем
    let filtered = [...new Set(allLinks)]; // Убираем дубликаты
    
    // Только внутренние ссылки (с того же сайта)
    if (config.onlyInternal) {
      filtered = filtered.filter(link => link.startsWith(baseUrl));
    }
    
    // Фильтр по паттерну
    if (config.filterPattern) {
      filtered = filtered.filter(link => link.includes(config.filterPattern));
    }
    
    // Исключаем текущую страницу
    filtered = filtered.filter(link => !link.includes(currentPath));
    
    return filtered;
  }, {
    selector: CONFIG.linkSelector,
    excludePatterns: CONFIG.excludePatterns,
    onlyInternal: CONFIG.onlyInternalLinks,
    filterPattern: CONFIG.filterPattern
  });
  
  console.log(`✓ Найдено ${articleLinks.length} уникальных ссылок\n`);
  
  if (articleLinks.length === 0) {
    console.log('❌ Ссылки не найдены!');
    console.log('💡 Попробуйте:');
    console.log('   - Проверить CSS селектор (сейчас: ' + CONFIG.linkSelector + ')');
    console.log('   - Изменить фильтр (сейчас: ' + CONFIG.filterPattern + ')');
    console.log('   - Убедиться что вы авторизованы');
    await browser.close();
    return;
  }
  
  // Показываем первые 5 ссылок для проверки
  console.log('📋 Первые найденные ссылки:');
  articleLinks.slice(0, 5).forEach((link, i) => {
    console.log(`   ${i + 1}. ${link}`);
  });
  if (articleLinks.length > 5) {
    console.log(`   ... и ещё ${articleLinks.length - 5} ссылок`);
  }
  console.log('');
  
  // Применяем ограничения
  let linksToDownload = articleLinks;
  if (CONFIG.startFrom > 0) {
    linksToDownload = linksToDownload.slice(CONFIG.startFrom);
    console.log(`⏩ Начинаем с статьи #${CONFIG.startFrom + 1}\n`);
  }
  if (CONFIG.maxArticles) {
    linksToDownload = linksToDownload.slice(0, CONFIG.maxArticles);
    console.log(`🎯 Ограничение: скачаем ${CONFIG.maxArticles} статей\n`);
  }
  
  console.log('='.repeat(70));
  console.log(`📥 НАЧИНАЕМ СКАЧИВАНИЕ ${linksToDownload.length} СТАТЕЙ`);
  console.log('='.repeat(70) + '\n');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Скачиваем каждую статью
  for (let i = 0; i < linksToDownload.length; i++) {
    const link = linksToDownload[i];
    const articleNumber = CONFIG.startFrom + i + 1;
    const filename = `article_${String(articleNumber).padStart(4, '0')}.pdf`;
    const filepath = path.join(CONFIG.outputFolder, filename);
    
    // Пропускаем если файл уже существует
    if (fs.existsSync(filepath)) {
      console.log(`[${articleNumber}/${articleLinks.length}] ⏭️  Пропускаем (уже существует): ${filename}`);
      successCount++;
      continue;
    }
    
    console.log(`\n[${articleNumber}/${articleLinks.length}] 📄 ${link}`);
    
    try {
      // Открываем статью
      await page.goto(link, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      // Ждем загрузки контента
      await sleep(3000);
      
      // Сохраняем как PDF
      await page.pdf({
        path: filepath,
        ...CONFIG.pdfOptions
      });
      
      const fileSize = (fs.statSync(filepath).size / 1024).toFixed(2);
      console.log(`   ✅ Сохранено: ${filename} (${fileSize} KB)`);
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ Ошибка: ${error.message}`);
      errorCount++;
      errors.push({ number: articleNumber, link, error: error.message });
      
      // Сохраняем скриншот ошибки
      try {
        const errorScreenshot = path.join(CONFIG.outputFolder, `error_${articleNumber}.png`);
        await page.screenshot({ path: errorScreenshot });
        console.log(`   📸 Скриншот ошибки: error_${articleNumber}.png`);
      } catch (e) {}
    }
    
    // Задержка между статьями (кроме последней)
    if (i < linksToDownload.length - 1) {
      const delaySeconds = (CONFIG.delay / 1000).toFixed(1);
      process.stdout.write(`   ⏳ Ждём ${delaySeconds}с...`);
      await sleep(CONFIG.delay);
      process.stdout.write(' готово\n');
    }
  }
  
  // Итоговая статистика
  console.log('\n' + '='.repeat(70));
  console.log('📊 СТАТИСТИКА:');
  console.log(`   ✅ Успешно скачано: ${successCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}`);
  console.log(`   📂 Папка: ${path.resolve(CONFIG.outputFolder)}`);
  console.log('='.repeat(70) + '\n');
  
  // Список ошибок
  if (errors.length > 0) {
    console.log('❌ ОШИБКИ:');
    errors.forEach(err => {
      console.log(`   [${err.number}] ${err.link}`);
      console.log(`        → ${err.error}`);
    });
    console.log('');
    
    // Сохраняем список ошибок в файл
    const errorLog = path.join(CONFIG.outputFolder, 'errors.json');
    fs.writeFileSync(errorLog, JSON.stringify(errors, null, 2));
    console.log(`💾 Список ошибок сохранён: ${errorLog}\n`);
  }
  
  console.log('✨ Готово! Все статьи скачаны.\n');
  
  await browser.close();
}

// Вспомогательная функция - ждем Enter
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

// Вспомогательная функция - задержка
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Критическая ошибка:', error);
  process.exit(1);
});

// Запускаем
main().catch(console.error);