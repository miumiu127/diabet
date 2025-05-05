from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder="static")

# Загрузка модели
try:
    model_path = "Ensemble_model_best.joblib"
    model_info = joblib.load(model_path)
    model = model_info['model']
    selected_feature_names = model_info.get('selected_feature_names')
    
    # Загрузка порядка признаков
    if selected_feature_names:
        FEATURE_ORDER = selected_feature_names
    else:
        feature_path = "feature_names.json"
        if os.path.exists(feature_path):
            with open(feature_path, "r") as f:
                feature_data = json.load(f)
                FEATURE_ORDER = feature_data.get('features', [])
        else:
            # Стандартный набор признаков
            FEATURE_ORDER = ['HighBP', 'HighChol', 'BMI', 'HeartDiseaseorAttack', 'HvyAlcoholConsump', 
                            'GenHlth', 'DiffWalk', 'Sex', 'Age', 'Income']
except Exception as e:
    model = None
    FEATURE_ORDER = None

# Главная страница
@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

# Обработка предсказания
@app.route("/predict", methods=["POST"])
def predict():
    # Проверка доступности модели
    if model is None or FEATURE_ORDER is None:
        return jsonify({"error": "Модель или список признаков не загружены."}), 500

    try:
        # Получение данных
        raw_data = request.form.to_dict()
        
        # Получаем имя пациента
        patient_name = raw_data.get('patientName', '')
        
        # Проверка наличия необходимых признаков
        missing_features = [f for f in FEATURE_ORDER if f not in raw_data and f in ['HighBP', 'HighChol', 'BMI', 'Age', 'GenHlth']]
        if missing_features:
            return jsonify({"error": f"Отсутствуют необходимые признаки: {', '.join(missing_features)}"}), 400

        # Значения по умолчанию
        DEFAULT_VALUES = {
            'HighBP': 0, 'HighChol': 0, 'CholCheck': 0, 'BMI': 25.0,
            'Smoker': 0, 'Stroke': 0, 'HeartDiseaseorAttack': 0,
            'PhysActivity': 0, 'Fruits': 0, 'Veggies': 0,
            'HvyAlcoholConsump': 0, 'AnyHealthcare': 0, 'NoDocbcCost': 0,
            'GenHlth': 3, 'MentHlth': 0, 'PhysHlth': 0, 'DiffWalk': 0,
            'Sex': 0, 'Age': 9, 'Education': 4, 'Income': 5
        }

        # Подготовка данных
        data = {}
        for key in DEFAULT_VALUES:
            try:
                data[key] = float(raw_data.get(key, DEFAULT_VALUES[key]))
            except ValueError:
                return jsonify({"error": f"Недопустимое значение для {key}: {raw_data.get(key)}"}), 400

        # Проверка диапазонов значений
        if not (10 <= data['BMI'] <= 100):
            return jsonify({"error": f"BMI должен быть в диапазоне 10-100, получено: {data['BMI']}"}), 400
        
        if not (1 <= data['Age'] <= 13):
            return jsonify({"error": f"Возраст должен быть в диапазоне 1-13, получено: {data['Age']}"}), 400

        # Создаем DataFrame с нужными признаками
        input_df = pd.DataFrame([data])
        
        # Добавляем отсутствующие признаки и сортируем
        for feature in FEATURE_ORDER:
            if feature not in input_df.columns:
                input_df[feature] = 0
        
        input_df = input_df[FEATURE_ORDER]
        
        # Предсказание
        prediction = model.predict(input_df)[0]
        probability = model.predict_proba(input_df)[0][1]
        result_text = "Диабет" if prediction == 1 else "Нет диабета"
        
        # Сохранение результата в JSON
        prediction_data = {
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "patientName": patient_name,
            "prediction": result_text,
            "probability": float(f"{probability:.4f}"),
            "parameters": {
                "BMI": float(data['BMI']),
                "Age": int(data['Age']),
                "HighBP": int(data['HighBP']),
                "GenHlth": int(data['GenHlth']),
                "HighChol": int(data['HighChol'])
            }
        }
        
        # Запись в JSON-файл
        predictions_file = "predictions.json"
        try:
            predictions = []
            if os.path.exists(predictions_file):
                with open(predictions_file, 'r', encoding='utf-8') as f:
                    try:
                        predictions = json.load(f)
                    except json.JSONDecodeError:
                        pass
            
            predictions.append(prediction_data)
            
            with open(predictions_file, 'w', encoding='utf-8') as f:
                json.dump(predictions, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        
        return jsonify({
            "prediction": result_text,
            "probability": f"{probability:.2f}",
            "patientName": patient_name
        })

    except Exception as e:
        return jsonify({"error": f"Ошибка предсказания: {str(e)}"}), 400

# Запуск
if __name__ == "__main__":
    app.run(debug=True)
