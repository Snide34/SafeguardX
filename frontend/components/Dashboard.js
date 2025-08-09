// frontend/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, Users, FileText, Bell, Play, Pause, Settings, Eye, Download } from 'lucide-react';

const SafeGuardXDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [threats, setThreats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [wsConnection, setWsConnection] = useState(null);
  const [apiData, setApiData] = useState({
    stats: { active_threats: 0, total_logs: 0, unread_alerts: 0 }
  });

  // API Configuration
  const API_BASE = 'http://localhost:8000/api';

  // Fetch data from FastAPI backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        const statsResponse = await fetch(`${API_BASE}/dashboard/stats`);
        const stats = await statsResponse.json();
        setApiData(prev => ({ ...prev, stats }));

        // Fetch threats
        const threatsResponse = await fetch(`${API_BASE}/threats`);
        const threatsData = await threatsResponse.json();
        setThreats(threatsData.threats || []);

        // Fetch logs
        const logsResponse = await fetch(`${API_BASE}/logs`);
        const logsData = await logsResponse.json();
        setLogs(logsData.logs || []);

        // Fetch alerts
        const alertsResponse = await fetch(`${API_BASE}/alerts`);
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onopen = () => {
      console.log('Connected to SafeGuardX WebSocket');
      setWsConnection(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleRealtimeUpdate(data);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setWsConnection(null);
    };

    return () => ws.close();
  }, []);

  const handleRealtimeUpdate = (data) => {
    switch (data.type) {
      case 'threat_detected':
        setThreats(prev => [data.threat, ...prev.slice(0, 19)]);
        setAlerts(prev => [data.alert, ...prev.slice(0, 9)]);
        break;
      case 'response_initiated':
      case 'threat_resolved':
        setThreats(prev => prev.map(t => 
          t.id === data.threat.id ? data.threat : t
        ));
        break;
    }
  };

  const activateResponse = async (threatId) => {
    try {
      const response = await fetch(`${API_BASE}/threats/${threatId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_mitigate' })
      });
      
      if (response.ok) {
        setThreats(prev => prev.map(threat => 
          threat.id === threatId 
            ? { ...threat, status: 'mitigating' }
            : threat
        ));
      }
    } catch (error) {
      console.error('Error activating response:', error);
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${alertId}/read`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, read: true }
            : alert
        ));
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const generateReport = async () => {
    try {
      const response = await fetch(`${API_BASE}/compliance/report`);
      const reportData = await response.json();
      
      // In a real app, this would download a PDF
      console.log('Compliance Report Generated:', reportData);
      alert('Compliance report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'critical': 'text-red-600 bg-red-100',
      'high': 'text-orange-600 bg-orange-100',
      'medium': 'text-yellow-600 bg-yellow-100',
      'low': 'text-green-600 bg-green-100'
    };
    return colors[severity] || 'text-gray-600 bg-gray-100';
  };

  const getLogLevelColor = (level) => {
    const colors = {
      'CRITICAL': 'text-red-600 bg-red-100',
      'ERROR': 'text-orange-600 bg-orange-100',
      'WARN': 'text-yellow-600 bg-yellow-100',
      'INFO': 'text-blue-600 bg-blue-100'
    };
    return colors[level] || 'text-gray-600 bg-gray-100';
  };

  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Stats Cards */}
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm">Active Threats</p>
            <p className="text-3xl font-bold text-red-600">
              {apiData.stats.active_threats || threats.filter(t => t.status === 'active').length}
            </p>
          </div>
          <AlertTriangle className="w-12 h-12 text-red-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm">Logs Processed</p>
            <p className="text-3xl font-bold text-blue-600">
              {apiData.stats.total_logs || logs.length}
            </p>
          </div>
          <Activity className="w-12 h-12 text-blue-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm">Unread Alerts</p>
            <p className="text-3xl font-bold text-yellow-600">
              {apiData.stats.unread_alerts || alerts.filter(a => !a.read).length}
            </p>
          </div>
          <Bell className="w-12 h-12 text-yellow-600" />
        </div>
      </div>

      {/* Recent Threats */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Recent Threats</h3>
        <div className="space-y-3">
          {threats.slice(0, 5).map(threat => (
            <div key={threat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(threat.severity)}`}>
                    {threat.severity?.toUpperCase()}
                  </span>
                  <span className="font-medium">{threat.type || threat.category}</span>
                  <span className="text-gray-600">from {threat.source}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Confidence: {threat.confidence}% | {new Date(threat.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  threat.status === 'active' ? 'bg-red-100 text-red-800' :
                  threat.status === 'mitigating' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {threat.status}
                </span>
                {threat.status === 'active' && (
                  <button
                    onClick={() => activateResponse(threat.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                  >
                    Auto Respond
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Monitoring</span>
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <div className="flex items-center justify-between">
            <span>Log Ingestion</span>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex items-center justify-between">
            <span>WebSocket</span>
            <div className={`w-3 h-3 rounded-full ${wsConnection ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <div className="flex items-center justify-between">
            <span>API Health</span>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Real-time Log Analysis</h3>
      </div>
      <div className="p-6">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm">
              <div className="flex items-center space-x-3">
                <span className="text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLogLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="font-medium">{log.source}</span>
                <span>{log.message}</span>
              </div>
              <div className="flex items-center space-x-2">
                {log.anomaly_score > 0.7 && (
                  <span className="text-red-600 text-xs">Anomaly Detected</span>
                )}
                <span className="text-xs text-gray-500">
                  Score: {log.anomaly_score?.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Security Alerts</h3>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-lg border ${alert.read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity?.toUpperCase()}
                    </span>
                    <span className={`font-medium ${alert.read ? 'text-gray-600' : 'text-gray-900'}`}>
                      {alert.message}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                {!alert.read && (
                  <button
                    onClick={() => markAlertRead(alert.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Compliance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Security Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Incidents:</span>
                <span className="font-medium">{threats.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Resolved:</span>
                <span className="font-medium text-green-600">
                  {threats.filter(t => t.status === 'resolved').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Response Time Avg:</span>
                <span className="font-medium">2.3 minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Coverage:</span>
                <span className="font-medium text-green-600">99.7%</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Compliance Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>SOC 2:</span>
                <span className="text-green-600 font-medium">Compliant</span>
              </div>
              <div className="flex justify-between">
                <span>ISO 27001:</span>
                <span className="text-green-600 font-medium">Compliant</span>
              </div>
              <div className="flex justify-between">
                <span>GDPR:</span>
                <span className="text-green-600 font-medium">Compliant</span>
              </div>
              <div className="flex justify-between">
                <span>HIPAA:</span>
                <span className="text-yellow-600 font-medium">Pending</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={generateReport}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Generate Compliance Report</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">SafeGuardX</h1>
            <span className="text-sm text-gray-500">AI-Powered Security Operations</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Monitoring:</span>
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`p-2 rounded ${isMonitoring ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
              >
                {isMonitoring ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600" />
              {alerts.filter(a => !a.read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {alerts.filter(a => !a.read).length}
                </span>
              )}
            </div>
            <div className="text-xs">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${wsConnection ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {wsConnection ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'logs', label: 'Log Analysis', icon: Eye },
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'compliance', label: 'Compliance', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                  selectedTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {selectedTab === 'dashboard' && renderDashboard()}
        {selectedTab === 'logs' && renderLogs()}
        {selectedTab === 'alerts' && renderAlerts()}
        {selectedTab === 'compliance' && renderCompliance()}
      </main>
    </div>
  );
};

export default SafeGuardXDashboard;