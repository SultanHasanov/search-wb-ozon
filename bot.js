const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Конфигурация
const bot = new Telegraf('8190479365:AAHnjDWn6sr_8SF6Cj_jw7HR2-Cu1fM_syA');
const API_KEY = '2UPMMWRKGTCQMGWW';
const API_BASE = 'https://api.moneyplace.io';

// Хранилище состояний пользователей
const userStates = new Map();

// Константы
const MARKETPLACES = {
  wildberries: { name: 'Wildberries', emoji: '🟣' },
  ozon: { name: 'Ozon', emoji: '🔵' },
  ali: { name: 'AliExpress', emoji: '🟠' }
};

const PERIODS = {
  week: 'Неделя',
  two_weeks: '2 недели',
  month: 'Месяц'
};

const TYPES = {
  fbo: 'FBO (склад МП)',
  fbs: 'FBS (склад продавца)'
};

// Утилиты
const formatNumber = (num) => {
  return new Intl.NumberFormat('ru-RU').format(num || 0);
};

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(price || 0);
};

const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// API функции
const makeApiRequest = async (endpoint, params = {}) => {
  try {
    const queryParams = new URLSearchParams(params);
    const url = `${API_BASE}${endpoint}?${queryParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Token ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw new Error(`Ошибка API: ${error.response?.status || error.message}`);
  }
};

const searchProducts = async (searchQuery, mp, type, period, page = 1) => {
  const params = {
    mp: mp,
    type: type,
    period: period,
    sort: '-turnover',
    'per-page': 10,
    page: page,
  };

  if (searchQuery && searchQuery.trim()) {
    params['q[name][like]'] = searchQuery;
  }

  return await makeApiRequest('/statistic/product', params);
};

// Получение или создание состояния пользователя
const getUserState = (userId) => {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      mp: 'wildberries',
      type: 'fbo',
      period: 'month',
      lastSearch: '',
      currentPage: 1
    });
  }
  return userStates.get(userId);
};

// Команды бота
bot.start((ctx) => {
  const welcomeMessage = `
🛍️ *Добро пожаловать в бот поиска товаров!*

Этот бот поможет вам найти товары и получить их статистику продаж.

📋 *Доступные команды:*
/search - поиск товаров
/settings - настройки фильтров
/help - помощь

🔍 Просто отправьте название товара для быстрого поиска!
  `;

  ctx.replyWithMarkdown(welcomeMessage, 
    Markup.keyboard([
      ['🔍 Поиск товаров', '⚙️ Настройки'],
      ['📊 Топ товары', '❓ Помощь']
    ]).resize()
  );
});

bot.help((ctx) => {
  const helpMessage = `
📖 *Справка по использованию бота*

*Команды:*
/search - начать поиск товаров
/settings - изменить настройки фильтров (маркетплейс, тип, период)
/top - показать топ товары без поиска

*Быстрый поиск:*
Просто отправьте название товара, и бот найдет релевантные результаты

*Настройки фильтров:*
• Маркетплейс: Wildberries, Ozon, AliExpress  
• Тип: FBO (склад МП), FBS (склад продавца)
• Период: Неделя, 2 недели, Месяц

*Кнопки товаров:*
📋 - скопировать артикул
🔗 - открыть на сайте МП
📊 - подробная статистика

*Навигация:*
Используйте кнопки "◀️ Назад" и "Вперед ▶️" для просмотра результатов
  `;

  ctx.replyWithMarkdown(helpMessage);
});

// Настройки
bot.command('settings', (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  const currentSettings = `
⚙️ *Текущие настройки:*

${MARKETPLACES[state.mp].emoji} Маркетплейс: ${MARKETPLACES[state.mp].name}
📦 Тип: ${TYPES[state.type]}  
📅 Период: ${PERIODS[state.period]}
  `;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏪 Маркетплейс', 'settings_mp')],
    [Markup.button.callback('📦 Тип склада', 'settings_type')],
    [Markup.button.callback('📅 Период', 'settings_period')],
    [Markup.button.callback('✅ Готово', 'settings_done')]
  ]);

  ctx.replyWithMarkdown(currentSettings, keyboard);
});

// Обработка настроек маркетплейса
bot.action('settings_mp', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🟣 Wildberries', 'mp_wildberries')],
    [Markup.button.callback('🔵 Ozon', 'mp_ozon')],
    [Markup.button.callback('🟠 AliExpress', 'mp_ali')],
    [Markup.button.callback('◀️ Назад', 'settings_back')]
  ]);

  ctx.editMessageText('🏪 Выберите маркетплейс:', keyboard);
});

// Обработка настроек типа
bot.action('settings_type', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📦 FBO (склад МП)', 'type_fbo')],
    [Markup.button.callback('🏠 FBS (склад продавца)', 'type_fbs')],
    [Markup.button.callback('◀️ Назад', 'settings_back')]
  ]);

  ctx.editMessageText('📦 Выберите тип склада:', keyboard);
});

// Обработка настроек периода
bot.action('settings_period', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📅 Неделя', 'period_week')],
    [Markup.button.callback('📅 2 недели', 'period_two_weeks')],
    [Markup.button.callback('📅 Месяц', 'period_month')],
    [Markup.button.callback('◀️ Назад', 'settings_back')]
  ]);

  ctx.editMessageText('📅 Выберите период:', keyboard);
});

// Обработчики выбора значений
bot.action(/^mp_(.+)$/, (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const mp = ctx.match[1];
  
  state.mp = mp;
  ctx.answerCbQuery(`Выбран маркетплейс: ${MARKETPLACES[mp].name}`);
  
  // Возврат к настройкам
  ctx.scene.enter ? null : ctx.answerCbQuery();
  return ctx.scene.enter ? null : showSettings(ctx);
});

bot.action(/^type_(.+)$/, (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const type = ctx.match[1];
  
  state.type = type;
  ctx.answerCbQuery(`Выбран тип: ${TYPES[type]}`);
  return showSettings(ctx);
});

bot.action(/^period_(.+)$/, (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const period = ctx.match[1];
  
  state.period = period;
  ctx.answerCbQuery(`Выбран период: ${PERIODS[period]}`);
  return showSettings(ctx);
});

bot.action('settings_back', (ctx) => {
  return showSettings(ctx);
});

bot.action('settings_done', (ctx) => {
  ctx.editMessageText('✅ Настройки сохранены!');
});

const showSettings = (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);

  const currentSettings = `
⚙️ *Текущие настройки:*

${MARKETPLACES[state.mp].emoji} Маркетплейс: ${MARKETPLACES[state.mp].name}
📦 Тип: ${TYPES[state.type]}  
📅 Период: ${PERIODS[state.period]}
  `;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏪 Маркетплейс', 'settings_mp')],
    [Markup.button.callback('📦 Тип склада', 'settings_type')],
    [Markup.button.callback('📅 Период', 'settings_period')],
    [Markup.button.callback('✅ Готово', 'settings_done')]
  ]);

  ctx.editMessageText(currentSettings, { parse_mode: 'Markdown', ...keyboard });
};

// Поиск товаров
bot.command('search', (ctx) => {
  ctx.reply('🔍 Введите название товара для поиска:');
});

bot.command('top', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  
  try {
    await ctx.reply('⏳ Загружаю топ товары...');
    const products = await searchProducts('', state.mp, state.type, state.period, 1);
    await showProductResults(ctx, products, '', 1);
  } catch (error) {
    ctx.reply(`❌ Ошибка при загрузке топ товаров: ${error.message}`);
  }
});

// Обработка текстовых сообщений (поиск)
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const searchQuery = ctx.message.text;

  // Игнорируем команды
  if (searchQuery.startsWith('/')) return;

  // Игнорируем кнопки клавиатуры
  const keyboardButtons = ['🔍 Поиск товаров', '⚙️ Настройки', '📊 Топ товары', '❓ Помощь'];
  if (keyboardButtons.includes(searchQuery)) {
    switch (searchQuery) {
      case '🔍 Поиск товаров':
        return ctx.reply('🔍 Введите название товара для поиска:');
      case '⚙️ Настройки':
        return ctx.scene.enter ? ctx.scene.enter('settings') : showSettings(ctx);
      case '📊 Топ товары':
        return bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/top' } });
      case '❓ Помощь':
        return bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/help' } });
    }
  }

  try {
    await ctx.reply('🔍 Ищу товары...');
    
    state.lastSearch = searchQuery;
    state.currentPage = 1;
    
    const products = await searchProducts(searchQuery, state.mp, state.type, state.period, 1);
    await showProductResults(ctx, products, searchQuery, 1);
    
  } catch (error) {
    ctx.reply(`❌ Ошибка при поиске: ${error.message}`);
  }
});

// Показ результатов поиска с изображениями
const showProductResults = async (ctx, products, searchQuery, page) => {
  if (!products || products.length === 0) {
    return ctx.reply('😔 Товары не найдены. Попробуйте изменить запрос или настройки.');
  }

  const userId = ctx.from.id;
  const state = getUserState(userId);
  
  // Отправляем заголовок с информацией о поиске
  let headerMessage = `🔍 *Результаты поиска* ${searchQuery ? `по запросу: "${searchQuery}"` : ''}\n\n`;
  headerMessage += `${MARKETPLACES[state.mp].emoji} ${MARKETPLACES[state.mp].name} | ${TYPES[state.type]} | ${PERIODS[state.period]}\n`;
  headerMessage += `📄 Страница: ${page}\n\n`;
  
  await ctx.replyWithMarkdown(headerMessage);

  // Отправляем каждый товар отдельным сообщением с изображением
  for (let index = 0; index < products.length; index++) {
    const product = products[index];
    const number = (page - 1) * 10 + index + 1;
    
    let caption = `*${number}. ${truncateText(product.product?.name, 80)}*\n\n`;
    caption += `💰 Выручка: ${formatNumber(product.turnover)} ₽\n`;
    caption += `📦 Продажи: ${formatNumber(product.Sales)} шт\n`;
    caption += `💵 Цена: ${formatPrice(product.product?.real_price)}\n`;
    caption += `📋 Артикул: \`${product.sku}\`\n`;
    
    if (product.product?.rate) {
      caption += `⭐ Рейтинг: ${product.product.rate} (${formatNumber(product.product.comments_count)} отзывов)\n`;
    }

    // Кнопки для товара
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`📋 Копировать`, `copy_${product.sku}`),
        Markup.button.callback(`🔗 Открыть`, `open_${product.sku}_${state.mp}`)
      ]
    ]);

    try {
      if (product.product?.image) {
        // Отправляем изображение с подписью
        await ctx.replyWithPhoto(product.product.image, {
          caption: caption,
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        // Если изображения нет, отправляем только текст
        await ctx.replyWithMarkdown(caption, keyboard);
      }
      
      // Небольшая задержка между сообщениями, чтобы не превысить лимиты Telegram API
      if (index < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`Error sending product ${number}:`, error);
      // В случае ошибки с изображением, отправляем только текст
      try {
        await ctx.replyWithMarkdown(caption, keyboard);
      } catch (textError) {
        console.error(`Error sending text for product ${number}:`, textError);
      }
    }
  }

  // Кнопки навигации в отдельном сообщении
  const navButtons = [];
  if (page > 1) {
    navButtons.push(Markup.button.callback('◀️ Назад', `page_${page - 1}_${searchQuery}`));
  }
  if (products.length === 10) { // Если есть следующая страница
    navButtons.push(Markup.button.callback('Вперед ▶️', `page_${page + 1}_${searchQuery}`));
  }
  
  const navigationKeyboard = [];
  if (navButtons.length > 0) {
    navigationKeyboard.push(navButtons);
  }
  navigationKeyboard.push([Markup.button.callback('🔍 Новый поиск', 'new_search')]);

  const keyboard = Markup.inlineKeyboard(navigationKeyboard);
  
  await ctx.reply('🔽 Навигация:', keyboard);
};

// Обработка кнопок
bot.action(/^copy_(.+)$/, (ctx) => {
  const sku = ctx.match[1];
  ctx.answerCbQuery(`📋 Артикул ${sku} скопирован!`, { show_alert: true });
  ctx.reply(`📋 Артикул товара: \`${sku}\`\n\nНажмите на артикул для копирования`, { parse_mode: 'Markdown' });
});

bot.action(/^open_(.+)_(.+)$/, (ctx) => {
  const sku = ctx.match[1];
  const mp = ctx.match[2];
  
  const urls = {
    wildberries: `https://www.wildberries.ru/catalog/${sku}/detail.aspx`,
    ozon: `https://www.ozon.ru/product/${sku}`,
    ali: `https://aliexpress.com/item/${sku}.html`,
  };

  const url = urls[mp];
  if (url) {
    ctx.answerCbQuery('🔗 Открываю товар...');
    ctx.reply(`🔗 Ссылка на товар:\n${url}`);
  } else {
    ctx.answerCbQuery('❌ Ошибка при открытии ссылки');
  }
});

// Функция для отправки изображения товара
const sendProductImage = async (ctx, productId, sku) => {
  try {
    // Здесь можно добавить запрос к API для получения дополнительной информации о товаре
    // Пока что просто отправляем уведомление
    ctx.answerCbQuery('🖼️ Изображение уже отображено выше');
  } catch (error) {
    ctx.answerCbQuery('❌ Ошибка при загрузке изображения');
  }
};

// Добавляем функцию для отправки большого изображения товара
bot.action(/^image_(.+)$/, async (ctx) => {
  const productSku = ctx.match[1];
  
  try {
    // Ищем товар в последних результатах поиска пользователя
    const userId = ctx.from.id;
    const state = getUserState(userId);
    
    // Делаем запрос для получения информации о конкретном товаре
    ctx.answerCbQuery('🖼️ Отправляю изображение в полном размере...');
    
    // Пока что просто уведомляем пользователя
    ctx.reply(`🖼️ Для просмотра изображения товара ${productSku} в полном размере используйте кнопку выше`);
    
  } catch (error) {
    ctx.answerCbQuery('❌ Ошибка при отправке изображения');
  }
});

bot.action(/^page_(\d+)_(.*)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const searchQuery = ctx.match[2] || '';
  
  const userId = ctx.from.id;
  const state = getUserState(userId);
  
  try {
    await ctx.answerCbQuery('⏳ Загружаю...');
    
    // Удаляем сообщение навигации
    await ctx.deleteMessage().catch(() => {});
    
    const products = await searchProducts(searchQuery, state.mp, state.type, state.period, page);
    await showProductResults(ctx, products, searchQuery, page);
    
  } catch (error) {
    ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
});

bot.action('new_search', (ctx) => {
  ctx.deleteMessage();
  ctx.reply('🔍 Введите новый запрос для поиска товаров:');
});

// Обработка кнопок клавиатуры
bot.hears('🔍 Поиск товаров', (ctx) => {
  ctx.reply('🔍 Введите название товара для поиска:');
});

bot.hears('⚙️ Настройки', (ctx) => {
  bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/settings' } });
});

bot.hears('📊 Топ товары', (ctx) => {
  bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/top' } });
});

bot.hears('❓ Помощь', (ctx) => {
  bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/help' } });
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
});

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Telegram bot started successfully!');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));