from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Конфигурация
BOT_TOKEN = '7883123635:AAG3OPyXoWka7Qs4WZNfyhgsW23xtZZH8jA'
ADMIN_IDS = [8480811736]
DATA_FILE = 'users_data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ✅ ГЛАВНАЯ СТРАНИЦА - отдаем index.html
@app.route('/')
def serve_index():
    try:
        return send_file('index.html')
    except:
        return """
        <h1>Super Clicker</h1>
        <p>Файл index.html не найден. Убедитесь, что он находится в той же папке что и server.py</p>
        """

# ✅ ОТДАЧА CSS
@app.route('/styles.css')
def serve_css():
    try:
        return send_file('styles.css')
    except:
        return "/* CSS файл не найден */", 404

# ✅ ОТДАЧА JS
@app.route('/script.js')
def serve_js():
    try:
        return send_file('script.js')
    except:
        return "// JS файл не найден", 404

# ... остальные API маршруты (такие же как выше) ...

if __name__ == '__main__':
    print("🚀 Запуск Super Clicker Server...")
    print("🎮 Игра доступна по адресу: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)