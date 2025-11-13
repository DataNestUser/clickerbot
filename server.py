from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Конфигурация
BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'  # Замените на токен бота
ADMIN_IDS = [123456789]  # Замените на ваш Telegram ID

# Файл для хранения данных
DATA_FILE = 'users_data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ✅ ГЛАВНАЯ СТРАНИЦА - добавьте этот маршрут
@app.route('/')
def index():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Super Clicker API Server</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Super Clicker API Server</h1>
            <p>Сервер успешно запущен и работает!</p>
            
            <h2>📡 Доступные API endpoints:</h2>
            
            <div class="endpoint">
                <strong>GET /api/stats</strong> - Статистика сервера
            </div>
            
            <div class="endpoint">
                <strong>GET /api/leaderboard</strong> - Таблица лидеров
            </div>
            
            <div class="endpoint">
                <strong>GET /api/user/&lt;user_id&gt;</strong> - Данные пользователя
            </div>
            
            <div class="endpoint">
                <strong>POST /api/user/&lt;user_id&gt;</strong> - Сохранение данных пользователя
            </div>
            
            <div class="endpoint">
                <strong>GET /api/admin/users?admin_id=123</strong> - Админ панель (только для админов)
            </div>
            
            <h2>🔧 Для разработчиков:</h2>
            <p>Frontend файлы (index.html, styles.css, script.js) должны быть размещены на хостинге или в Telegram Mini App.</p>
            
            <p><strong>Статус:</strong> ✅ Сервер работает нормально</p>
        </div>
    </body>
    </html>
    """

# API для получения данных пользователя
@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    data = load_data()
    user_data = data.get(str(user_id))
    
    if user_data:
        return jsonify(user_data)
    else:
        return jsonify({'error': 'User not found'}), 404

# API для сохранения данных пользователя
@app.route('/api/user/<user_id>', methods=['POST'])
def save_user(user_id):
    user_data = request.get_json()
    data = load_data()
    
    user_data['lastSaved'] = datetime.now().isoformat()
    data[str(user_id)] = user_data
    save_data(data)
    
    return jsonify({'status': 'success'})

# API для таблицы лидеров
@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    data = load_data()
    
    leaderboard = []
    for user_id, user_data in data.items():
        if user_data.get('accountStatus', {}).get('isBanned', False):
            continue
            
        leaderboard.append({
            'user_id': user_id,
            'username': user_data.get('username', 'Игрок'),
            'coins': user_data.get('coins', 0),
            'level': user_data.get('level', 1)
        })
    
    leaderboard.sort(key=lambda x: x['coins'], reverse=True)
    return jsonify(leaderboard[:10])

# API для статистики
@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    
    total_users = len(data)
    active_users = sum(1 for user in data.values() if not user.get('accountStatus', {}).get('isBanned', False))
    banned_users = sum(1 for user in data.values() if user.get('accountStatus', {}).get('isBanned', False))
    total_coins = sum(user.get('coins', 0) for user in data.values())
    
    return jsonify({
        'total_users': total_users,
        'active_users': active_users,
        'banned_users': banned_users,
        'total_coins': total_coins,
        'status': 'online',
        'timestamp': datetime.now().isoformat()
    })

# Проверка админа
def is_admin(user_id):
    return int(user_id) in ADMIN_IDS

# API для админ-панели
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    admin_id = request.args.get('admin_id')
    if not admin_id or not is_admin(int(admin_id)):
        return jsonify({'error': 'Access denied'}), 403
    
    data = load_data()
    return jsonify(data)

# ✅ Дополнительный маршрут для проверки здоровья сервера
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'users_count': len(load_data())
    })

if __name__ == '__main__':
    print("🚀 Запуск Super Clicker Server...")
    print("📍 Главная страница: http://localhost:5000")
    print("📊 API Статистика: http://localhost:5000/api/stats")
    print("🏅 Лидерборд: http://localhost:5000/api/leaderboard")
    print("❤️  Проверка здоровья: http://localhost:5000/health")
    print("🔧 Для остановки сервера нажмите Ctrl+C")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)