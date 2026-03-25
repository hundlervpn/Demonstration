# Smart Home

Умный дом — веб-приложение для управления домашними устройствами с интеграцией ESP8266 через WebSocket.

## Запуск

## Демо-версия с авторизацией

В демо добавлена авторизация на главном экране:
- вход по email-коду через Resend API;
- гостевой вход (ограниченный по времени).

### Настройка переменных окружения

Создайте файл `.env` на основе `.env.example` и задайте ключ Resend:

```env
APP_URL=http://localhost:3000
RESEND_API_KEY=re_xxxxxxxxx
```

Обязательно замените `re_xxxxxxxxx` на ваш реальный API-ключ Resend.

### Docker (Рекомендуется)

```bash
docker build -t smart-home .
docker run -p 3000:3000 -p 3001:3001 \
  -e APP_URL=http://localhost:3000 \
  -e RESEND_API_KEY=re_xxxxxxxxx \
  smart-home
```

Откройте http://localhost:3000

### Локальная разработка

**Требования:** Node.js 20+, Docker (опционально)

```bash
npm install
npm run dev:all
```

## Архитектура

```
ESP8266 (WebSocket) → WebSocket Server (port 3001) → Next.js (port 3000) → UI
```

## ESP8266

**URL:** `ws://YOUR_SERVER_IP:3001`

**Формат данных:**
```json
{
  "room": "kitchen",
  "sensor": "gas",
  "value": 250,
  "timestamp": 12345678,
  "api_key": "your-secret-key"
}
```

**Поля:**
- `room` — обязательно (`kitchen`, `hallway`, `bathroom`, `office`, `street`)
- `sensor` — обязательно (`gas`, `motion`, `temperature`, `humidity`, `water_leak`)
- `value` — обязательно (число, строка или boolean)
- `timestamp` — опционально (автоматически генерируется сервером)
- `api_key` — опционально (если настроена аутентификация)

**Комнаты:** `kitchen`, `hallway`, `bathroom`, `office`, `street`

**Типы датчиков:** `gas`, `motion`, `temperature`, `humidity`, `water_leak`

## Docker Команды

| Команда | Описание |
|---------|----------|
| `docker build -t smart-home .` | Сборка образа |
| `docker run -p 3000:3000 -p 3001:3001 smart-home` | Запуск контейнера |
| `docker compose up` | Запуск через docker-compose |

### NPM Скрипты (для разработки)

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Next.js (порт 3000) |
| `npm run ws-server` | WebSocket сервер (порт 3001) |
| `npm run cv-client` | Python клиент распознавания лиц |
| `npm run dev:all` | Next.js + WebSocket сервер |
| `npm run dev:all:cv` | Next.js + WebSocket сервер + CV клиент |
| `npm run test:ws` | WebSocket тестовый клиент |
| `npm run build` | Сборка |
| `npm run start` | Продакшн |

## Распознавание лиц

### Настройка

1. **Подготовка базы лиц:**
   - Создайте папку `faces/` в корне проекта
   - Добавьте изображения лиц в формате JPG/PNG/JPEG
   - Имена файлов = имена пользователей (например: `denis.jpg`, `admin.png`)

2. **Запуск с распознаванием:**
```bash
npm run dev:all:cv
```

### Требования для CV

**Python 3.12+**

**Библиотеки:**
```bash
pip install opencv-python face_recognition ultralytics numpy websockets
```

**Устройство:** Камера (индекс 0)

### Сообщения WebSocket

CV клиент отправляет сообщения в формате:
```json
{
  "room": "street",
  "sensor": "face_recognition",
  "value": "Denis",
  "timestamp": 1234567890
}
```

**Значения:**
- `"Denis"` — распознанное имя пользователя
- `"CHUZHOY"` — неизвестное лицо
- `"Searching..."` — поиск лиц в кадре

### Отображение в UI

- **Страница Улица** — последние распознанные лица, цветовая индикация (зеленый — известный, желтый — неизвестный)
- **Главная страница** — карточка улицы показывает статус камеры и последнее распознавание
- **Журнал событий** — фильтрация по типу "Распознавание лиц"

## Конфигурация (.env)

```env
WS_PORT=3001
WS_HOST=0.0.0.0
SENSOR_API_KEY=your-secret-key  # опционально
NEXT_PUBLIC_WS_URL=ws://localhost:3001  # опционально
```

## Тестирование

### Docker

```bash
# Запуск контейнера
docker run -p 3000:3000 -p 3001:3001 smart-home
```

### WebSocket Тестовый Клиент

Скрипт для симуляции ESP8266 сенсоров (требует Node.js).

```bash
# Одиночный тест (5 сообщений, затем выход)
npm run test:ws

# Бесконечный тест (повторяет циклы, остановка: Ctrl+C)
npm run test:ws -- --infinite

# Кастомный WebSocket URL
node scripts/test-websocket-client.js ws://192.168.1.100:3001
```

**Тестовые данные:**
- `kitchen` — газовый датчик (значение: 250)
- `hallway` — датчик движения (detected/clear, задержка 6 сек)
- `bathroom` — датчик протечки воды (значение: false)
- `office` — датчик влажности (значение: 65)
- 