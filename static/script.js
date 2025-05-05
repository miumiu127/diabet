// Подключаем Chart.js
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

// Ждем загрузки Chart.js перед использованием
let chartReady = false;
chartScript.onload = function() {
    chartReady = true;
    console.log('Chart.js успешно загружен');
};

// Определяем метки для радарного графика (глобально)
const radarLabels = ['Высокое АД', 'Холестерин', 'BMI', 'Возраст', 'Общее здоровье'];
const radarKeys = ['HighBP', 'HighChol', 'BMI', 'Age', 'GenHlth'];

// Переключение дополнительных полей
document.getElementById('toggle-fields').addEventListener('click', function () {
    const additionalFields = document.querySelector('.additional-fields');
    const isVisible = additionalFields.style.display === 'block';
    
    additionalFields.style.display = isVisible ? 'none' : 'block';
    this.textContent = isVisible 
        ? 'Показать дополнительные факторы' 
        : 'Скрыть дополнительные факторы';
});

// Обработка отправки формы
document.getElementById('diabetes-form').addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    
    // Показываем индикатор загрузки
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p class="loading"><span class="spinner"></span> Выполняется анализ данных...</p>';
    resultDiv.style.backgroundColor = '#e9ecef';
    resultDiv.style.color = '#495057';
    resultDiv.classList.add('visible');
    
    // Скрываем графики
    document.getElementById('risk-bar-container').style.display = 'none';
    const chartElements = document.querySelectorAll('.charts-row, .radar-chart-container');
    chartElements.forEach(el => el.style.display = 'none');
    
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (response.ok) {
            const probability = parseFloat(result.probability);

            // Определяем категорию риска и рекомендации
            let riskLevel, recommendations;
            if (probability < 0.3) {
                riskLevel = "Низкий";
                recommendations = "Продолжайте поддерживать здоровый образ жизни. Рекомендуется контроль здоровья раз в год.";
            } else if (probability < 0.7) {
                riskLevel = "Средний";
                recommendations = "Обратите внимание на факторы риска. Рекомендуется консультация с врачом и анализ уровня глюкозы в крови.";
            } else {
                riskLevel = "Высокий";
                recommendations = "Настоятельно рекомендуется срочная консультация с врачом-эндокринологом и комплексное обследование.";
            }

            // Обновляем текстовый результат
            resultDiv.innerHTML = `
                <div class="result-header">
                    <h3>Результат предсказания</h3>
                    <div class="prediction-badge">${result.prediction}</div>
                </div>
                <div class="result-details">
                    <p><strong>Пациент:</strong> ${result.patientName}</p>
                    <p><strong>Вероятность диабета:</strong> ${(probability * 100).toFixed(2)}%</p>
                    <p><strong>Уровень риска:</strong> ${riskLevel}</p>
                    <p><strong>Рекомендации:</strong> ${recommendations}</p>
                </div>
            `;

            // Задаем цвет блоку результатов в зависимости от вероятности
            if (probability < 0.3) {
                resultDiv.style.backgroundColor = '#d4edda'; // зеленый
                resultDiv.style.color = '#155724';
            } else if (probability < 0.7) {
                resultDiv.style.backgroundColor = '#fff3cd'; // желтый
                resultDiv.style.color = '#856404';
            } else {
                resultDiv.style.backgroundColor = '#f8d7da'; // красный
                resultDiv.style.color = '#721c24';
            }

            // Показываем графики
            chartElements.forEach(el => el.style.display = '');

            // Обновляем прогресс-бар
            updateRiskBar(probability);

            // Рисуем графики
            renderCharts(probability, Object.fromEntries(formData.entries()));
            
            // Прокручиваем страницу к результатам
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Обрабатываем ошибки от сервера
            let errorMessage = result.error || 'Произошла неизвестная ошибка при анализе данных';
            
            // Делаем сообщения об ошибках более понятными для пользователя
            if (errorMessage.includes('BMI')) {
                errorMessage = 'Пожалуйста, проверьте значение индекса массы тела (BMI). Оно должно быть в диапазоне от 10 до 100.';
            } else if (errorMessage.includes('Age')) {
                errorMessage = 'Пожалуйста, выберите корректную возрастную категорию из списка.';
            } else if (errorMessage.includes('отсутствующие признаки')) {
                errorMessage = 'Пожалуйста, заполните все обязательные поля формы.';
            }
            
            resultDiv.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <div>
                        <p class="error-title">Ошибка при обработке данных</p>
                        <p class="error-message">${errorMessage}</p>
                    </div>
                </div>
            `;
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.color = '#721c24';
        }
    } catch (error) {
        // Обрабатываем ошибки сети
        resultDiv.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div>
                    <p class="error-title">Ошибка сети</p>
                    <p class="error-message">Не удалось связаться с сервером. Пожалуйста, проверьте ваше интернет-соединение и попробуйте снова.</p>
                </div>
            </div>
        `;
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.color = '#721c24';
    }
});

// Функция для обновления прогресс-бара
function updateRiskBar(probability) {
    const riskBar = document.getElementById('risk-bar');
    const percent = Math.round(probability * 100);
    riskBar.style.width = `${percent}%`;
    riskBar.textContent = `${percent}%`;

    if (percent < 30) {
        riskBar.style.backgroundColor = 'green';
    } else if (percent < 70) {
        riskBar.style.backgroundColor = 'orange';
    } else {
        riskBar.style.backgroundColor = 'red';
    }

    document.getElementById('risk-bar-container').style.display = 'block';
}

// Функция для отрисовки графиков
function renderCharts(probability, data) {
    // Проверяем, загружен ли Chart.js
    if (!chartReady) {
        console.warn('Chart.js еще не загружен. Пробуем отрисовать через 500 мс');
        setTimeout(() => renderCharts(probability, data), 500);
        return;
    }
    
    // Получаем контексты холстов
    const donutCtx = document.getElementById('donut-chart').getContext('2d');
    const riskMeterCtx = document.getElementById('risk-meter').getContext('2d');
    const radarCtx = document.getElementById('radar-chart').getContext('2d');

    // Удаляем старые графики, если есть
    if (window.donutChart) window.donutChart.destroy();
    if (window.riskBarChart) window.riskBarChart.destroy();
    if (window.radarChart) window.radarChart.destroy();

    // Кольцевая диаграмма
    window.donutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Риск диабета', 'Без риска'],
            datasets: [{
                data: [probability * 100, 100 - probability * 100],
                backgroundColor: ['red', 'lightgreen'],
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Вероятность диабета (в процентах)'
                }
            }
        }
    });

    // Гистограмма риска
    window.riskBarChart = new Chart(riskMeterCtx, {
        type: 'bar',
        data: {
            labels: ['Ваш риск'],
            datasets: [{
                label: 'Риск (%)',
                data: [probability * 100],
                backgroundColor: probability < 0.3 ? 'green' : (probability < 0.7 ? 'orange' : 'red')
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Гистограмма риска'
                },
                legend: { display: false }
            }
        }
    });

    // Радарная диаграмма
    // Используем уже объявленные глобальные переменные radarLabels и radarKeys
    
    // Преобразуем значения для нормализации на диаграмме
    const radarData = normalizeRadarData(data);

    window.radarChart = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: radarLabels,
            datasets: [{
                label: 'Ваш профиль',
                data: radarData,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'blue',
                borderWidth: 1,
                pointBackgroundColor: 'blue'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Профиль здоровья (по ключевым признакам)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const key = radarKeys[index];
                            const originalValue = data[key];
                            return `${key}: ${originalValue}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2
                    }
                }
            }
        }
    });
}

// Функция нормализации данных для радара
function normalizeRadarData(data) {
    // Теперь radarKeys доступна здесь, так как объявлена глобально
    const normalizedData = [];
    for (let i = 0; i < radarKeys.length; i++) {
        const key = radarKeys[i];
        let value = data[key];
        
        // Нормализация для разных типов данных
        if (key === 'BMI') {
            // BMI: нормализация от мин. 15 до макс. 50
            value = ((value - 15) / (50 - 15)) * 10;
        } else if (key === 'Age') {
            // Age: нормализация от 1 до 13 (возрастные категории)
            value = ((value - 1) / (13 - 1)) * 10;
        } else if (key === 'GenHlth') {
            // GenHlth: от 1 до 5, где 1 - отлично, 5 - плохо
            // Инвертируем шкалу, чтобы больший показатель означал лучшее здоровье
            value = ((5 - value) / 4) * 10;
        }
        
        // Ограничение значений от 0 до 10
        value = Math.max(0, Math.min(10, value));
        normalizedData.push(value);
    }
    return normalizedData;
}