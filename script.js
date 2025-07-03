// Configuración de sensores
const sensorsConfig = [
    { id: 'temp1', name: 'Temperatura Exterior', type: 'temperature', icon: '🌡️', unit: '°C', min: -10, max: 50, alertThreshold: 40, criticalThreshold: 45 },
    { id: 'hum1', name: 'Humedad Relativa', type: 'humidity', icon: '💧', unit: '%', min: 20, max: 100, alertThreshold: 80, criticalThreshold: 90 },
    { id: 'press1', name: 'Presión Atmosférica', type: 'pressure', icon: '📊', unit: 'hPa', min: 900, max: 1100, alertThreshold: 1050, criticalThreshold: 1080 },
    { id: 'co2_1', name: 'CO2 Interior', type: 'co2', icon: '🌬️', unit: 'ppm', min: 300, max: 2000, alertThreshold: 1000, criticalThreshold: 1500 }
];

// Estado del sistema
let systemState = {
    isMonitoring: false,
    sensors: new Map(),
    alerts: [],
    dataPoints: 0,
    startTime: null,
    intervalId: null,
    uptimeIntervalId: null
};

// Callbacks por tipo de sensor
const sensorCallbacks = {
    temperature: (data) => data.value > 35 && showNotification(`Temperatura elevada: ${data.value}°C`, 'warning'),
    humidity: (data) => data.value > 70 && showNotification(`Humedad alta: ${data.value}%`, 'warning'),
    pressure: (data) => (data.value < 980 || data.value > 1030) && showNotification(`Presión anómala: ${data.value} hPa`, 'warning'),
    co2: (data) => data.value > 800 && showNotification(`CO2 elevado: ${data.value} ppm`, 'warning')
};

// Gestor de eventos
class SensorEventManager extends EventTarget {
    constructor() {
        super();
        this.addEventListener('sensorAlert', (e) => this.handleSensorAlert(e.detail));
        this.addEventListener('dataReceived', (e) => this.handleDataReceived(e.detail));
        this.addEventListener('connectionError', (e) => this.handleConnectionError(e.detail));
    }

    handleSensorAlert({sensorId, sensorName, value, threshold, type}) {
        const alert = {
            id: Date.now(), sensorId, sensorName, value, threshold, type,
            timestamp: new Date(),
            severity: value > threshold * 1.2 ? 'critical' : 'warning'
        };
        
        systemState.alerts.unshift(alert);
        if (systemState.alerts.length > 10) systemState.alerts.length = 10;
        
        updateAlertsDisplay();
        this.triggerNotification(alert);
    }

    handleDataReceived({sensorId, data}) {
        systemState.dataPoints++;
        updateStats();
        
        const sensor = systemState.sensors.get(sensorId);
        sensor && sensorCallbacks[sensor.type]?.(data);
    }

    handleConnectionError({sensorId, error}) {
        console.error(`❌ Error ${sensorId}:`, error);
        showNotification('Error de conexión con sensores', 'error');
    }

    triggerNotification(alert) {
        const message = `${alert.sensorName}: ${alert.value}${getSensorUnit(alert.sensorId)}`;
        const isCritical = alert.severity === 'critical';
        
        showNotification(
            `${isCritical ? '🚨 CRÍTICO' : '⚠️ Advertencia'}: ${message}`, 
            isCritical ? 'error' : 'warning'
        );
        
        if (isCritical) {
            document.title = `🚨 ALERTA CRÍTICA - ${alert.sensorName}`;
            setTimeout(() => document.title = 'Panel de Control IoT - Sensores', 10000);
        }
    }
}

const eventManager = new SensorEventManager();

// API de sensores
class SensorAPI {
    static async fetchSensorData(sensorId) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const sensor = systemState.sensors.get(sensorId);
                if (!sensor) return reject(new Error(`Sensor ${sensorId} no encontrado`));
                if (Math.random() < 0.05) return reject(new Error(`Error de comunicación con sensor ${sensorId}`));

                const config = sensorsConfig.find(s => s.id === sensorId);
                resolve({
                    sensorId,
                    value: this.generateRealisticValue(config),
                    timestamp: new Date(),
                    quality: Math.random() > 0.1 ? 'good' : 'poor',
                    batteryLevel: Math.floor(Math.random() * 100) + 1
                });
            }, Math.random() * 500 + 100);
        });
    }

    static generateRealisticValue(config) {
        const range = config.max - config.min;
        let value = config.min + Math.random() * range;
        const hour = new Date().getHours();
        
        if (config.type === 'temperature') value += Math.sin((hour - 6) * Math.PI / 12) * 5;
        else if (config.type === 'humidity') value -= Math.sin((hour - 6) * Math.PI / 12) * 10;
        
        return Math.round(value * 100) / 100;
    }

    static async saveToDatabase(data) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const key = `sensor_data_${Date.now()}`;
                    if (!window.sensorDatabase) window.sensorDatabase = {};
                    window.sensorDatabase[key] = JSON.stringify(data);
                    resolve({ success: true, key, timestamp: new Date() });
                } catch (error) {
                    reject(new Error('Error al guardar en base de datos'));
                }
            }, Math.random() * 300 + 50);
        });
    }
}

// Inicialización y renderizado
function initializeSensors() {
    sensorsConfig.forEach(config => {
        systemState.sensors.set(config.id, {
            ...config, value: 0, status: 'normal', lastUpdate: null, isActive: true
        });
    });
    renderSensors();
}

function renderSensors() {
    const grid = document.getElementById('sensorsGrid');
    grid.innerHTML = '';
    systemState.sensors.forEach(sensor => grid.appendChild(createSensorCard(sensor)));
}

function createSensorCard(sensor) {
    const card = document.createElement('div');
    const statusClass = sensor.status === 'critical' ? 'status-critical' : 
                       sensor.status === 'alert' ? 'status-warning' : 'status-normal';
    
    card.className = `sensor-card ${(sensor.status === 'alert' || sensor.status === 'critical') ? 'alert' : ''}`;
    card.id = `sensor-${sensor.id}`;
    card.innerHTML = `
        <div class="sensor-header">
            <div>
                <div class="sensor-icon">${sensor.icon}</div>
                <h3>${sensor.name}</h3>
            </div>
            <div class="sensor-status ${statusClass}">${sensor.status.toUpperCase()}</div>
        </div>
        <div class="sensor-value">
            ${sensor.value}<span class="sensor-unit">${sensor.unit}</span>
        </div>
        <div class="sensor-details">
            <div class="detail-row">
                <span>Última actualización:</span>
                <span>${sensor.lastUpdate ? sensor.lastUpdate.toLocaleTimeString() : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span>Umbral de alerta:</span>
                <span>${sensor.alertThreshold}${sensor.unit}</span>
            </div>
            <div class="detail-row">
                <span>Estado:</span>
                <span>${sensor.isActive ? '🟢 Activo' : '🔴 Inactivo'}</span>
            </div>
        </div>
    `;
    return card;
}

// Actualización de sensores
async function updateSensor(sensorId) {
    const card = document.getElementById(`sensor-${sensorId}`);
    card?.classList.add('loading');
    
    try {
        const data = await SensorAPI.fetchSensorData(sensorId);
        const sensor = systemState.sensors.get(sensorId);
        
        Object.assign(sensor, {
            value: data.value,
            lastUpdate: data.timestamp,
            quality: data.quality,
            batteryLevel: data.batteryLevel,
            status: data.value >= sensor.criticalThreshold ? 'critical' : 
                   data.value >= sensor.alertThreshold ? 'alert' : 'normal'
        });
        
        eventManager.dispatchEvent(new CustomEvent('dataReceived', { detail: { sensorId, data } }));
        
        if (sensor.status !== 'normal') {
            eventManager.dispatchEvent(new CustomEvent('sensorAlert', {
                detail: { sensorId, sensorName: sensor.name, value: data.value, threshold: sensor.alertThreshold, type: sensor.type }
            }));
        }
        
        updateSensorCard(sensorId);
        
    } catch (error) {
        eventManager.dispatchEvent(new CustomEvent('connectionError', { detail: { sensorId, error: error.message } }));
    } finally {
        card?.classList.remove('loading');
    }
}

function updateSensorCard(sensorId) {
    const sensor = systemState.sensors.get(sensorId);
    const card = document.getElementById(`sensor-${sensorId}`);
    if (!card || !sensor) return;
    
    card.querySelector('.sensor-value').innerHTML = `${sensor.value}<span class="sensor-unit">${sensor.unit}</span>`;
    
    const statusEl = card.querySelector('.sensor-status');
    const statusClass = sensor.status === 'critical' ? 'status-critical' : 
                       sensor.status === 'alert' ? 'status-warning' : 'status-normal';
    statusEl.className = `sensor-status ${statusClass}`;
    statusEl.textContent = sensor.status.toUpperCase();
    
    card.className = `sensor-card ${(sensor.status === 'alert' || sensor.status === 'critical') ? 'alert' : ''}`;
    card.querySelector('.detail-row span:last-child').textContent = 
        sensor.lastUpdate ? sensor.lastUpdate.toLocaleTimeString() : 'N/A';
}

// Control del monitoreo
function startMonitoring() {
    if (systemState.isMonitoring) return;
    
    systemState.isMonitoring = true;
    systemState.startTime = new Date();
    
    systemState.intervalId = setInterval(() => {
        systemState.sensors.forEach((sensor, id) => {
            sensor.isActive && updateSensor(id);
        });
        updateLastUpdateTime();
    }, 3000);
    
    systemState.uptimeIntervalId = setInterval(updateUptime, 1000);
    showNotification('✅ Monitoreo iniciado', 'success');
}

function stopMonitoring() {
    if (!systemState.isMonitoring) return;
    
    systemState.isMonitoring = false;
    systemState.intervalId && clearInterval(systemState.intervalId);
    systemState.uptimeIntervalId && clearInterval(systemState.uptimeIntervalId);
    showNotification('⏹️ Monitoreo detenido', 'warning');
}

// Utilidades
const updateLastUpdateTime = () => document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

function updateUptime() {
    if (!systemState.startTime) return;
    
    const diff = Date.now() - systemState.startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    document.getElementById('uptime').textContent = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const updateStats = () => {
    document.getElementById('dataPoints').textContent = systemState.dataPoints;
    document.getElementById('alertCount').textContent = systemState.alerts.length;
};

function updateAlertsDisplay() {
    const alertsList = document.getElementById('alertsList');
    const alertsCount = document.getElementById('alertsCount');
    
    alertsCount.textContent = `${systemState.alerts.length} alertas`;
    
    if (systemState.alerts.length === 0) {
        alertsList.innerHTML = '<p style="opacity: 0.7; text-align: center;">No hay alertas activas</p>';
        return;
    }
    
    alertsList.innerHTML = systemState.alerts.map(alert => `
        <div class="alert-item">
            <strong>${alert.sensorName}</strong>
            <span class="alert-time">${alert.timestamp.toLocaleTimeString()}</span><br>
            Valor: ${alert.value}${getSensorUnit(alert.sensorId)} (Umbral: ${alert.threshold}${getSensorUnit(alert.sensorId)})<br>
            <small>Severidad: ${alert.severity === 'critical' ? '🔴 Crítica' : '🟡 Advertencia'}</small>
        </div>
    `).join('');
}

const getSensorUnit = (sensorId) => systemState.sensors.get(sensorId)?.unit || '';

// Funciones de control
function simulateAlert() {
    const sensorIds = Array.from(systemState.sensors.keys());
    const randomSensorId = sensorIds[Math.floor(Math.random() * sensorIds.length)];
    const sensor = systemState.sensors.get(randomSensorId);
    
    const alertValue = sensor.alertThreshold + Math.random() * 10;
    Object.assign(sensor, { value: alertValue, status: 'alert', lastUpdate: new Date() });
    
    eventManager.dispatchEvent(new CustomEvent('sensorAlert', {
        detail: { sensorId: randomSensorId, sensorName: sensor.name, value: alertValue, threshold: sensor.alertThreshold, type: sensor.type }
    }));
    
    updateSensorCard(randomSensorId);
    showNotification(`🚨 Alerta simulada en ${sensor.name}`, 'warning');
}

const clearAlerts = () => {
    systemState.alerts = [];
    updateAlertsDisplay();
    showNotification('🧹 Alertas limpiadas', 'success');
};

async function saveData() {
    try {
        showNotification('💾 Guardando datos...', 'info');
        
        const allData = Array.from(systemState.sensors.entries()).map(([id, sensor]) => ({
            sensorId: id, sensorName: sensor.name, value: sensor.value, 
            timestamp: sensor.lastUpdate, status: sensor.status, type: sensor.type
        }));
        
        await SensorAPI.saveToDatabase({
            sensors: allData, alerts: systemState.alerts,
            stats: { dataPoints: systemState.dataPoints, uptime: systemState.startTime ? Date.now() - systemState.startTime : 0 },
            timestamp: new Date()
        });
        
        showNotification('✅ Datos guardados exitosamente', 'success');
    } catch (error) {
        showNotification('❌ Error al guardar datos', 'error');
    }
}

// Sistema de notificaciones
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Funciones adicionales
const generateDailyReport = () => ({
    date: new Date().toLocaleDateString(),
    sensors: Array.from(systemState.sensors.entries()).map(([id, sensor]) => ({
        id, name: sensor.name, currentValue: sensor.value, status: sensor.status, lastUpdate: sensor.lastUpdate
    })),
    totalAlerts: systemState.alerts.length,
    criticalAlerts: systemState.alerts.filter(a => a.severity === 'critical').length,
    dataPoints: systemState.dataPoints
});

function exportData() {
    const data = {
        timestamp: new Date().toISOString(),
        sensors: Array.from(systemState.sensors.entries()),
        alerts: systemState.alerts,
        stats: {
            dataPoints: systemState.dataPoints,
            uptime: systemState.startTime ? Date.now() - systemState.startTime : 0,
            totalSensors: systemState.sensors.size
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, {
        href: url,
        download: `sensor_data_${new Date().toISOString().split('T')[0]}.json`
    });
    a.click();
    URL.revokeObjectURL(url);
    showNotification('📁 Datos exportados', 'success');
}

const configureSensorThresholds = (sensorId, newThresholds) => {
    const sensor = systemState.sensors.get(sensorId);
    if (!sensor) return false;
    
    Object.assign(sensor, {
        alertThreshold: newThresholds.alert || sensor.alertThreshold,
        criticalThreshold: newThresholds.critical || sensor.criticalThreshold
    });
    
    updateSensorCard(sensorId);
    return true;
};

const analyzeTrends = () => {
    const trends = {};
    systemState.sensors.forEach((sensor, id) => {
        const percentage = (sensor.value / sensor.alertThreshold) * 100;
        trends[id] = {
            name: sensor.name, current: sensor.value, threshold: sensor.alertThreshold,
            status: sensor.status, riskLevel: percentage >= 100 ? 'high' : percentage >= 80 ? 'medium' : 'low'
        };
    });
    return trends;
};

const simulateMaintenance = () => {
    showNotification('🔧 Iniciando mantenimiento programado...', 'info');
    setTimeout(() => {
        systemState.sensors.forEach(sensor => {
            sensor.batteryLevel = Math.floor(Math.random() * 20) + 80;
            sensor.quality = 'good';
        });
        showNotification('✅ Mantenimiento completado', 'success');
    }, 3000);
};

// Eventos del DOM
document.addEventListener('DOMContentLoaded', () => {
    initializeSensors();
    updateLastUpdateTime();
    setInterval(() => Math.random() < 0.1 && showNotification('⚠️ Evento del sistema simulado', 'info'), 30000);
    showNotification('🌐 Sistema IoT listo', 'success');
});

// Atajos de teclado
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        const actions = {
            's': saveData,
            'r': () => systemState.isMonitoring ? stopMonitoring() : startMonitoring(),
            'e': exportData
        };
        if (actions[e.key]) {
            e.preventDefault();
            actions[e.key]();
        }
    }
});

// Debug global
window.sensorDebug = {
    getSystemState: () => systemState,
    getSensorData: (id) => systemState.sensors.get(id),
    generateReport: generateDailyReport,
    analyzeTrends,
    configureSensor: configureSensorThresholds,
    triggerMaintenance: simulateMaintenance
};