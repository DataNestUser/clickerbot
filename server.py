from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

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
    
    # Обновляем последнее время сохранения
    user_data['lastSaved'] = datetime.now().isoformat()
    
    data[str(user_id)] = user_data
    save_data(data)
    
    return jsonify({'status': 'success'})

# API для таблицы лидеров (исключаем заблокированных)
@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    data = load_data()
    
    # Создаем список пользователей для таблицы лидеров
    leaderboard = []
    for user_id, user_data in data.items():
        # Пропускаем заблокированных пользователей
        if user_data.get('accountStatus', {}).get('isBanned', False):
            continue
            
        leaderboard.append({
            'user_id': user_id,
            'username': user_data.get('username', 'Игрок'),
            'coins': user_data.get('coins', 0),
            'level': user_data.get('level', 1),
            'totalClicks': user_data.get('totalClicks', 0)
        })
    
    # Сортируем по количеству монет (по убыванию)
    leaderboard.sort(key=lambda x: x['coins'], reverse=True)
    
    # Возвращаем топ-10
    return jsonify(leaderboard[:10])

# API для получения статистики
@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    
    total_users = len(data)
    active_users = sum(1 for user in data.values() if not user.get('accountStatus', {}).get('isBanned', False))
    banned_users = sum(1 for user in data.values() if user.get('accountStatus', {}).get('isBanned', False))
    frozen_users = sum(1 for user in data.values() if user.get('accountStatus', {}).get('isFrozen', False))
    total_coins = sum(user.get('coins', 0) for user in data.values())
    total_clicks = sum(user.get('totalClicks', 0) for user in data.values())
    
    return jsonify({
        'total_users': total_users,
        'active_users': active_users,
        'banned_users': banned_users,
        'frozen_users': frozen_users,
        'total_coins': total_coins,
        'total_clicks': total_clicks
    })

# API для админ-панели
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    # Простая проверка админа (в реальном приложении нужна настоящая аутентификация)
    admin_id = request.args.get('admin_id')
    if not admin_id or int(admin_id) not in [123456789]:  # Ваш Telegram ID
        return jsonify({'error': 'Access denied'}), 403
    
    data = load_data()
    return jsonify(data)

# API для массовых действий
@app.route('/api/admin/cleanup', methods=['POST'])
def cleanup_users():
    admin_id = request.args.get('admin_id')
    if not admin_id or int(admin_id) not in [123456789]:
        return jsonify({'error': 'Access denied'}), 403
    
    data = load_data()
    now = datetime.now().timestamp() * 1000
    
    # Удаляем аккаунты, которые не активны более 30 дней
    inactive_threshold = 30 * 24 * 60 * 60 * 1000  # 30 дней в миллисекундах
    cleaned_count = 0
    
    for user_id, user_data in list(data.items()):
        last_saved = user_data.get('lastSaved')
        if last_saved:
            last_saved_dt = datetime.fromisoformat(last_saved.replace('Z', '+00:00'))
            last_saved_ts = last_saved_dt.timestamp() * 1000
            
            if (now - last_saved_ts) > inactive_threshold and user_data.get('level', 1) < 5:
                del data[user_id]
                cleaned_count += 1
    
    save_data(data)
    
    return jsonify({'cleaned_count': cleaned_count, 'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)